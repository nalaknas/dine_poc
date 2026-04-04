import { supabase } from '../lib/supabase';
import type { TasteInsight, CuisineDataPoint, DishRecommendation } from '../types';

/** Cache is considered fresh if generated < 24 hours ago AND after the last profile update */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Fetches taste insights for a user, using cached data when fresh.
 * Falls back to the Edge Function to regenerate when stale or missing.
 */
export async function fetchTasteInsights(userId: string): Promise<{
  insights: TasteInsight[];
  insufficientData: boolean;
  ratingsNeeded: number;
}> {
  // Check cache first
  const { data: profile } = await supabase
    .from('user_taste_profiles')
    .select('insights_cache, insights_generated_at, last_updated')
    .eq('user_id', userId)
    .single();

  if (profile?.insights_cache && profile.insights_generated_at) {
    const generatedAt = new Date(profile.insights_generated_at).getTime();
    const lastUpdated = profile.last_updated
      ? new Date(profile.last_updated).getTime()
      : 0;
    const now = Date.now();

    const isFresh = (now - generatedAt) < CACHE_TTL_MS && generatedAt >= lastUpdated;

    if (isFresh) {
      return {
        insights: profile.insights_cache as TasteInsight[],
        insufficientData: false,
        ratingsNeeded: 0,
      };
    }
  }

  // Cache is stale or missing — invoke the Edge Function
  const { data, error } = await supabase.functions.invoke('generate-taste-insights', {
    body: { user_id: userId },
  });

  if (error) throw new Error(`Taste insights failed: ${error.message}`);

  return {
    insights: (data?.insights ?? []) as TasteInsight[],
    insufficientData: data?.insufficient_data ?? false,
    ratingsNeeded: data?.ratings_needed ?? 0,
  };
}

/**
 * Calculates taste compatibility between two users (0-100 score).
 * Returns null if either user lacks a taste embedding.
 */
export async function fetchTasteCompatibility(
  userIdA: string,
  userIdB: string,
): Promise<number | null> {
  const { data, error } = await supabase.rpc('calculate_taste_compatibility', {
    user_id_a: userIdA,
    user_id_b: userIdB,
  });

  if (error) throw new Error(`Compatibility check failed: ${error.message}`);
  return typeof data === 'number' ? data : null;
}

/**
 * Fetches dish recommendations from users with similar taste profiles.
 */
export async function fetchDishRecommendations(
  userId: string,
  limit = 10,
): Promise<DishRecommendation[]> {
  const { data, error } = await supabase.rpc('get_dish_recommendations', {
    p_user_id: userId,
    p_limit: limit,
  });

  if (error) throw new Error(`Dish recommendations failed: ${error.message}`);
  return (data ?? []) as DishRecommendation[];
}

/**
 * Fetches the user's cuisine breakdown — average rating, count, and
 * favorite dish per cuisine type.
 */
export async function fetchCuisineBreakdown(userId: string): Promise<CuisineDataPoint[]> {
  const { data, error } = await supabase.rpc('get_cuisine_breakdown', {
    p_user_id: userId,
  });

  if (error) throw new Error(`Cuisine breakdown failed: ${error.message}`);

  return ((data ?? []) as Array<{
    cuisine_type: string;
    avg_rating: number;
    dish_count: number;
    favorite_dish: string | null;
  }>).map((row) => ({
    cuisineType: row.cuisine_type,
    avgRating: row.avg_rating,
    dishCount: row.dish_count,
    favoriteDish: row.favorite_dish,
  }));
}
