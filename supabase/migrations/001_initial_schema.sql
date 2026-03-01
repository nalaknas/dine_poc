-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── USERS ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  username text UNIQUE NOT NULL,
  display_name text NOT NULL,
  avatar_url text,
  bio text,
  phone_number text,
  venmo_username text,
  city text,
  state text,
  total_meals integer NOT NULL DEFAULT 0,
  restaurants_visited integer NOT NULL DEFAULT 0,
  cities_explored integer NOT NULL DEFAULT 0,
  cuisine_preferences text[] NOT NULL DEFAULT '{}',
  dietary_restrictions text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Fast search on username/display_name
CREATE INDEX IF NOT EXISTS users_username_trgm ON public.users USING gin (username gin_trgm_ops);
CREATE INDEX IF NOT EXISTS users_display_name_trgm ON public.users USING gin (display_name gin_trgm_ops);

-- ─── FOLLOWS ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.follows (
  follower_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id)
);

-- ─── DINING PARTNERS ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dining_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Partner',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, partner_id)
);

-- ─── POSTS ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  restaurant_name text NOT NULL,
  city text,
  state text,
  address text,
  caption text NOT NULL DEFAULT '',
  overall_rating numeric(3,1) CHECK (overall_rating >= 0 AND overall_rating <= 10),
  price_range text CHECK (price_range IN ('$', '$$', '$$$', '$$$$')),
  price_per_person numeric(8,2),
  cuisine_type text,
  tags text[] NOT NULL DEFAULT '{}',
  meal_type text,
  food_photos text[] NOT NULL DEFAULT '{}',
  is_public boolean NOT NULL DEFAULT true,
  meal_date date,
  meal_time time,
  receipt_subtotal numeric(8,2),
  receipt_tax numeric(8,2),
  receipt_tip numeric(8,2),
  receipt_discount numeric(8,2),
  receipt_total numeric(8,2),
  like_count integer NOT NULL DEFAULT 0,
  comment_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS posts_author_id ON public.posts (author_id);
CREATE INDEX IF NOT EXISTS posts_created_at ON public.posts (created_at DESC);
CREATE INDEX IF NOT EXISTS posts_restaurant_trgm ON public.posts USING gin (restaurant_name gin_trgm_ops);

-- ─── DISH RATINGS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dish_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  dish_name text NOT NULL,
  rating numeric(3,1) NOT NULL CHECK (rating >= 0 AND rating <= 10),
  notes text,
  is_star_dish boolean GENERATED ALWAYS AS (rating >= 7) STORED,
  embedding vector(1536),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dish_ratings_post_id ON public.dish_ratings (post_id);
CREATE INDEX IF NOT EXISTS dish_ratings_user_id ON public.dish_ratings (user_id);
CREATE INDEX IF NOT EXISTS dish_ratings_embedding ON public.dish_ratings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ─── POST TAGGED FRIENDS ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.post_tagged_friends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  display_name text NOT NULL,
  username text,
  venmo_username text,
  amount_owed numeric(8,2)
);

CREATE INDEX IF NOT EXISTS post_tagged_friends_post_id ON public.post_tagged_friends (post_id);
CREATE INDEX IF NOT EXISTS post_tagged_friends_user_id ON public.post_tagged_friends (user_id);

-- ─── RECEIPT ITEMS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.receipt_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  name text NOT NULL,
  price numeric(8,2) NOT NULL,
  assigned_to uuid[] NOT NULL DEFAULT '{}'
);

-- ─── LIKES ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.likes (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

-- ─── COMMENTS ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (length(content) > 0 AND length(content) <= 500),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS comments_post_id ON public.comments (post_id);

-- ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('like', 'comment', 'tag', 'follow', 'recommendation')),
  from_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_id ON public.notifications (user_id, is_read);

-- ─── PLAYLISTS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.playlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─── PLAYLIST RESTAURANTS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.playlist_restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id uuid NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  restaurant_name text NOT NULL,
  city text,
  state text,
  cuisine_type text,
  google_place_id text,
  yelp_id text,
  notes text,
  added_at timestamptz NOT NULL DEFAULT now()
);

