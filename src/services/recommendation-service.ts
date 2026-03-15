import { supabase } from '../lib/supabase';
import type { RestaurantRecommendation } from '../types';

type RecommendationMode = 'solo' | 'couple' | 'group';

/**
 * Fetches personalized restaurant recommendations via the Edge Function.
 * Uses pgvector cosine similarity on dish taste embeddings.
 */
export async function getRecommendations(params: {
  userId: string;
  partnerIds?: string[];
  mode?: RecommendationMode;
  city?: string;
  limit?: number;
}): Promise<RestaurantRecommendation[]> {
  const { data, error } = await supabase.functions.invoke('get-recommendations', {
    body: {
      userId: params.userId,
      partnerIds: params.partnerIds ?? [],
      mode: params.mode ?? 'solo',
      city: params.city,
      limit: params.limit ?? 10,
    },
  });

  if (error) throw new Error(`Recommendations failed: ${error.message}`);
  return (data?.recommendations ?? []) as RestaurantRecommendation[];
}

/**
 * Triggers embedding generation for a dish rating.
 * Called after creating a dish rating so the taste profile stays current.
 */
export async function generateDishEmbedding(params: {
  dishRatingId: string;
  dishName: string;
  rating: number;
  notes?: string;
  userId: string;
}): Promise<void> {
  const { error } = await supabase.functions.invoke('generate-embedding', { body: params });
  if (error) throw error;
}

/**
 * Gets the user's current taste profile summary for display.
 */
export async function getTasteProfile(userId: string): Promise<{
  topCuisines: string[];
  totalRatings: number;
  lastUpdated: string | null;
} | null> {
  const { data } = await supabase
    .from('user_taste_profiles')
    .select('total_ratings, last_updated')
    .eq('user_id', userId)
    .single();

  if (!data) return null;

  // Get top-rated cuisine types from the user's posts
  const { data: cuisines } = await supabase
    .from('posts')
    .select('cuisine_type')
    .eq('author_id', userId)
    .not('cuisine_type', 'is', null)
    .order('overall_rating', { ascending: false })
    .limit(10);

  const cuisineCounts: Record<string, number> = {};
  (cuisines ?? []).forEach((p: { cuisine_type: string }) => {
    if (p.cuisine_type) {
      cuisineCounts[p.cuisine_type] = (cuisineCounts[p.cuisine_type] ?? 0) + 1;
    }
  });

  const topCuisines = Object.entries(cuisineCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cuisine]) => cuisine);

  return {
    topCuisines,
    totalRatings: data.total_ratings,
    lastUpdated: data.last_updated,
  };
}
