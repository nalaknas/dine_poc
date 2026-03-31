import { supabase } from '../lib/supabase';
import type { Post, Comment, CreatePostDraft, PersonBreakdown, UserTier } from '../types';
import { createNotification } from './user-service';
import { getFollowingIds } from './user-service';

// ─── Feed ─────────────────────────────────────────────────────────────────────

export async function getFeedPosts(currentUserId: string, limit = 20): Promise<Post[]> {
  // Get IDs of people we follow + ourselves
  const followingIds = await getFollowingIds(currentUserId);
  const authorIds = [currentUserId, ...followingIds];

  // Find posts where a followed user is tagged (shared visibility)
  const { data: taggedPostEntries } = await supabase
    .from('post_tagged_friends')
    .select('post_id')
    .in('user_id', followingIds.length > 0 ? followingIds : ['__none__'])
    .not('user_id', 'is', null)
    .limit(100);

  const taggedPostIds = [...new Set(
    (taggedPostEntries ?? []).map((t: { post_id: string }) => t.post_id),
  )];

  let query = supabase
    .from('posts')
    .select(`
      *,
      author:users!posts_author_id_fkey(*),
      dish_ratings(*),
      tagged_friends:post_tagged_friends(*, user:users!post_tagged_friends_user_id_fkey(avatar_url))
    `)
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (taggedPostIds.length > 0) {
    query = query.or(
      `author_id.in.(${authorIds.join(',')}),id.in.(${taggedPostIds.join(',')})`,
    );
  } else {
    query = query.in('author_id', authorIds);
  }

  const { data, error } = await query;

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

  // Fetch 2 most recent comments per post
  const { data: allComments } = await supabase
    .from('comments')
    .select('*, author:users!comments_author_id_fkey(*)')
    .in('post_id', postIds)
    .order('created_at', { ascending: false });

  const commentsByPost = (allComments ?? [] as Comment[]).reduce<Record<string, Comment[]>>((acc, c) => {
    if (!acc[c.post_id]) acc[c.post_id] = [];
    if (acc[c.post_id].length < 2) acc[c.post_id].push(c as Comment);
    return acc;
  }, {});

  return posts.map((p) => ({
    ...p,
    is_liked: likedSet.has(p.id),
    recent_comments: (commentsByPost[p.id] ?? []).reverse(),
  }));
}

export async function getUserPosts(userId: string, currentUserId?: string): Promise<Post[]> {
  // Viewing own profile: show all posts
  if (userId === currentUserId) {
    const { data, error } = await supabase
      .from('posts')
      .select(`*, author:users!posts_author_id_fkey(*), dish_ratings(*), tagged_friends:post_tagged_friends(*, user:users!post_tagged_friends_user_id_fkey(avatar_url))`)
      .eq('author_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as Post[];
  }

  // Viewing someone else's profile: public posts + private posts where viewer is tagged
  const { data: publicPosts, error: pubErr } = await supabase
    .from('posts')
    .select(`*, author:users!posts_author_id_fkey(*), dish_ratings(*), tagged_friends:post_tagged_friends(*, user:users!post_tagged_friends_user_id_fkey(avatar_url))`)
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
    .select(`*, author:users!posts_author_id_fkey(*), dish_ratings(*), tagged_friends:post_tagged_friends(*, user:users!post_tagged_friends_user_id_fkey(avatar_url))`)
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
    .select(`*, author:users!posts_author_id_fkey(*), dish_ratings(*), tagged_friends:post_tagged_friends(*, user:users!post_tagged_friends_user_id_fkey(avatar_url))`)
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
      tagged_friends:post_tagged_friends(*, user:users!post_tagged_friends_user_id_fkey(avatar_url)),
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
      caption: draft.caption ?? '',
      overall_rating: draft.overallRating,
      cuisine_type: draft.cuisineType,
      tags: draft.tags ?? [],
      meal_type: draft.mealType,
      food_photos: draft.foodPhotos ?? [],
      photo_labels: draft.photoLabels ?? {},
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
    const { error: itemsError } = await supabase.from('receipt_items').insert(itemRows);
    if (itemsError) console.error('[createPost] receipt_items insert failed:', itemsError.message);
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
      const { error: ratingsError } = await supabase.from('dish_ratings').insert(ratingRows);
      if (ratingsError) console.error('[createPost] dish_ratings insert failed:', ratingsError.message);
    }
  }

  // 4. Insert tagged friends (include phone_number for future backfill)
  if (breakdowns.length > 0) {
    const friendRows = breakdowns.map((b) => ({
      post_id: postId,
      user_id: b.friend.user_id ?? null,
      display_name: b.friend.display_name,
      username: b.friend.username,
      venmo_username: b.friend.venmo_username,
      phone_number: b.friend.phone_number ?? null,
      amount_owed: b.total,
    }));
    const { error: friendsError } = await supabase.from('post_tagged_friends').insert(friendRows);
    if (friendsError) console.error('[createPost] post_tagged_friends insert failed:', friendsError.message);

    // Increment split counts for server-side contacts
    const contactIds = breakdowns
      .filter((b) => b.friend.contact_id)
      .map((b) => b.friend.contact_id!);
    if (contactIds.length > 0) {
      try {
        const { bulkIncrementSplitCounts } = await import('./contact-service');
        await bulkIncrementSplitCounts(contactIds);
      } catch {
        console.error('[createPost] Failed to increment contact split counts');
      }
    }
  }

  return post as Post;
}

