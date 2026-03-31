-- ─── REFERRALS ─────────────────────────────────────────────────────────────
-- Tracks who invited whom (via bill split deep links)
CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  invitee_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'bill_split',
  source_id text,
  credited boolean NOT NULL DEFAULT false,
  credited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(inviter_id, invitee_id)
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own referrals"
  ON public.referrals FOR SELECT
  USING (auth.uid() = inviter_id OR auth.uid() = invitee_id);

-- ─── SPLIT INVITES ────────────────────────────────────────────────────────
-- Persisted split data for deep link landing pages
CREATE TABLE IF NOT EXISTS public.split_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL,
  restaurant_name text NOT NULL,
  meal_date text,
  inviter_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  breakdowns jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.split_invites ENABLE ROW LEVEL SECURITY;

-- Anyone can view split invites (needed for deep link landing)
CREATE POLICY "Split invites are publicly viewable"
  ON public.split_invites FOR SELECT
  USING (true);

CREATE POLICY "Users can create their own split invites"
  ON public.split_invites FOR INSERT
  WITH CHECK (auth.uid() = inviter_id);
