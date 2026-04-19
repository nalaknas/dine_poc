-- Migration: 014_post_engagements.sql
-- Description: Restaurant Visit Attribution Tracking (ENG-53)
-- Creates the post_engagements table to track when users engage with posts
-- (like, comment, bookmark) so we can attribute future restaurant visits
-- back to the post author who influenced them.
-- Created: 2026-03-31

BEGIN;

-- ─── POST ENGAGEMENTS TABLE ─────────────────────────────────────────────────
-- Records each engagement a user has with a post, denormalised with
-- restaurant_name and post_author_id for fast attribution queries.
-- Rows are created/deleted exclusively by DB triggers — no direct client writes.

CREATE TABLE IF NOT EXISTS public.post_engagements (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  post_id         uuid        NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  post_author_id  uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  restaurant_name text        NOT NULL,
  engagement_type text        NOT NULL CHECK (engagement_type IN ('like', 'comment', 'bookmark')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, post_id, engagement_type)
);

-- For attribution lookups: "which restaurants has user X engaged with recently?"
CREATE INDEX IF NOT EXISTS idx_post_engagements_attribution
  ON public.post_engagements (user_id, restaurant_name, created_at DESC);

-- For credit queries: "which authors influenced visits to restaurant Y?"
CREATE INDEX IF NOT EXISTS idx_post_engagements_author
  ON public.post_engagements (post_author_id, restaurant_name);

-- ─── RLS ────────────────────────────────────────────────────────────────────
-- Users can only read their own engagement rows.
-- No INSERT/UPDATE/DELETE policies — writes happen via SECURITY DEFINER triggers.

ALTER TABLE public.post_engagements ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='post_engagements' AND policyname='Users can view own engagements') THEN
    CREATE POLICY "Users can view own engagements"
      ON public.post_engagements FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- ─── TRIGGER FUNCTION: likes → post_engagements ────────────────────────────
-- On INSERT into likes: create a 'like' engagement row if the post has a
-- restaurant_name. On DELETE: remove the corresponding engagement.

CREATE OR REPLACE FUNCTION public.handle_like_engagement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author_id       uuid;
  v_restaurant_name text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Fetch post details
    SELECT p.author_id, p.restaurant_name
      INTO v_author_id, v_restaurant_name
      FROM public.posts p
     WHERE p.id = NEW.post_id;

    -- Skip if post has no restaurant_name
    IF v_restaurant_name IS NULL OR v_restaurant_name = '' THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.post_engagements (user_id, post_id, post_author_id, restaurant_name, engagement_type)
    VALUES (NEW.user_id, NEW.post_id, v_author_id, v_restaurant_name, 'like')
    ON CONFLICT (user_id, post_id, engagement_type) DO NOTHING;

    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM public.post_engagements
     WHERE user_id = OLD.user_id
       AND post_id = OLD.post_id
       AND engagement_type = 'like';

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_like_engagement ON public.likes;
CREATE TRIGGER trg_like_engagement
  AFTER INSERT OR DELETE ON public.likes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_like_engagement();

-- ─── TRIGGER FUNCTION: comments → post_engagements ─────────────────────────
-- On INSERT into comments: create a 'comment' engagement row.
-- On DELETE: remove it.
-- Note: comments use author_id (not user_id) as the commenter column.

CREATE OR REPLACE FUNCTION public.handle_comment_engagement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_author_id  uuid;
  v_restaurant_name text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT p.author_id, p.restaurant_name
      INTO v_post_author_id, v_restaurant_name
      FROM public.posts p
     WHERE p.id = NEW.post_id;

    IF v_restaurant_name IS NULL OR v_restaurant_name = '' THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.post_engagements (user_id, post_id, post_author_id, restaurant_name, engagement_type)
    VALUES (NEW.author_id, NEW.post_id, v_post_author_id, v_restaurant_name, 'comment')
    ON CONFLICT (user_id, post_id, engagement_type) DO NOTHING;

    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM public.post_engagements
     WHERE user_id = OLD.author_id
       AND post_id = OLD.post_id
       AND engagement_type = 'comment';

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_comment_engagement ON public.comments;
CREATE TRIGGER trg_comment_engagement
  AFTER INSERT OR DELETE ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_comment_engagement();

-- ─── TRIGGER FUNCTION: playlist_restaurants → post_engagements (bookmark) ──
-- When a restaurant is added to a playlist, find all public posts with a
-- matching restaurant_name (case-insensitive). For each distinct author
-- (excluding the bookmarking user), insert a 'bookmark' engagement using
-- the most recent post per author. On DELETE, remove bookmark engagements
-- for that restaurant/user combo.
--
-- playlist_restaurants has no direct user_id — we JOIN through playlists.

CREATE OR REPLACE FUNCTION public.handle_bookmark_engagement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id         uuid;
  v_restaurant_name text;
  r                 record;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Resolve the playlist owner
    SELECT pl.user_id INTO v_user_id
      FROM public.playlists pl
     WHERE pl.id = NEW.playlist_id;

    v_restaurant_name := NEW.restaurant_name;

    IF v_restaurant_name IS NULL OR v_restaurant_name = '' THEN
      RETURN NEW;
    END IF;

    -- For each distinct post author with a public post matching this
    -- restaurant, pick the most recent post and create an engagement row.
    FOR r IN
      SELECT DISTINCT ON (p.author_id)
             p.author_id AS post_author_id,
             p.id         AS post_id
        FROM public.posts p
       WHERE lower(p.restaurant_name) = lower(v_restaurant_name)
         AND p.is_public = true
         AND p.author_id <> v_user_id
       ORDER BY p.author_id, p.created_at DESC
    LOOP
      INSERT INTO public.post_engagements (user_id, post_id, post_author_id, restaurant_name, engagement_type)
      VALUES (v_user_id, r.post_id, r.post_author_id, v_restaurant_name, 'bookmark')
      ON CONFLICT (user_id, post_id, engagement_type) DO NOTHING;
    END LOOP;

    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    -- Resolve the playlist owner
    SELECT pl.user_id INTO v_user_id
      FROM public.playlists pl
     WHERE pl.id = OLD.playlist_id;

    -- Remove all bookmark engagements this user created for this restaurant
    DELETE FROM public.post_engagements
     WHERE user_id = v_user_id
       AND engagement_type = 'bookmark'
       AND lower(restaurant_name) = lower(OLD.restaurant_name);

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_bookmark_engagement ON public.playlist_restaurants;
CREATE TRIGGER trg_bookmark_engagement
  AFTER INSERT OR DELETE ON public.playlist_restaurants
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_bookmark_engagement();

COMMIT;