-- ─── USER TASTE PROFILES (pgvector) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_taste_profiles (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  embedding vector(1536),
  total_ratings integer NOT NULL DEFAULT 0,
  last_updated timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_taste_profiles_embedding ON public.user_taste_profiles USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ─── RPC FUNCTIONS ────────────────────────────────────────────────────────────

-- Increment like count (called by client after inserting a like)
CREATE OR REPLACE FUNCTION public.increment_like_count(post_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.posts SET like_count = like_count + 1 WHERE id = post_id;
$$;

-- Decrement like count (called by client after deleting a like)
CREATE OR REPLACE FUNCTION public.decrement_like_count(post_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.posts SET like_count = GREATEST(0, like_count - 1) WHERE id = post_id;
$$;

-- Update user taste profile embedding (called from Edge Function)
CREATE OR REPLACE FUNCTION public.upsert_taste_profile(
  p_user_id uuid,
  p_embedding vector(1536),
  p_total_ratings integer
)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  INSERT INTO public.user_taste_profiles (user_id, embedding, total_ratings, last_updated)
  VALUES (p_user_id, p_embedding, p_total_ratings, now())
  ON CONFLICT (user_id) DO UPDATE SET
    embedding = EXCLUDED.embedding,
    total_ratings = EXCLUDED.total_ratings,
    last_updated = now();
$$;

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────────

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dining_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dish_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_tagged_friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlist_restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_taste_profiles ENABLE ROW LEVEL SECURITY;

-- USERS policies
CREATE POLICY "Public profiles are viewable by everyone" ON public.users FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.users FOR UPDATE USING (auth.uid() = id);

-- FOLLOWS policies
CREATE POLICY "Anyone can view follows" ON public.follows FOR SELECT USING (true);
CREATE POLICY "Users can manage their own follows" ON public.follows FOR ALL USING (auth.uid() = follower_id);

-- DINING PARTNERS policies
CREATE POLICY "Users can see their own partners" ON public.dining_partners FOR SELECT USING (auth.uid() = user_id OR auth.uid() = partner_id);
CREATE POLICY "Users can manage their own partners" ON public.dining_partners FOR ALL USING (auth.uid() = user_id);

-- POSTS policies
CREATE POLICY "Public posts are viewable by everyone" ON public.posts FOR SELECT USING (is_public = true OR auth.uid() = author_id);
CREATE POLICY "Authenticated users can insert posts" ON public.posts FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Authors can update their posts" ON public.posts FOR UPDATE USING (auth.uid() = author_id);
CREATE POLICY "Authors can delete their posts" ON public.posts FOR DELETE USING (auth.uid() = author_id);

-- DISH RATINGS policies
CREATE POLICY "Public dish ratings are viewable" ON public.dish_ratings FOR SELECT USING (true);
CREATE POLICY "Authors can insert dish ratings" ON public.dish_ratings FOR INSERT WITH CHECK (auth.uid() = user_id);

-- POST TAGGED FRIENDS policies
CREATE POLICY "Tagged friends are viewable for public posts" ON public.post_tagged_friends FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.posts WHERE posts.id = post_id AND (posts.is_public = true OR posts.author_id = auth.uid()))
);
CREATE POLICY "Post authors can insert tagged friends" ON public.post_tagged_friends FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.posts WHERE posts.id = post_id AND posts.author_id = auth.uid())
);

-- RECEIPT ITEMS policies
CREATE POLICY "Receipt items viewable by post author and tagged" ON public.receipt_items FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.posts WHERE posts.id = post_id AND (
      posts.author_id = auth.uid() OR
      EXISTS (SELECT 1 FROM public.post_tagged_friends WHERE post_tagged_friends.post_id = receipt_items.post_id AND post_tagged_friends.user_id = auth.uid())
    )
  )
);
CREATE POLICY "Post authors can insert receipt items" ON public.receipt_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.posts WHERE posts.id = post_id AND posts.author_id = auth.uid())
);

-- LIKES policies
CREATE POLICY "Likes are viewable by everyone" ON public.likes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can like" ON public.likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike their own likes" ON public.likes FOR DELETE USING (auth.uid() = user_id);

-- COMMENTS policies
CREATE POLICY "Comments on public posts are viewable" ON public.comments FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.posts WHERE posts.id = post_id AND (posts.is_public = true OR posts.author_id = auth.uid()))
);
CREATE POLICY "Authenticated users can comment" ON public.comments FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Users can delete their own comments" ON public.comments FOR DELETE USING (auth.uid() = author_id);

-- NOTIFICATIONS policies
CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can insert notifications" ON public.notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

-- PLAYLISTS policies
CREATE POLICY "Public playlists are viewable" ON public.playlists FOR SELECT USING (is_public = true OR auth.uid() = user_id);
CREATE POLICY "Users can manage their own playlists" ON public.playlists FOR ALL USING (auth.uid() = user_id);

-- PLAYLIST RESTAURANTS policies
CREATE POLICY "Playlist restaurants are viewable if playlist is viewable" ON public.playlist_restaurants FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.playlists WHERE playlists.id = playlist_id AND (playlists.is_public = true OR playlists.user_id = auth.uid()))
);
CREATE POLICY "Playlist owners can manage restaurants" ON public.playlist_restaurants FOR ALL USING (
  EXISTS (SELECT 1 FROM public.playlists WHERE playlists.id = playlist_id AND playlists.user_id = auth.uid())
);

-- USER TASTE PROFILES policies
CREATE POLICY "Taste profiles are publicly viewable" ON public.user_taste_profiles FOR SELECT USING (true);
CREATE POLICY "Service can manage taste profiles" ON public.user_taste_profiles FOR ALL USING (true);
