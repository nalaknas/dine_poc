-- Migration: 014_leaderboard_rpc.sql
-- Description: Add get_leaderboard RPC function and supporting indexes for
--              restaurant leaderboards (ENG-54). Computes a composite score from
--              average rating, post count, and unique visitors, with top-dish
--              aggregation per restaurant.
-- Created: 2026-03-31

BEGIN;

-- ─── PERFORMANCE INDEXES ─────────────────────────────────────────────────────
-- Partial indexes on public posts for city and cuisine filtering used by the
-- leaderboard query. The WHERE clause matches the is_public = TRUE filter so
-- Postgres can use index-only scans for the most common leaderboard queries.

CREATE INDEX IF NOT EXISTS idx_posts_city_created
  ON public.posts (city, created_at DESC)
  WHERE is_public = TRUE;

CREATE INDEX IF NOT EXISTS idx_posts_cuisine_created
  ON public.posts (cuisine_type, created_at DESC)
  WHERE is_public = TRUE;

-- ─── LEADERBOARD RPC ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_leaderboard(
  p_city TEXT DEFAULT NULL,
  p_cuisine TEXT DEFAULT NULL,
  p_period TEXT DEFAULT 'month',
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  rank BIGINT,
  restaurant_name TEXT,
  city TEXT,
  state TEXT,
  cuisine_type TEXT,
  avg_rating NUMERIC,
  post_count BIGINT,
  unique_visitors BIGINT,
  leaderboard_score NUMERIC,
  top_dishes JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_since timestamptz;
BEGIN
  -- Determine the time window from p_period
  v_since := CASE p_period
    WHEN 'week'    THEN now() - interval '7 days'
    WHEN 'month'   THEN now() - interval '30 days'
    WHEN 'quarter' THEN now() - interval '90 days'
    WHEN 'year'    THEN now() - interval '365 days'
    ELSE                now() - interval '30 days'  -- default to month
  END;

  RETURN QUERY
  WITH ranked_restaurants AS (
    SELECT
      p.restaurant_name,
      p.city,
      p.state,
      p.cuisine_type,
      ROUND(AVG(p.overall_rating), 1)           AS avg_rating,
      COUNT(*)                                    AS post_count,
      COUNT(DISTINCT p.author_id)                 AS unique_visitors,
      -- Composite score: rating(60%) + post volume(30%, log-scaled) + visitor diversity(10%, log-scaled)
      ROUND(
        (AVG(p.overall_rating) * 0.6) +
        (LN(COUNT(*)::numeric + 1) * 0.3) +
        (LN(COUNT(DISTINCT p.author_id)::numeric + 1) * 0.1),
        2
      )                                           AS leaderboard_score
    FROM public.posts p
    WHERE p.is_public = TRUE
      AND p.created_at >= v_since
      AND p.overall_rating IS NOT NULL
      -- City filter: case-insensitive, skip if NULL
      AND (p_city IS NULL OR LOWER(p.city) = LOWER(p_city))
      -- Cuisine filter: case-insensitive, skip if NULL or 'All'
      AND (p_cuisine IS NULL OR LOWER(p_cuisine) = 'all' OR LOWER(p.cuisine_type) = LOWER(p_cuisine))
    GROUP BY p.restaurant_name, p.city, p.state, p.cuisine_type
    -- Minimum 3 posts to qualify for the leaderboard
    HAVING COUNT(*) >= 3
  ),
  -- Get top 3 dishes per restaurant by average rating from dish_ratings
  top_dish_agg AS (
    SELECT
      rr.restaurant_name,
      rr.city,
      rr.state,
      rr.cuisine_type,
      COALESCE(
        (
          SELECT jsonb_agg(dish_row)
          FROM (
            SELECT jsonb_build_object(
              'dish_name',     dr.dish_name,
              'avg_rating',    ROUND(AVG(dr.rating), 1),
              'mention_count', COUNT(*)
            ) AS dish_row
            FROM public.dish_ratings dr
            INNER JOIN public.posts dp ON dp.id = dr.post_id
            WHERE dp.restaurant_name = rr.restaurant_name
              AND dp.is_public = TRUE
              AND dp.created_at >= v_since
              AND (rr.city IS NULL OR dp.city = rr.city)
              AND (rr.state IS NULL OR dp.state = rr.state)
            GROUP BY dr.dish_name
            ORDER BY AVG(dr.rating) DESC, COUNT(*) DESC
            LIMIT 3
          ) sub
        ),
        '[]'::jsonb
      ) AS top_dishes
    FROM ranked_restaurants rr
  )
  SELECT
    ROW_NUMBER() OVER (
      ORDER BY rr.leaderboard_score DESC, rr.avg_rating DESC
    )                      AS rank,
    rr.restaurant_name,
    rr.city,
    rr.state,
    rr.cuisine_type,
    rr.avg_rating,
    rr.post_count,
    rr.unique_visitors,
    rr.leaderboard_score,
    td.top_dishes
  FROM ranked_restaurants rr
  LEFT JOIN top_dish_agg td
    ON  rr.restaurant_name = td.restaurant_name
    AND (rr.city IS NOT DISTINCT FROM td.city)
    AND (rr.state IS NOT DISTINCT FROM td.state)
    AND (rr.cuisine_type IS NOT DISTINCT FROM td.cuisine_type)
  ORDER BY rr.leaderboard_score DESC, rr.avg_rating DESC
  LIMIT p_limit;
END;
$$;

-- Grant execute to authenticated users and anon (public leaderboard)
GRANT EXECUTE ON FUNCTION public.get_leaderboard(TEXT, TEXT, TEXT, INT) TO authenticated;

COMMENT ON FUNCTION public.get_leaderboard IS
  'Returns ranked restaurant leaderboard with composite score and top dishes. '
  'Filters by city, cuisine, and time period. Minimum 3 posts required to qualify.';

COMMIT;
