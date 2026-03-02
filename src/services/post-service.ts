import { supabase } from '../lib/supabase';
import type { Post, CreatePostDraft, PersonBreakdown } from '../types';
import { createNotification } from './user-service';
import { getFollowingIds } from './user-service';

// ─── Feed ─────────────────────────────────────────────────────────────────────

export async function getFeedPosts(currentUserId: string, limit = 20): Promise<Post[]> {
  // Get IDs of people we follow + ourselves
  const followingIds = await getFollowingIds(currentUserId);
  const authorIds = [currentUserId, ...followingIds];

  const { data, error } = await supabase
    .from('posts')
    .select(`
      *,
      author:users!posts_author_id_fkey(*),
      dish_ratings(*),
      tagged_friends:post_tagged_friends(*)
    `)
    .in('author_id', authorIds)
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  // Attach is_liked for current user
  const posts = (data ?? []) as Post[];
  if (posts.length === 0) return posts;

  const postIds = posts.map((p) => p.id);
  const { data: likes } = await supabase
    .from('likes')
    .select('post_id')
    .eq('user_id', currentUserId)
    .in('post_id', postIds);

  const likedSet = new Set((likes ?? []).map((l: { post_id: string }) => l.post_id));
  return posts.map((p) => ({ ...p, is_liked: likedSet.has(p.id) }));
}

