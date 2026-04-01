import { supabase } from '../lib/supabase';
import { getFollowingIds } from './user-service';
import type { FriendVisit } from '../types';

/**
 * Fetches friends (people the current user follows) who have posted about
 * the given restaurant, along with their star dishes and ratings.
 */
export async function getFriendVisits(
  currentUserId: string,
  restaurantName: string,
): Promise<FriendVisit[]> {
  const followingIds = await getFollowingIds(currentUserId);
  if (followingIds.length === 0) return [];

  // Get posts at this restaurant authored by friends
  const { data: posts, error } = await supabase
    .from('posts')
    .select(`
      id,
      author_id,
      overall_rating,
      created_at,
      author:users!posts_author_id_fkey(id, display_name, username, avatar_url),
      dish_ratings(dish_name, rating, is_star_dish)
    `)
    .ilike('restaurant_name', restaurantName.replace(/%/g, '\\%').replace(/_/g, '\\_'))
    .eq('is_public', true)
    .in('author_id', followingIds)
    .order('created_at', { ascending: false });

  if (error || !posts || posts.length === 0) return [];

  // Aggregate by friend
  const friendMap = new Map<string, FriendVisit>();

  for (const post of posts) {
    // Supabase joins can return an object or array depending on the FK cardinality
    const rawAuthor = post.author;
    const author = (Array.isArray(rawAuthor) ? rawAuthor[0] : rawAuthor) as {
      id: string;
      display_name: string;
      username: string;
      avatar_url?: string;
    } | null;
    if (!author) continue;

    const existing = friendMap.get(author.id);
    const starDishes = ((post.dish_ratings ?? []) as {
      dish_name: string;
      rating: number;
      is_star_dish: boolean;
    }[])
      .filter((dr) => dr.is_star_dish || dr.rating >= 8)
      .map((dr) => ({ dishName: dr.dish_name, rating: dr.rating }));

    if (!existing) {
      friendMap.set(author.id, {
        userId: author.id,
        displayName: author.display_name,
        username: author.username,
        avatarUrl: author.avatar_url,
        visitCount: 1,
        latestRating: post.overall_rating as number,
        latestVisitDate: post.created_at as string,
        starDishes,
      });
    } else {
      existing.visitCount += 1;
      // Keep the most recent rating/date
      if ((post.created_at as string) > existing.latestVisitDate) {
        existing.latestRating = post.overall_rating as number;
        existing.latestVisitDate = post.created_at as string;
      }
      // Merge star dishes (deduplicate by name)
      const existingDishNames = new Set(existing.starDishes.map((d) => d.dishName.toLowerCase()));
      for (const dish of starDishes) {
        if (!existingDishNames.has(dish.dishName.toLowerCase())) {
          existing.starDishes.push(dish);
          existingDishNames.add(dish.dishName.toLowerCase());
        }
      }
    }
  }

  // Sort by visit count desc, then by latest visit date desc
  return Array.from(friendMap.values()).sort((a, b) => {
    if (b.visitCount !== a.visitCount) return b.visitCount - a.visitCount;
    return b.latestVisitDate.localeCompare(a.latestVisitDate);
  });
}

/**
 * Lightweight count-only query: how many friends have posted about a restaurant.
 * Used for the badge on PostCard / restaurant cards.
 */
export async function getFriendVisitCount(
  currentUserId: string,
  restaurantName: string,
  followingIds?: string[],
): Promise<number> {
  const ids = followingIds ?? (await getFollowingIds(currentUserId));
  if (ids.length === 0) return 0;

  const { data, error } = await supabase
    .from('posts')
    .select('author_id')
    .ilike('restaurant_name', restaurantName.replace(/%/g, '\\%').replace(/_/g, '\\_'))
    .eq('is_public', true)
    .in('author_id', ids);

  if (error || !data) return 0;

  // Count unique authors
  const uniqueAuthors = new Set(data.map((r: { author_id: string }) => r.author_id));
  return uniqueAuthors.size;
}
