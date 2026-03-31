-- Add is_quick_post flag to posts table for low-friction posting flow
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS is_quick_post boolean NOT NULL DEFAULT false;
