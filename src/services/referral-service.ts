import { supabase } from '../lib/supabase';

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
 * Creates a persisted split record for deep link landing pages.
 * Note: postId can be null if the split is created before the post.
 */
export async function createSplitRecord(
  postId: string | null,
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
