import { parsePhoneNumberFromString, AsYouType } from 'libphonenumber-js';
import { supabase } from '../lib/supabase';
import { updateUserProfile } from './auth-service';
import type { User } from '../types';

export type PhoneNormalizeResult =
  | { ok: true; e164: string; national: string }
  | { ok: false; reason: 'invalid' | 'unsupported_country' };

/**
 * Parse free-form input into E.164 (US-only for beta). Accepts:
 *   "(949) 390-0529", "949-390-0529", "+1 949 390 0529", "9493900529"
 * Returns the canonical "+19493900529" plus a national display string
 * for the input field. Anything we can't parse to a valid US number fails.
 */
export function normalizeUSPhone(input: string): PhoneNormalizeResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, reason: 'invalid' };

  const parsed = parsePhoneNumberFromString(trimmed, 'US');
  if (!parsed || !parsed.isValid()) return { ok: false, reason: 'invalid' };
  if (parsed.country !== 'US') return { ok: false, reason: 'unsupported_country' };

  return { ok: true, e164: parsed.number, national: parsed.formatNational() };
}

/** Live formatter for the input field — turns "9493" into "(949) 3". */
export function formatUSPhoneAsYouType(input: string): string {
  return new AsYouType('US').input(input);
}

/**
 * Sentinel error thrown when a phone is already linked to a different account.
 * Caller checks `error.code === 'PHONE_TAKEN'` to surface user-facing copy
 * without depending on raw Postgres / Supabase error strings.
 */
export class PhoneTakenError extends Error {
  code = 'PHONE_TAKEN' as const;
  constructor() {
    super('That number is already linked to another account.');
  }
}

/**
 * Pre-flight check: is this phone already on a public.users row owned by a
 * different account? Returns true if so. RLS allows public SELECT on users,
 * so this is a direct query.
 */
async function isPhoneTakenByOtherUser(e164: string, uid: string): Promise<boolean> {
  const { data } = await supabase
    .from('users')
    .select('id')
    .eq('phone_number', e164)
    .neq('id', uid)
    .limit(1)
    .maybeSingle();
  return !!data;
}

/**
 * Attach a phone number to the currently-authenticated user and send an OTP.
 * The user must already be signed in (Apple/Google/email) — this is the
 * "add phone to existing account" flow, NOT phone-as-primary-auth.
 *
 * Pre-flight: rejects PHONE_TAKEN before touching auth state. Otherwise we'd
 * succeed at `auth.updateUser` then fail at the public.users mirror, leaving
 * auth.users.phone set on the current user with no clean way to roll back.
 */
export async function sendPhoneOtp(e164: string, uid: string): Promise<void> {
  if (await isPhoneTakenByOtherUser(e164, uid)) {
    throw new PhoneTakenError();
  }
  const { error } = await supabase.auth.updateUser({ phone: e164 });
  if (error) throw error;
}

/**
 * Verify the OTP for a phone-change request. On success, mirrors the verified
 * phone into `public.users` so app-level queries (RLS, ENG-150 claim flow,
 * tag-by-phone) don't have to reach into the auth schema.
 *
 * Returns the freshly-stored row so the caller can hydrate Zustand directly.
 * We deliberately don't trust the values we sent — migration 007's
 * `user_phone_backfill` trigger calls `normalize_phone()` which can rewrite
 * the value before persistence (idempotent for E.164 today, but defensive
 * against future input shapes), and the `phone_verified_at` timestamp comes
 * back exactly as Postgres saw it (avoids client-vs-server clock drift).
 */
export async function verifyPhoneOtp(
  e164: string,
  token: string,
  uid: string,
): Promise<User> {
  const { error } = await supabase.auth.verifyOtp({
    phone: e164,
    token,
    type: 'phone_change',
  });
  if (error) throw error;

  // Mirror into public.users. The pre-flight in sendPhoneOtp should have
  // caught any collision, but a TOCTOU race (another user grabbed the same
  // number between our check and now) could still raise 23505 here — surface
  // it as PHONE_TAKEN so the UI shows the right message.
  try {
    return await updateUserProfile(uid, {
      phone_number: e164,
      phone_verified_at: new Date().toISOString(),
    });
  } catch (err: any) {
    if (err?.code === '23505') throw new PhoneTakenError();
    throw err;
  }
}
