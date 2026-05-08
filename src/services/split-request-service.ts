import * as SMS from 'expo-sms';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import type { PersonBreakdown } from '../types';

export interface SplitRequestLineInput {
  recipient_user_id?: string;
  recipient_name: string;
  recipient_phone?: string;
  amount: number;
}

export interface CreateSplitRequestResponse {
  split_request_id: string;
  public_token: string;
  landing_url: string;
  recipient_phones: string[];
  dine_recipient_user_ids: string[];
  sms_body: string;
}

export type CreateSplitRequestError =
  | { kind: 'missing_venmo_handle' }
  | { kind: 'http'; status: number; message: string }
  | { kind: 'unknown'; message: string };

/**
 * Calls the `create-split-request` Edge Function. Returns the payload the
 * client needs to fan out the SMS share-sheet (phones + prefilled body) plus
 * the in-app push fan-out (Dine recipient user_ids).
 *
 * On 412 response (sender hasn't set their Venmo handle), returns a typed
 * error so the caller can route the user to the profile field instead of
 * showing a generic alert.
 */
export async function createSplitRequest(input: {
  postId?: string;
  restaurantName: string;
  note?: string;
  lines: SplitRequestLineInput[];
}): Promise<CreateSplitRequestResponse> {
  const { data, error } = await supabase.functions.invoke('create-split-request', {
    body: {
      post_id: input.postId ?? null,
      restaurant_name: input.restaurantName,
      note: input.note ?? null,
      lines: input.lines.map((l) => ({
        recipient_user_id: l.recipient_user_id ?? null,
        recipient_name: l.recipient_name,
        recipient_phone: l.recipient_phone ?? null,
        amount: l.amount,
      })),
    },
  });

  if (error) {
    // Supabase JS surfaces 412 as a FunctionsHttpError with a context object;
    // we only care about the missing_venmo_handle reason for routing decisions.
    const status = (error as any)?.context?.status;
    const reason = (data as any)?.reason ?? (await readReasonFromError(error));
    if (status === 412 || reason === 'missing_venmo_handle') {
      throw makeError({ kind: 'missing_venmo_handle' });
    }
    throw makeError({
      kind: 'http',
      status: status ?? 0,
      message: error.message ?? 'create-split-request failed',
    });
  }
  if (!data) {
    throw makeError({ kind: 'unknown', message: 'create-split-request returned no data' });
  }
  return data as CreateSplitRequestResponse;
}

export type SmsShareResult = 'sent' | 'cancelled' | 'unavailable';

/**
 * Opens the native iOS MFMessageComposeViewController with all recipients
 * prefilled. Unlike a `sms:` deep link, this delivers reliably to every
 * recipient regardless of iMessage vs SMS or carrier group-MMS settings.
 *
 * Returns:
 *   - 'sent'        — user tapped Send
 *   - 'cancelled'   — user dismissed the sheet without sending
 *   - 'unavailable' — device can't send SMS (simulator, no SIM)
 */
export async function openSmsShareSheet(
  recipientPhones: string[],
  body: string,
): Promise<SmsShareResult> {
  if (recipientPhones.length === 0) return 'unavailable';
  const isAvailable = await SMS.isAvailableAsync();
  if (!isAvailable) return 'unavailable';
  const { result } = await SMS.sendSMSAsync(recipientPhones, body);
  if (result === 'cancelled') return 'cancelled';
  // iOS sometimes returns 'unknown' even after a successful send; treat as sent.
  return 'sent';
}

/**
 * Filters PersonBreakdowns to those eligible for the new sender-SMS flow:
 * tagged with a phone number OR a user_id (Dine user — gets a push instead),
 * non-zero amount, and not the sender themselves.
 */
export function getRequestableBreakdowns(
  breakdowns: PersonBreakdown[],
  senderUserId: string | undefined,
): PersonBreakdown[] {
  return breakdowns.filter((b) => {
    if (b.total <= 0) return false;
    if (senderUserId && b.friend.id === senderUserId) return false;
    if (senderUserId && b.friend.user_id === senderUserId) return false;
    return Boolean(b.friend.phone_number || b.friend.user_id || b.friend.is_app_user);
  });
}

export function isIosSmsCapable(): boolean {
  return Platform.OS === 'ios';
}

// ─── internals ──────────────────────────────────────────────────────────────

function makeError(payload: CreateSplitRequestError): Error & CreateSplitRequestError {
  const err = Object.assign(new Error(messageFor(payload)), payload);
  return err as Error & CreateSplitRequestError;
}

function messageFor(payload: CreateSplitRequestError): string {
  switch (payload.kind) {
    case 'missing_venmo_handle':
      return 'Add your Venmo handle in Settings to send payment requests.';
    case 'http':
      return `Server error (${payload.status}): ${payload.message}`;
    default:
      return payload.message;
  }
}

async function readReasonFromError(err: unknown): Promise<string | null> {
  // Supabase functions errors sometimes include a Response on `context`.
  const ctx = (err as any)?.context;
  if (ctx?.json) {
    try {
      const body = await ctx.json();
      return body?.reason ?? null;
    } catch {
      return null;
    }
  }
  return null;
}
