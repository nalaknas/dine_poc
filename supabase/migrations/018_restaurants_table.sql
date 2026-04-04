-- Migration: 018_restaurants_table.sql
-- Description: Master restaurants table with PostGIS, trigram search, and FK
--              columns on related tables. (ENG-80)
-- Created: 2026-04-04

BEGIN;

-- ─── EXTENSIONS ─────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS postgis SCHEMA public;

-- ─── RESTAURANTS TABLE ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.restaurants (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text        NOT NULL,
  google_place_id  text        UNIQUE,
  yelp_id          text,
  address          text,
  city             text,
  state            text,
  lat              numeric(10,7),
  lng              numeric(10,7),
  location         geography(Point, 4326),
  cuisine_type     text,
  price_range      integer     CHECK (price_range >= 1 AND price_range <= 4),
  phone            text,
  website          text,
  hours            jsonb,
  photo_url        text,
  google_rating    numeric(2,1),
  yelp_rating      numeric(2,1),
  post_count       integer     NOT NULL DEFAULT 0,
  is_claimed       boolean     NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  -- Deduplication constraint: same name + city + state = same restaurant
  UNIQUE (name, city, state)
);

-- Trigram index for fuzzy name search
CREATE INDEX IF NOT EXISTS idx_restaurants_name_trgm
  ON public.restaurants USING gin (name gin_trgm_ops);

-- Spatial index for nearby restaurant queries
CREATE INDEX IF NOT EXISTS idx_restaurants_location
  ON public.restaurants USING gist (location);

-- Lookup by external IDs
CREATE INDEX IF NOT EXISTS idx_restaurants_google_place_id
  ON public.restaurants (google_place_id) WHERE google_place_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_restaurants_yelp_id
  ON public.restaurants (yelp_id) WHERE yelp_id IS NOT NULL;

-- City + cuisine for filtered browsing
CREATE INDEX IF NOT EXISTS idx_restaurants_city_cuisine
  ON public.restaurants (city, cuisine_type);

-- Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION public.update_restaurants_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_restaurants_updated_at
  BEFORE UPDATE ON public.restaurants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_restaurants_updated_at();

-- Auto-populate geography column from lat/lng on insert or update
CREATE OR REPLACE FUNCTION public.restaurants_sync_location()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
    NEW.location = ST_SetSRID(ST_MakePoint(NEW.lng::float, NEW.lat::float), 4326)::geography;
  ELSE
    NEW.location = NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_restaurants_sync_location
  BEFORE INSERT OR UPDATE OF lat, lng ON public.restaurants
  FOR EACH ROW
  EXECUTE FUNCTION public.restaurants_sync_location();

-- ─── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view restaurants"
  ON public.restaurants FOR SELECT
  TO authenticated
  USING (true);

-- Only service role / Edge Functions can write restaurants
-- (no INSERT/UPDATE/DELETE policies for authenticated — writes go through
-- data pipeline scripts or Edge Functions using the service role key)

-- ─── ADD restaurant_id FK TO EXISTING TABLES ────────────────────────────────

-- posts
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS restaurant_id uuid REFERENCES public.restaurants(id);

CREATE INDEX IF NOT EXISTS idx_posts_restaurant_id
  ON public.posts (restaurant_id) WHERE restaurant_id IS NOT NULL;

-- playlist_restaurants
ALTER TABLE public.playlist_restaurants
  ADD COLUMN IF NOT EXISTS restaurant_id uuid REFERENCES public.restaurants(id);

CREATE INDEX IF NOT EXISTS idx_playlist_restaurants_restaurant_id
  ON public.playlist_restaurants (restaurant_id) WHERE restaurant_id IS NOT NULL;

-- post_engagements
ALTER TABLE public.post_engagements
  ADD COLUMN IF NOT EXISTS restaurant_id uuid REFERENCES public.restaurants(id);

CREATE INDEX IF NOT EXISTS idx_post_engagements_restaurant_id
  ON public.post_engagements (restaurant_id) WHERE restaurant_id IS NOT NULL;

-- restaurant_partnerships
ALTER TABLE public.restaurant_partnerships
  ADD COLUMN IF NOT EXISTS restaurant_id uuid REFERENCES public.restaurants(id);

CREATE INDEX IF NOT EXISTS idx_restaurant_partnerships_restaurant_id
  ON public.restaurant_partnerships (restaurant_id) WHERE restaurant_id IS NOT NULL;

COMMIT;