export async function getUserPosts(userId: string, currentUserId?: string): Promise<Post[]> {
  // Viewing own profile: show all posts
  if (userId === currentUserId) {
    const { data, error } = await supabase
      .from('posts')
      .select(`*, author:users!posts_author_id_fkey(*), dish_ratings(*), tagged_friends:post_tagged_friends(*)`)
      .eq('author_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as Post[];
  }

  // Viewing someone else's profile: public posts + private posts where viewer is tagged
  const { data: publicPosts, error: pubErr } = await supabase
    .from('posts')
    .select(`*, author:users!posts_author_id_fkey(*), dish_ratings(*), tagged_friends:post_tagged_friends(*)`)
    .eq('author_id', userId)
    .eq('is_public', true)
    .order('created_at', { ascending: false });
  if (pubErr) throw pubErr;

  if (!currentUserId) return (publicPosts ?? []) as Post[];

  // Find private posts where the viewer is tagged
  const { data: taggedEntries } = await supabase
    .from('post_tagged_friends')
    .select('post_id')
    .eq('user_id', currentUserId);
  const taggedPostIds = (taggedEntries ?? []).map((t: { post_id: string }) => t.post_id);

  if (taggedPostIds.length === 0) return (publicPosts ?? []) as Post[];

  const { data: privatePosts } = await supabase
    .from('posts')
    .select(`*, author:users!posts_author_id_fkey(*), dish_ratings(*), tagged_friends:post_tagged_friends(*)`)
    .eq('author_id', userId)
    .eq('is_public', false)
    .in('id', taggedPostIds)
    .order('created_at', { ascending: false });

  // Merge and sort by date
  const all = [...(publicPosts ?? []), ...(privatePosts ?? [])] as Post[];
  all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return all;
}

export async function getTaggedPosts(userId: string): Promise<Post[]> {
  const { data: taggedFriends } = await supabase
    .from('post_tagged_friends')
    .select('post_id')
    .eq('user_id', userId);

  const postIds = (taggedFriends ?? []).map((t: { post_id: string }) => t.post_id);
  if (postIds.length === 0) return [];

  // Tagged friends can see both public and private posts they're tagged in
  const { data, error } = await supabase
    .from('posts')
    .select(`*, author:users!posts_author_id_fkey(*), dish_ratings(*)`)
    .in('id', postIds)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as Post[];
}

// ─── Single Post ──────────────────────────────────────────────────────────────

export async function getPost(postId: string, currentUserId?: string): Promise<Post | null> {
  const { data, error } = await supabase
    .from('posts')
    .select(`
      *,
      author:users!posts_author_id_fkey(*),
      dish_ratings(*),
      tagged_friends:post_tagged_friends(*),
      receipt_items(*)
    `)
    .eq('id', postId)
    .single();

  if (error) return null;
  const post = data as Post;

  if (currentUserId) {
    const { data: like } = await supabase
      .from('likes')
      .select('post_id')
      .eq('user_id', currentUserId)
      .eq('post_id', postId)
      .single();
    post.is_liked = !!like;
  }

  return post;
}

// ─── Create Post ──────────────────────────────────────────────────────────────

export async function createPost(
  draft: CreatePostDraft,
  authorId: string,
  breakdowns: PersonBreakdown[]
): Promise<Post> {
  const receipt = draft.receiptData;

  // 1. Insert the post
  const { data: post, error: postError } = await supabase
    .from('posts')
    .insert({
      author_id: authorId,
      restaurant_name: receipt?.restaurantName ?? '',
      city: receipt?.city,
      state: receipt?.state,
      address: receipt?.address,
      caption: draft.caption,
      overall_rating: draft.overallRating,
      cuisine_type: draft.cuisineType,
      tags: draft.tags,
      meal_type: draft.mealType,
      food_photos: draft.foodPhotos,
      is_public: draft.isPublic,
      meal_date: draft.mealDate,
      receipt_subtotal: receipt?.subtotal,
      receipt_tax: receipt?.tax,
      receipt_tip: receipt?.tip,
      receipt_discount: receipt?.discount,
      receipt_total: receipt?.total,
    })
    .select()
    .single();

  if (postError) throw postError;
  const postId = post.id;

  // 2. Insert receipt items
  if (receipt?.items && receipt.items.length > 0) {
    const itemRows = receipt.items.map((item) => ({
      post_id: postId,
      name: item.name,
      price: item.price,
      assigned_to: draft.itemAssignments[item.id] ?? [],
    }));
    await supabase.from('receipt_items').insert(itemRows);
  }

  // 3. Insert dish ratings
  if (draft.dishRatings && draft.dishRatings.length > 0) {
    const ratingRows = draft.dishRatings
      .filter((r) => r.rating > 0)
      .map((r) => ({
        post_id: postId,
        user_id: authorId,
        dish_name: r.dishName,
        rating: r.rating,
        notes: r.notes,
      }));
    if (ratingRows.length > 0) {
      await supabase.from('dish_ratings').insert(ratingRows);
    }
  }

  // 4. Insert tagged friends
  if (breakdowns.length > 0) {
    const friendRows = breakdowns.map((b) => ({
      post_id: postId,
      user_id: b.friend.user_id ?? null,
      display_name: b.friend.display_name,
      username: b.friend.username,
      venmo_username: b.friend.venmo_username,
      amount_owed: b.total,
    }));
    await supabase.from('post_tagged_friends').insert(friendRows);
  }

  return post as Post;
}

// ─── Like / Unlike ────────────────────────────────────────────────────────────

export async function likePost(postId: string, userId: string, authorId: string): Promise<void> {
  // Insert like (ignore duplicate)
  await supabase.from('likes').insert({ post_id: postId, user_id: userId });

  // Increment count
  await supabase.rpc('increment_like_count', { post_id: postId });

  // Notify author (don't notify yourself)
  if (userId !== authorId) {
    await createNotification({
      userId: authorId,
      type: 'like',
      fromUserId: userId,
      postId,
      message: 'liked your post',
    });
  }
}

export async function unlikePost(postId: string, userId: string): Promise<void> {
  await supabase
    .from('likes')
    .delete()
    .eq('post_id', postId)
    .eq('user_id', userId);

  await supabase.rpc('decrement_like_count', { post_id: postId });
}

// ─── Delete Post ──────────────────────────────────────────────────────────────

export async function deletePost(postId: string): Promise<void> {
  const { error } = await supabase.from('posts').delete().eq('id', postId);
  if (error) throw error;
}

// ─── Update Post ──────────────────────────────────────────────────────────────

export async function updatePost(postId: string, updates: Partial<Post>): Promise<Post> {
  const { data, error } = await supabase
    .from('posts')
    .update(updates)
    .eq('id', postId)
    .select()
    .single();
  if (error) throw error;
  return data as Post;
}
