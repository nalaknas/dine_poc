-- ─── Tagged User Experience ──────────────────────────────────────────────────
-- Enables tagged users to rate dishes, contribute photos, and endorse dishes.

-- 1. Add columns to post_tagged_friends
ALTER TABLE public.post_tagged_friends
  ADD COLUMN IF NOT EXISTS has_rated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rated_at timestamptz,
  ADD COLUMN IF NOT EXISTS contributed_photos text[] NOT NULL DEFAULT '{}';

-- 2. Unique constraint: one rating per user per dish per post
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'dish_ratings_post_user_dish_unique'
  ) THEN
    ALTER TABLE public.dish_ratings
      ADD CONSTRAINT dish_ratings_post_user_dish_unique UNIQUE (post_id, user_id, dish_name);
  END IF;
END $$;

-- 3. Dish endorsements table (emoji reactions on dishes)
CREATE TABLE IF NOT EXISTS public.dish_endorsements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dish_rating_id uuid NOT NULL REFERENCES public.dish_ratings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  emoji text NOT NULL DEFAULT '🔥',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dish_rating_id, user_id)
);

CREATE INDEX IF NOT EXISTS dish_endorsements_rating_id ON public.dish_endorsements (dish_rating_id);

-- 4. RLS for dish_endorsements
ALTER TABLE public.dish_endorsements ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='dish_endorsements' AND policyname='Anyone can view endorsements') THEN
    CREATE POLICY "Anyone can view endorsements" ON public.dish_endorsements FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='dish_endorsements' AND policyname='Users can insert own endorsements') THEN
    CREATE POLICY "Users can insert own endorsements" ON public.dish_endorsements FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='dish_endorsements' AND policyname='Users can delete own endorsements') THEN
    CREATE POLICY "Users can delete own endorsements" ON public.dish_endorsements FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;
