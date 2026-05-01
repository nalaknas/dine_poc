import { supabase } from '../lib/supabase';
import type { User, Post, Notification, DiningPartner, Playlist } from '../types';

// ─── Search ───────────────────────────────────────────────────────────────────

export async function searchUsers(query: string): Promise<User[]> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
    .limit(20);

  if (error) throw error;
  return (data ?? []) as User[];
}

// ─── Frequent Friends ────────────────────────────────────────────────────────

/**
 * Returns the user's most frequently tagged friends, ordered by tag count.
 * Queries post_tagged_friends for posts authored by the current user,
 * then joins with users to get full profile data.
 */
export async function getFrequentFriends(userId: string, limit = 8): Promise<User[]> {
  // Get tagged friend user_ids grouped by count, for posts authored by this user
  const { data: tagged, error: tagError } = await supabase
    .from('post_tagged_friends')
    .select('user_id, post_id, posts!inner(author_id)')
    .eq('posts.author_id', userId)
    .not('user_id', 'is', null)
    .neq('user_id', userId);

  if (tagError || !tagged || tagged.length === 0) return [];

  // Count occurrences of each user_id
  const counts: Record<string, number> = {};
  for (const row of tagged) {
    const uid = row.user_id as string;
    counts[uid] = (counts[uid] ?? 0) + 1;
  }

  // Sort by count descending, take top N
  const topIds = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);

  if (topIds.length === 0) return [];

  // Fetch full user profiles
  const { data: users, error: userError } = await supabase
    .from('users')
    .select('*')
    .in('id', topIds);

  if (userError || !users) return [];

  // Re-sort by frequency
  const idOrder = new Map(topIds.map((id, i) => [id, i]));
  return (users as User[]).sort((a, b) => (idOrder.get(a.id) ?? 99) - (idOrder.get(b.id) ?? 99));
}

// ─── Follow System ────────────────────────────────────────────────────────────

export async function followUser(currentUserId: string, targetUserId: string): Promise<void> {
  if (currentUserId === targetUserId) return;

  const { error } = await supabase
    .from('follows')
    .insert({ follower_id: currentUserId, following_id: targetUserId });
  if (error) throw error;

  await createNotification({
    userId: targetUserId,
    type: 'follow',
    fromUserId: currentUserId,
    message: 'started following you',
  });
}

export async function unfollowUser(currentUserId: string, targetUserId: string): Promise<void> {
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', currentUserId)
    .eq('following_id', targetUserId);
  if (error) throw error;
}

export async function isFollowing(currentUserId: string, targetUserId: string): Promise<boolean> {
  const { data } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('follower_id', currentUserId)
    .eq('following_id', targetUserId)
    .single();
  return !!data;
}

export async function getFollowerCount(userId: string): Promise<number> {
  const { count } = await supabase
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('following_id', userId);
  return count ?? 0;
}

export async function getFollowingCount(userId: string): Promise<number> {
  const { count } = await supabase
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('follower_id', userId);
  return count ?? 0;
}

export async function getFollowingIds(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId);
  return (data ?? []).map((r: { following_id: string }) => r.following_id);
}

// ─── Notifications ────────────────────────────────────────────────────────────

export async function getUserNotifications(userId: string): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*, from_user:users!notifications_from_user_id_fkey(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;
  return (data ?? []) as Notification[];
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);
}

export async function createNotification(params: {
  userId: string;
  type: string;
  fromUserId: string;
  postId?: string;
  message: string;
}): Promise<void> {
  await supabase.from('notifications').insert({
    user_id: params.userId,
    type: params.type,
    from_user_id: params.fromUserId,
    post_id: params.postId,
    message: params.message,
    is_read: false,
  });
}

// ─── Dining Partners ──────────────────────────────────────────────────────────

export async function getDiningPartners(userId: string): Promise<DiningPartner[]> {
  const { data, error } = await supabase
    .from('dining_partners')
    .select('*, partner:users!dining_partners_partner_id_fkey(*)')
    .eq('user_id', userId);

  if (error) throw error;
  return (data ?? []) as DiningPartner[];
}

export async function addDiningPartner(
  userId: string,
  partnerId: string,
  label: string
): Promise<void> {
  // Add both directions
  const { error } = await supabase.from('dining_partners').insert([
    { user_id: userId, partner_id: partnerId, label },
    { user_id: partnerId, partner_id: userId, label },
  ]);
  if (error) throw error;
}

export async function removeDiningPartner(userId: string, partnerId: string): Promise<void> {
  await supabase
    .from('dining_partners')
    .delete()
    .or(`and(user_id.eq.${userId},partner_id.eq.${partnerId}),and(user_id.eq.${partnerId},partner_id.eq.${userId})`);
}

// ─── Playlists ────────────────────────────────────────────────────────────────

export async function getUserPlaylists(userId: string): Promise<Playlist[]> {
  const { data, error } = await supabase
    .from('playlists')
    .select('*, restaurants:playlist_restaurants(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as Playlist[];
}

export async function createPlaylist(
  userId: string,
  name: string,
  description?: string,
  isPublic = true
): Promise<Playlist> {
  const { data, error } = await supabase
    .from('playlists')
    .insert({ user_id: userId, name, description, is_public: isPublic })
    .select('*, restaurants:playlist_restaurants(*)')
    .single();

  if (error) throw error;
  return data as Playlist;
}

export async function addToPlaylist(
  playlistId: string,
  restaurant: {
    restaurant_name: string;
    city?: string;
    state?: string;
    cuisine_type?: string;
    google_place_id?: string;
    yelp_id?: string;
    notes?: string;
  }
): Promise<void> {
  const { error } = await supabase
    .from('playlist_restaurants')
    .insert({ playlist_id: playlistId, ...restaurant });
  if (error) throw error;
}
