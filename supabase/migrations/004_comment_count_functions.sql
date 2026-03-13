-- Increment comment count
CREATE OR REPLACE FUNCTION public.increment_comment_count(post_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.posts SET comment_count = comment_count + 1 WHERE id = post_id;
$$;

-- Decrement comment count
CREATE OR REPLACE FUNCTION public.decrement_comment_count(post_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.posts SET comment_count = GREATEST(0, comment_count - 1) WHERE id = post_id;
$$;