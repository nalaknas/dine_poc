import { supabase } from '../lib/supabase';

export interface WaitlistSignup {
  id: string;
  email: string | null;
  phone: string | null;
  source_split_request_id: string | null;
  invited_at: string | null;
  dismissed_at: string | null;
  created_at: string;
}

export type WaitlistFilter = 'pending' | 'invited' | 'dismissed' | 'all';

export async function fetchWaitlistSignups(filter: WaitlistFilter = 'pending'): Promise<WaitlistSignup[]> {
  let q = supabase
    .from('waitlist_signups')
    .select('id, email, phone, source_split_request_id, invited_at, dismissed_at, created_at')
    .order('created_at', { ascending: filter === 'pending' });

  if (filter === 'pending') {
    q = q.is('invited_at', null).is('dismissed_at', null);
  } else if (filter === 'invited') {
    q = q.not('invited_at', 'is', null);
  } else if (filter === 'dismissed') {
    q = q.not('dismissed_at', 'is', null);
  }

  const { data, error } = await q.limit(200);
  if (error) throw error;
  return (data ?? []) as WaitlistSignup[];
}

export async function markInvited(id: string): Promise<void> {
  const { error } = await supabase
    .from('waitlist_signups')
    .update({ invited_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function markDismissed(id: string): Promise<void> {
  const { error } = await supabase
    .from('waitlist_signups')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function unmarkRow(id: string): Promise<void> {
  const { error } = await supabase
    .from('waitlist_signups')
    .update({ invited_at: null, dismissed_at: null })
    .eq('id', id);
  if (error) throw error;
}

/**
 * Builds the mailto: deep link for sending a TestFlight invite. The Apple
 * TestFlight public link is the same for all invitees — they tap it, install
 * via TestFlight, and the build is theirs. Personalized copy lives in the
 * mailto body.
 *
 * For a phone-only signup we fall back to an sms: deep link instead.
 */
const TESTFLIGHT_PUBLIC_LINK = 'https://testflight.apple.com/join/REPLACE_ME';
const FROM_NAME = 'Sanka';

export function buildInviteUrl(signup: WaitlistSignup): string | null {
  const subject = `You're in — dine beta invite`;
  const body =
    `Hey,\n\n` +
    `Thanks for signing up for the dine beta. Tap the link below on your iPhone to install via TestFlight:\n\n` +
    `${TESTFLIGHT_PUBLIC_LINK}\n\n` +
    `If you hit any snags, just reply to this message.\n\n` +
    `— ${FROM_NAME}`;

  if (signup.email) {
    return `mailto:${encodeURIComponent(signup.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }
  if (signup.phone) {
    return `sms:${signup.phone}&body=${encodeURIComponent(`You're in — dine beta. Tap to install via TestFlight on iPhone: ${TESTFLIGHT_PUBLIC_LINK}`)}`;
  }
  return null;
}
