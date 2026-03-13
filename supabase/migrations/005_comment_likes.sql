-- ─── COMMENT LIKES ────────────────────────────────────────────────────────────

-- Add like_count to existing comments table
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS like_count integer NOT NULL DEFAULT 0;

-- Comment likes junction table
CREATE TABLE IF NOT EXISTS public.comment_likes (
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  comment_id uuid NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, comment_id)
);

CREATE INDEX IF NOT EXISTS comment_likes_comment_id ON public.comment_likes (comment_id);

-- RLS
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Comment likes viewable by all" ON public.comment_likes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can like comments" ON public.comment_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike their own comment likes" ON public.comment_likes FOR DELETE USING (auth.uid() = user_id);

-- RPC helpers
CREATE OR REPLACE FUNCTION public.increment_comment_like_count(p_comment_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.comments SET like_count = like_count + 1 WHERE id = p_comment_id;
$$;

CREATE OR REPLACE FUNCTION public.decrement_comment_like_count(p_comment_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.comments SET like_count = GREATEST(0, like_count - 1) WHERE id = p_comment_id;
$$;

-- Update notifications type constraint to include 'comment_like'
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('like', 'comment', 'tag', 'follow', 'recommendation', 'comment_like'));