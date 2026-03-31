-- ─── CREDIT SYSTEM (ENG-39) ─────────────────────────────────────────────────
-- Foundation for the gamification / tier system.
-- credit_events logs every credit transaction; users table gets balance +
-- tier columns.  The add_credits RPC is SECURITY DEFINER so only server-side
-- (service role) callers can mint credits.

-- ─── Tier thresholds (for reference — mirrored in app constants) ────────────
-- Rock      0
-- Bronze    100
-- Silver    500
-- Gold      2 000
-- Platinum  10 000
-- Black     50 000

-- ─── credit_events table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.credit_events (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type          text        NOT NULL
                            CHECK (type IN (
                              'post_quality',
                              'streak',
                              'discovery',
                              'referral',
                              'attribution'
                            )),
  credits       integer     NOT NULL CHECK (credits > 0),
  source_post_id uuid       REFERENCES public.posts(id) ON DELETE SET NULL,
  source_user_id uuid       REFERENCES public.users(id) ON DELETE SET NULL,
  metadata      jsonb       NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS credit_events_user_id   ON public.credit_events (user_id);
CREATE INDEX IF NOT EXISTS credit_events_created   ON public.credit_events (created_at);
CREATE INDEX IF NOT EXISTS credit_events_user_type ON public.credit_events (user_id, type);

-- ─── Add credit columns to users ────────────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS credit_balance integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_tier   text    NOT NULL DEFAULT 'rock',
  ADD COLUMN IF NOT EXISTS streak_weeks   integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_post_week text;

-- ─── RLS on credit_events ───────────────────────────────────────────────────
ALTER TABLE public.credit_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  -- Users can read their own credit events
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own credit_events' AND tablename = 'credit_events') THEN
    CREATE POLICY "Users can view own credit_events"
      ON public.credit_events FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  -- No direct INSERT / UPDATE / DELETE from client — only via service role / RPC
END $$;

-- ─── add_credits RPC ────────────────────────────────────────────────────────
-- Inserts a credit event, updates the user balance, and promotes tier if
-- the new balance crosses a threshold.  Returns the new balance and tier.
CREATE OR REPLACE FUNCTION public.add_credits(
  p_user_id        uuid,
  p_amount         integer,
  p_type           text,
  p_source_post_id uuid   DEFAULT NULL,
  p_source_user_id uuid   DEFAULT NULL,
  p_metadata       jsonb  DEFAULT '{}'
)
RETURNS TABLE (new_balance integer, new_tier text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance integer;
  v_tier    text;
BEGIN
  -- Guard against non-positive amounts
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Credit amount must be positive, got %', p_amount;
  END IF;

  -- Lock the user row to prevent concurrent balance corruption
  PERFORM 1 FROM public.users WHERE id = p_user_id FOR UPDATE;

  -- 1. Insert the credit event
  INSERT INTO public.credit_events (user_id, type, credits, source_post_id, source_user_id, metadata)
  VALUES (p_user_id, p_type, p_amount, p_source_post_id, p_source_user_id, p_metadata);

  -- 2. Update balance
  UPDATE public.users
  SET credit_balance = credit_balance + p_amount
  WHERE id = p_user_id
  RETURNING credit_balance INTO v_balance;

  -- 3. Determine tier based on new balance
  v_tier := CASE
    WHEN v_balance >= 50000 THEN 'black'
    WHEN v_balance >= 10000 THEN 'platinum'
    WHEN v_balance >=  2000 THEN 'gold'
    WHEN v_balance >=   500 THEN 'silver'
    WHEN v_balance >=   100 THEN 'bronze'
    ELSE                         'rock'
  END;

  -- 4. Update tier if it changed
  UPDATE public.users
  SET current_tier = v_tier
  WHERE id = p_user_id
    AND current_tier IS DISTINCT FROM v_tier;

  RETURN QUERY SELECT v_balance, v_tier;
END;
$$;

-- Only service role can call add_credits — prevent client-side credit minting
REVOKE EXECUTE ON FUNCTION public.add_credits FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.add_credits FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.add_credits FROM anon;
