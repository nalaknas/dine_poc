import { supabase } from '../lib/supabase';
import type { LeaderboardEntry, LeaderboardTimePeriod } from '../types';

interface FetchLeaderboardParams {
  city?: string;
  cuisine?: string;
  period?: LeaderboardTimePeriod;
  limit?: number;
}

/**
 * Fetches the restaurant leaderboard via the get_leaderboard RPC function.
 * Returns ranked restaurants with composite scores and top dishes.
 */
export async function fetchLeaderboard(
  params: FetchLeaderboardParams = {},
): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase.rpc('get_leaderboard', {
    p_city: params.city ?? null,
    p_cuisine: params.cuisine ?? null,
    p_period: params.period ?? 'month',
    p_limit: params.limit ?? 10,
  });

  if (error) throw new Error(`Leaderboard fetch failed: ${error.message}`);

  return ((data as Record<string, unknown>[]) ?? []).map((row) => ({
    rank: Number(row.rank),
    restaurant_name: String(row.restaurant_name),
    city: String(row.city ?? ''),
    state: row.state ? String(row.state) : undefined,
    cuisine_type: row.cuisine_type ? String(row.cuisine_type) : undefined,
    avg_rating: Number(row.avg_rating),
    post_count: Number(row.post_count),
    unique_visitors: Number(row.unique_visitors),
    leaderboard_score: Number(row.leaderboard_score),
    top_dishes: Array.isArray(row.top_dishes)
      ? (row.top_dishes as Record<string, unknown>[]).map((d) => ({
          dish_name: String(d.dish_name),
          avg_rating: Number(d.avg_rating),
          mention_count: Number(d.mention_count),
        }))
      : [],
  }));
}

/**
 * Fetches distinct cities from public posts for the leaderboard city filter.
 */
export async function fetchLeaderboardCities(): Promise<string[]> {
  const { data, error } = await supabase
    .from('posts')
    .select('city')
    .eq('is_public', true)
    .not('city', 'is', null)
    .order('city', { ascending: true });

  if (error) throw new Error(`Cities fetch failed: ${error.message}`);

  const unique = [...new Set(
    (data ?? [])
      .map((row: { city: string }) => row.city)
      .filter(Boolean),
  )];

  return unique;
}
