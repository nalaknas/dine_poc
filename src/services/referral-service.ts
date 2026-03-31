import { supabase } from '../lib/supabase';

const REFERRAL_CREDITS = 25;
const REQUIRED_POSTS_FOR_REFERRAL = 3;

/**
 * Records that a user was invited by another user via bill split.
 * Called when a new user signs up after following a split deep link.
 */
export async function recordReferral(
  inviterId: string,
  inviteeId: string,
  splitId: string,
): Promise<void> {
  const { error } = await supabase
    .from('referrals')
    .insert({
      inviter_id: inviterId,
      invitee_id: inviteeId,
      source: 'bill_split',
      source_id: splitId,
    });

  // Ignore duplicate (already tracked)
  if (error && !error.message.includes('duplicate')) {
    console.error('[referral] Failed to record:', error.message);
  }
}

/**
 * Checks if a referral should be credited (invitee has 3+ posts).
 * Called after each post creation to check pending referrals.
 */
export async function checkAndAwardReferralCredits(
  inviteeId: string,
): Promise<void> {
  // Check if this user was referred
  const { data: referral } = await supabase
    .from('referrals')
    .select('id, inviter_id, credited')
    .eq('invitee_id', inviteeId)
    .eq('credited', false)
    .limit(1)
    .maybeSingle();

  if (!referral) return;

  // Count invitee's posts
  const { count } = await supabase
    .from('posts')
    .select('id', { count: 'exact', head: true })
    .eq('author_id', inviteeId);

  if ((count ?? 0) < REQUIRED_POSTS_FOR_REFERRAL) return;

  // Award referral credits to inviter
  const { error: creditError } = await supabase.rpc('add_credits', {
    p_user_id: referral.inviter_id,
    p_type: 'referral',
    p_amount: REFERRAL_CREDITS,
    p_source_post_id: null,
    p_source_user_id: inviteeId,
    p_metadata: { source: 'bill_split', invitee_id: inviteeId },
  });

  if (creditError) {
    console.error('[referral] Failed to award credits:', creditError.message);
    return;
  }

  // Mark referral as credited
  await supabase
    .from('referrals')
    .update({ credited: true, credited_at: new Date().toISOString() })
    .eq('id', referral.id);
}

/**
 * Creates a persisted split record for deep link landing pages.
 */
export async function createSplitRecord(
  postId: string,
  restaurantName: string,
  date: string,
  inviterId: string,
  breakdowns: { displayName: string; amount: number }[],
): Promise<string> {
  const { data, error } = await supabase
    .from('split_invites')
    .insert({
      post_id: postId,
      restaurant_name: restaurantName,
      meal_date: date,
      inviter_id: inviterId,
      breakdowns,
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id as string;
}

/**
 * Fetches a split invite by ID (for deep link landing page).
 */
export async function getSplitInvite(splitId: string): Promise<{
  id: string;
  restaurant_name: string;
  meal_date: string;
  inviter_id: string;
  breakdowns: { displayName: string; amount: number }[];
  inviter?: { display_name: string; username: string; avatar_url?: string };
} | null> {
  const { data, error } = await supabase
    .from('split_invites')
    .select('*, inviter:users!split_invites_inviter_id_fkey(display_name, username, avatar_url)')
    .eq('id', splitId)
    .single();

  if (error) return null;
  return data;
}
