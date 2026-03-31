-- ─── DISCOVERY CREDIT (ENG-42) ──────────────────────────────────────────────
-- Adds is_discoverer flag to posts.  The first user to post about a restaurant
-- earns 15 discovery credits and the flag.  When subsequent unique users post
-- about the same restaurant, the discoverer earns 10 attribution credits
-- (capped at 500 per restaurant).

-- ─── Add is_discoverer column to posts ─────────────────────────────────────
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS is_discoverer boolean NOT NULL DEFAULT false;

-- Unique partial index: only one discoverer per restaurant (case-insensitive).
-- Prevents race condition where two simultaneous first-posters both become discoverers.
CREATE UNIQUE INDEX IF NOT EXISTS posts_one_discoverer_per_restaurant
  ON public.posts (lower(restaurant_name))
  WHERE is_discoverer = true;
