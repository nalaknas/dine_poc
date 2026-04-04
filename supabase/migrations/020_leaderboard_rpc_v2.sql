-- Migration: 020_leaderboard_rpc_v2.sql
-- Description: Update get_leaderboard RPC to join on restaurants table and return
--              restaurant_id for navigation. (ENG-80)
-- Created: 2026-04-04

BEGIN;

CREATE OR REPLACE FUNCTION public.get_leaderboard(
  p_city TEXT DEFAULT NULL,
  p_cuisine TEXT DEFAULT NULL,
  p_period TEXT DEFAULT 'month',
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  rank BIGINT,
  restaurant_id UUID,
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
  v_since := CASE p_period
    WHEN 'week'    THEN now() - interval '7 days'
    WHEN 'month'   THEN now() - interval '30 days'
    WHEN 'quarter' THEN now() - interval '90 days'
    WHEN 'year'    THEN now() - interval '365 days'
    ELSE                now() - interval '30 days'
  END;

  RETURN QUERY
  WITH ranked_restaurants AS (
    SELECT
      p.restaurant_id AS rid,
      r.name          AS restaurant_name,
      r.city,
      r.state,
      COALESCE(r.cuisine_type, p.cuisine_type) AS cuisine_type,
      ROUND(AVG(p.overall_rating), 1)           AS avg_rating,
      COUNT(*)                                    AS post_count,
      COUNT(DISTINCT p.author_id)                 AS unique_visitors,
      ROUND(
        (AVG(p.overall_rating) * 0.6) +
        (LN(COUNT(*)::numeric + 1) * 0.3) +
        (LN(COUNT(DISTINCT p.author_id)::numeric + 1) * 0.1),
        2
      )                                           AS leaderboard_score
    FROM public.posts p
    INNER JOIN public.restaurants r ON r.id = p.restaurant_id
    WHERE p.is_public = TRUE
      AND p.created_at >= v_since
      AND p.overall_rating IS NOT NULL
      AND p.restaurant_id IS NOT NULL
      AND (p_city IS NULL OR LOWER(r.city) = LOWER(p_city))
      AND (p_cuisine IS NULL OR LOWER(p_cuisine) = 'all' OR LOWER(r.cuisine_type) = LOWER(p_cuisine))
    GROUP BY p.restaurant_id, r.name, r.city, r.state, r.cuisine_type, p.cuisine_type
    HAVING COUNT(*) >= 3
  ),
  top_dish_agg AS (
    SELECT
      rr.rid,
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
            WHERE dp.restaurant_id = rr.rid
              AND dp.is_public = TRUE
              AND dp.created_at >= v_since
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
    rr.rid                 AS restaurant_id,
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
  LEFT JOIN top_dish_agg td ON rr.rid = td.rid
  ORDER BY rr.leaderboard_score DESC, rr.avg_rating DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_leaderboard(TEXT, TEXT, TEXT, INT) TO authenticated;

COMMENT ON FUNCTION public.get_leaderboard IS
  'Returns ranked restaurant leaderboard joining on restaurants table. '
  'Returns restaurant_id for direct navigation. Filters by city, cuisine, and time period.';

COMMIT;