// ─── Notify tagged participants ───────────────────────────────────────────────

export async function notifyTaggedParticipants(
  postId: string,
  fromUserId: string,
  type: string,
  message: string,
): Promise<void> {
  const { data } = await supabase
    .from('post_tagged_friends')
    .select('user_id')
    .eq('post_id', postId)
    .not('user_id', 'is', null)
    .neq('user_id', fromUserId);

  if (!data || data.length === 0) return;

  const uniqueIds = [...new Set((data as { user_id: string }[]).map((r) => r.user_id))];
  await Promise.all(
    uniqueIds.map((uid) =>
      createNotification({ userId: uid, type, fromUserId, postId, message }),
    ),
  );
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

  // Notify tagged meal participants
  await notifyTaggedParticipants(postId, userId, 'like', 'liked a post you were part of');
}

// ─── Like / Unlike Comment ────────────────────────────────────────────────────

export async function likeComment(
  commentId: string,
  userId: string,
  commentAuthorId: string,
  postId: string,
): Promise<void> {
  await supabase.from('comment_likes').insert({ comment_id: commentId, user_id: userId });
  await supabase.rpc('increment_comment_like_count', { p_comment_id: commentId });

  if (userId !== commentAuthorId) {
    await createNotification({
      userId: commentAuthorId,
      type: 'comment_like',
      fromUserId: userId,
      postId,
      message: 'liked your comment',
    });
  }
}

export async function unlikeComment(commentId: string, userId: string): Promise<void> {
  await supabase
    .from('comment_likes')
    .delete()
    .eq('comment_id', commentId)
    .eq('user_id', userId);
  await supabase.rpc('decrement_comment_like_count', { p_comment_id: commentId });
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

// ─── Tagged User Ratings ─────────────────────────────────────────────────────

export async function submitTaggedUserRatings(
  postId: string,
  userId: string,
  dishRatings: { dishName: string; rating: number; notes?: string }[],
): Promise<string[]> {
  const ratingRows = dishRatings
    .filter((r) => r.rating > 0)
    .map((r) => ({
      post_id: postId,
      user_id: userId,
      dish_name: r.dishName,
      rating: r.rating,
      notes: r.notes,
    }));

  if (ratingRows.length === 0) return [];

  const { data, error } = await supabase
    .from('dish_ratings')
    .upsert(ratingRows, { onConflict: 'post_id,user_id,dish_name' })
    .select('id');
  if (error) throw error;

  // Mark tagged friend as rated
  await supabase
    .from('post_tagged_friends')
    .update({ has_rated: true, rated_at: new Date().toISOString() })
    .eq('post_id', postId)
    .eq('user_id', userId);

  return (data ?? []).map((r: { id: string }) => r.id);
}

// ─── Co-diner Photo Contributions ────────────────────────────────────────────

export async function addTaggedUserPhoto(
  postId: string,
  userId: string,
  photoUrl: string,
): Promise<void> {
  const { data } = await supabase
    .from('post_tagged_friends')
    .select('contributed_photos')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .single();

  const existing = (data?.contributed_photos as string[] | null) ?? [];
  await supabase
    .from('post_tagged_friends')
    .update({ contributed_photos: [...existing, photoUrl] })
    .eq('post_id', postId)
    .eq('user_id', userId);
}

// ─── Dish Endorsements ───────────────────────────────────────────────────────

export async function toggleDishEndorsement(
  dishRatingId: string,
  userId: string,
  emoji: string,
): Promise<boolean> {
  // Check if endorsement exists
  const { data: existing } = await supabase
    .from('dish_endorsements')
    .select('id')
    .eq('dish_rating_id', dishRatingId)
    .eq('user_id', userId)
    .single();

  if (existing) {
    await supabase.from('dish_endorsements').delete().eq('id', existing.id);
    return false; // removed
  }

  await supabase.from('dish_endorsements').insert({
    dish_rating_id: dishRatingId,
    user_id: userId,
    emoji,
  });
  return true; // added
}

// ─── Post Credits ───────────────────────────────────────────────────────────

export async function calculatePostCredits(
  postId: string,
): Promise<{
  credits: number;
  breakdown: Record<string, number>;
  streak?: { weeks: number; multiplier: number; bonusCredits: number };
  newTier?: UserTier;
}> {
  const { data, error } = await supabase.functions.invoke('calculate-post-credits', {
    body: { postId },
  });

  if (error) throw new Error(`Credit calculation failed: ${error.message}`);
  return {
    credits: data?.credits ?? 0,
    breakdown: data?.breakdown ?? {},
    streak: data?.streak,
    newTier: data?.newTier as UserTier | undefined,
  };
}

export async function getDishEndorsements(
  dishRatingIds: string[],
): Promise<Record<string, { user_id: string; emoji: string }[]>> {
  if (dishRatingIds.length === 0) return {};

  const { data } = await supabase
    .from('dish_endorsements')
    .select('dish_rating_id, user_id, emoji')
    .in('dish_rating_id', dishRatingIds);

  const result: Record<string, { user_id: string; emoji: string }[]> = {};
  for (const row of data ?? []) {
    const key = row.dish_rating_id as string;
    if (!result[key]) result[key] = [];
    result[key].push({ user_id: row.user_id as string, emoji: row.emoji as string });
  }
  return result;
}
