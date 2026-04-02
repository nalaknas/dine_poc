-- Migration: 016_taste_insights.sql
-- Description: Add premium taste insights columns to user_taste_profiles and
--              create RPCs for taste compatibility, dish recommendations, and
--              cuisine breakdown (ENG-58).
-- Created: 2026-03-31

BEGIN;

-- ─── ALTER user_taste_profiles ──────────────────────────────────────────────
-- Add columns for caching GPT-generated insights and aggregated taste data.
-- Using DO block for idempotent column additions.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_taste_profiles'
      AND column_name = 'insights_cache'
  ) THEN
    ALTER TABLE public.user_taste_profiles
      ADD COLUMN insights_cache jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_taste_profiles'
      AND column_name = 'insights_generated_at'
  ) THEN
    ALTER TABLE public.user_taste_profiles
      ADD COLUMN insights_generated_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_taste_profiles'
      AND column_name = 'cuisine_stats'
  ) THEN
    ALTER TABLE public.user_taste_profiles
      ADD COLUMN cuisine_stats jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_taste_profiles'
      AND column_name = 'flavor_profile'
  ) THEN
    ALTER TABLE public.user_taste_profiles
      ADD COLUMN flavor_profile jsonb;
  END IF;
END
$$;

-- ─── RPC: calculate_taste_compatibility ─────────────────────────────────────
-- Returns a 0-100 compatibility score between two users based on cosine
-- similarity of their taste embeddings. Returns NULL if either user has no
-- embedding on file.

CREATE OR REPLACE FUNCTION public.calculate_taste_compatibility(
  user_id_a UUID,
  user_id_b UUID
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_embedding_a vector(1536);
  v_embedding_b vector(1536);
BEGIN
  SELECT embedding INTO v_embedding_a
  FROM public.user_taste_profiles
  WHERE user_id = user_id_a;

  SELECT embedding INTO v_embedding_b
  FROM public.user_taste_profiles
  WHERE user_id = user_id_b;

  -- Return NULL if either user lacks an embedding
  IF v_embedding_a IS NULL OR v_embedding_b IS NULL THEN
    RETURN NULL;
  END IF;

  -- Cosine similarity via pgvector: <=> returns cosine distance (0 = identical)
  -- Convert to 0-100 score: (1 - distance) * 100
  RETURN ROUND((1 - (v_embedding_a <=> v_embedding_b)) * 100, 1);
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_taste_compatibility(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION public.calculate_taste_compatibility IS
  'Returns a 0-100 taste compatibility score between two users using cosine '
  'similarity of their pgvector taste embeddings. Returns NULL if either user '
  'has no embedding.';

-- ─── RPC: get_dish_recommendations ──────────────────────────────────────────
-- Finds dishes the user hasn't rated yet that are highly rated (>= 8.0) by
-- users with the most similar taste profiles. Uses pgvector cosine similarity
-- to identify the top 5 most similar users, then surfaces their best dishes.

CREATE OR REPLACE FUNCTION public.get_dish_recommendations(
  p_user_id UUID,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  dish_name TEXT,
  restaurant_name TEXT,
  city TEXT,
  avg_rating NUMERIC,
  recommender_count BIGINT,
  match_score NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_embedding vector(1536);
BEGIN
  -- Fetch the requesting user's taste embedding
  SELECT embedding INTO v_user_embedding
  FROM public.user_taste_profiles
  WHERE user_id = p_user_id;

  -- If the user has no embedding, return empty result set
  IF v_user_embedding IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH similar_users AS (
    -- Find the top 5 users with the most similar taste profiles
    SELECT
      utp.user_id,
      ROUND((1 - (utp.embedding <=> v_user_embedding)) * 100, 1) AS similarity
    FROM public.user_taste_profiles utp
    WHERE utp.user_id != p_user_id
      AND utp.embedding IS NOT NULL
    ORDER BY utp.embedding <=> v_user_embedding
    LIMIT 5
  ),
  user_rated_dishes AS (
    -- Dishes the target user has already rated (to exclude)
    SELECT DISTINCT dr.dish_name
    FROM public.dish_ratings dr
    WHERE dr.user_id = p_user_id
  )
  SELECT
    dr.dish_name,
    p.restaurant_name,
    p.city,
    ROUND(AVG(dr.rating), 1)         AS avg_rating,
    COUNT(DISTINCT su.user_id)        AS recommender_count,
    ROUND(AVG(su.similarity), 1)     AS match_score
  FROM public.dish_ratings dr
  INNER JOIN similar_users su ON su.user_id = dr.user_id
  INNER JOIN public.posts p ON p.id = dr.post_id
  WHERE dr.rating >= 8.0
    AND dr.dish_name NOT IN (SELECT urd.dish_name FROM user_rated_dishes urd)
  GROUP BY dr.dish_name, p.restaurant_name, p.city
  ORDER BY avg_rating DESC, recommender_count DESC, match_score DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dish_recommendations(UUID, INT) TO authenticated;

COMMENT ON FUNCTION public.get_dish_recommendations IS
  'Recommends dishes the user has not yet rated, sourced from the top 5 users '
  'with the most similar taste embeddings. Only surfaces dishes rated >= 8.0.';

-- ─── RPC: get_cuisine_breakdown ─────────────────────────────────────────────
-- Aggregates a user's dish ratings grouped by the cuisine_type of the parent
-- post. Returns average rating, dish count, and favorite dish per cuisine.

CREATE OR REPLACE FUNCTION public.get_cuisine_breakdown(
  p_user_id UUID
)
RETURNS TABLE (
  cuisine_type TEXT,
  avg_rating NUMERIC,
  dish_count BIGINT,
  favorite_dish TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH rated AS (
    SELECT
      COALESCE(p.cuisine_type, 'Unknown') AS cuisine,
      dr.dish_name,
      dr.rating
    FROM public.dish_ratings dr
    INNER JOIN public.posts p ON p.id = dr.post_id
    WHERE dr.user_id = p_user_id
  ),
  cuisine_agg AS (
    SELECT
      r.cuisine                           AS cuisine_type,
      ROUND(AVG(r.rating), 1)            AS avg_rating,
      COUNT(*)                             AS dish_count
    FROM rated r
    GROUP BY r.cuisine
  ),
  -- Determine favorite dish per cuisine (highest-rated, ties broken by name)
  favorite AS (
    SELECT DISTINCT ON (r.cuisine)
      r.cuisine                           AS cuisine_type,
      r.dish_name                         AS favorite_dish
    FROM rated r
    ORDER BY r.cuisine, r.rating DESC, r.dish_name
  )
  SELECT
    ca.cuisine_type,
    ca.avg_rating,
    ca.dish_count,
    f.favorite_dish
  FROM cuisine_agg ca
  LEFT JOIN favorite f ON f.cuisine_type = ca.cuisine_type
  ORDER BY ca.dish_count DESC, ca.avg_rating DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_cuisine_breakdown(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_cuisine_breakdown IS
  'Returns per-cuisine aggregated stats for a user: average rating, dish count, '
  'and their highest-rated dish in each cuisine category.';

COMMIT;
