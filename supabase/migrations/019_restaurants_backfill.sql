-- Migration: 019_restaurants_backfill.sql
-- Description: Backfill restaurants table from existing posts and link FK columns.
--              Deduplicates restaurant names case-insensitively. (ENG-80)
-- Created: 2026-04-04

BEGIN;

-- ─── STEP 1: Extract distinct restaurants from posts ───────────��────────────
-- Group by lower(restaurant_name), city, state to deduplicate.
-- Pick the most common casing as the canonical name.

INSERT INTO public.restaurants (name, city, state, cuisine_type, post_count)
SELECT
  -- Use the most frequently used casing of the name
  (
    SELECT p2.restaurant_name
    FROM public.posts p2
    WHERE lower(p2.restaurant_name) = lower_name
      AND (p2.city IS NOT DISTINCT FROM grp.city)
      AND (p2.state IS NOT DISTINCT FROM grp.state)
    GROUP BY p2.restaurant_name
    ORDER BY COUNT(*) DESC
    LIMIT 1
  ) AS name,
  grp.city,
  grp.state,
  -- Pick the most common cuisine_type for this restaurant
  (
    SELECT p3.cuisine_type
    FROM public.posts p3
    WHERE lower(p3.restaurant_name) = lower_name
      AND (p3.city IS NOT DISTINCT FROM grp.city)
      AND (p3.state IS NOT DISTINCT FROM grp.state)
      AND p3.cuisine_type IS NOT NULL
    GROUP BY p3.cuisine_type
    ORDER BY COUNT(*) DESC
    LIMIT 1
  ) AS cuisine_type,
  grp.cnt AS post_count
FROM (
  SELECT
    lower(p.restaurant_name) AS lower_name,
    p.city,
    p.state,
    COUNT(*) AS cnt
  FROM public.posts p
  WHERE p.restaurant_name IS NOT NULL
    AND p.restaurant_name <> ''
  GROUP BY lower(p.restaurant_name), p.city, p.state
) grp
ON CONFLICT (name, city, state) DO UPDATE
  SET post_count = EXCLUDED.post_count;

-- ─── STEP 2: Backfill restaurant_id on posts ───────────────────────────────

UPDATE public.posts p
SET restaurant_id = r.id
FROM public.restaurants r
WHERE lower(p.restaurant_name) = lower(r.name)
  AND (p.city IS NOT DISTINCT FROM r.city)
  AND (p.state IS NOT DISTINCT FROM r.state)
  AND p.restaurant_id IS NULL;

-- ─── STEP 3: Backfill restaurant_id on post_engagements ──��─────────────────

UPDATE public.post_engagements pe
SET restaurant_id = r.id
FROM public.posts p, public.restaurants r
WHERE pe.post_id = p.id
  AND p.restaurant_id = r.id
  AND pe.restaurant_id IS NULL;

-- ─── STEP 4: Backfill restaurant_id on playlist_restaurants ─────────────────

UPDATE public.playlist_restaurants pr
SET restaurant_id = r.id
FROM public.restaurants r
WHERE lower(pr.restaurant_name) = lower(r.name)
  AND (pr.city IS NOT DISTINCT FROM r.city)
  AND (pr.state IS NOT DISTINCT FROM r.state)
  AND pr.restaurant_id IS NULL;

-- ─── STEP 5: Backfill restaurant_id on restaurant_partnerships ──────────────

UPDATE public.restaurant_partnerships rp
SET restaurant_id = r.id
FROM public.restaurants r
WHERE lower(rp.restaurant_name) = lower(r.name)
  AND (rp.city IS NOT DISTINCT FROM r.city)
  AND (rp.state IS NOT DISTINCT FROM r.state)
  AND rp.restaurant_id IS NULL;

COMMIT;
