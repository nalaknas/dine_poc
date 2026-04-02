-- Migration: 017_restaurant_partnerships.sql
-- Description: Restaurant Partnerships & Perks system (ENG-59).
--              Adds partner restaurants, perks catalog, redemption tracking,
--              and restaurant dashboard accounts. Includes RPCs for eligibility
--              checks and available-perks queries.
-- Created: 2026-03-31

BEGIN;

-- ─── RESTAURANT PARTNERSHIPS ────────────────────────────────────────────────
-- Represents a restaurant that has partnered with Dine.
-- restaurant_name intentionally matches posts.restaurant_name for easy joins.

CREATE TABLE IF NOT EXISTS public.restaurant_partnerships (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_name  text        NOT NULL,
  city             text,
  state            text,
  contact_email    text,
  contact_name     text,
  logo_url         text,
  is_active        boolean     NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_name, city, state)
);

CREATE INDEX IF NOT EXISTS idx_restaurant_partnerships_active
  ON public.restaurant_partnerships (is_active)
  WHERE is_active = TRUE;

-- ─── PARTNER PERKS ──────────────────────────────────────────────────────────
-- Perks offered by partner restaurants (discounts, free items, upgrades, etc.)

CREATE TABLE IF NOT EXISTS public.partner_perks (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  partnership_id  uuid        NOT NULL REFERENCES public.restaurant_partnerships(id) ON DELETE CASCADE,
  title           text        NOT NULL,
  description     text,
  perk_type       text        NOT NULL DEFAULT 'discount'
                              CHECK (perk_type IN ('discount', 'free_item', 'upgrade', 'experience')),
  tier_required   text        NOT NULL DEFAULT 'bronze'
                              CHECK (tier_required IN ('bronze', 'silver', 'gold', 'platinum')),
  uses_per_month  integer     NOT NULL DEFAULT 1,
  is_active       boolean     NOT NULL DEFAULT true,
  valid_from      timestamptz,
  valid_until     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_perks_partnership
  ON public.partner_perks (partnership_id)
  WHERE is_active = TRUE;

-- ─── PERK REDEMPTIONS ───────────────────────────────────────────────────────
-- Tracks when a user redeems a perk; redemption_code is a unique QR token.

CREATE TABLE IF NOT EXISTS public.perk_redemptions (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  perk_id          uuid        NOT NULL REFERENCES public.partner_perks(id) ON DELETE CASCADE,
  user_id          uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  redemption_code  text        NOT NULL UNIQUE,
  status           text        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending', 'redeemed', 'expired')),
  redeemed_at      timestamptz,
  redeemed_by      text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  expires_at       timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_perk_redemptions_user
  ON public.perk_redemptions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_perk_redemptions_perk_status
  ON public.perk_redemptions (perk_id, status);

-- ─── RESTAURANT ACCOUNTS ────────────────────────────────────────────────────
-- Restaurant staff/manager logins for the web dashboard.

CREATE TABLE IF NOT EXISTS public.restaurant_accounts (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  partnership_id  uuid        NOT NULL REFERENCES public.restaurant_partnerships(id) ON DELETE CASCADE,
  email           text        NOT NULL UNIQUE,
  role            text        NOT NULL DEFAULT 'manager'
                              CHECK (role IN ('manager', 'staff')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ─── RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE public.restaurant_partnerships  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_perks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perk_redemptions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_accounts      ENABLE ROW LEVEL SECURITY;

-- restaurant_partnerships: public catalog, any authenticated user can browse
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can view partnerships' AND tablename = 'restaurant_partnerships') THEN
    CREATE POLICY "Authenticated users can view partnerships"
      ON public.restaurant_partnerships FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- partner_perks: authenticated users can see active, non-expired perks
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can view active perks' AND tablename = 'partner_perks') THEN
    CREATE POLICY "Authenticated users can view active perks"
      ON public.partner_perks FOR SELECT
      TO authenticated
      USING (
        is_active = TRUE
        AND (valid_until IS NULL OR valid_until > now())
      );
  END IF;
END $$;

-- perk_redemptions: users can only see their own redemptions
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own redemptions' AND tablename = 'perk_redemptions') THEN
    CREATE POLICY "Users can view own redemptions"
      ON public.perk_redemptions FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- perk_redemptions: users can insert their own redemptions
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can create own redemptions' AND tablename = 'perk_redemptions') THEN
    CREATE POLICY "Users can create own redemptions"
      ON public.perk_redemptions FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- restaurant_accounts: users can only see their own account row
-- (matched via Supabase auth email — the account email must match auth.email())
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Restaurant accounts can view own record' AND tablename = 'restaurant_accounts') THEN
    CREATE POLICY "Restaurant accounts can view own record"
      ON public.restaurant_accounts FOR SELECT
      TO authenticated
      USING (auth.email() = email);
  END IF;
END $$;

-- ─── RPC: check_perk_eligibility ────────────────────────────────────────────
-- Checks whether a user meets the tier requirement for a perk and hasn't
-- exceeded their monthly usage limit.  Returns eligibility status with reason.

CREATE OR REPLACE FUNCTION public.check_perk_eligibility(
  p_user_id  uuid,
  p_perk_id  uuid
)
RETURNS TABLE (
  is_eligible     boolean,
  reason          text,
  uses_remaining  bigint,
  max_uses        integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_tier      text;
  v_tier_required  text;
  v_uses_per_month integer;
  v_perk_active    boolean;
  v_valid_until    timestamptz;
  v_partnership_active boolean;
  v_used           bigint;
  -- Tier ordering for comparison (higher = better)
  v_tier_rank      integer;
  v_required_rank  integer;
BEGIN
  -- 1. Look up user's current tier
  SELECT u.current_tier INTO v_user_tier
  FROM public.users u
  WHERE u.id = p_user_id;

  IF v_user_tier IS NULL THEN
    RETURN QUERY SELECT false, 'User not found'::text, 0::bigint, 0;
    RETURN;
  END IF;

  -- 2. Look up perk details + partnership status
  SELECT pp.tier_required, pp.uses_per_month, pp.is_active, pp.valid_until, rp.is_active
  INTO   v_tier_required, v_uses_per_month, v_perk_active, v_valid_until, v_partnership_active
  FROM   public.partner_perks pp
  JOIN   public.restaurant_partnerships rp ON rp.id = pp.partnership_id
  WHERE  pp.id = p_perk_id;

  IF v_tier_required IS NULL THEN
    RETURN QUERY SELECT false, 'Perk not found'::text, 0::bigint, 0;
    RETURN;
  END IF;

  -- 3. Check partnership and perk are active
  IF NOT v_partnership_active THEN
    RETURN QUERY SELECT false, 'Partnership is no longer active'::text, (v_uses_per_month)::bigint, v_uses_per_month;
    RETURN;
  END IF;

  IF NOT v_perk_active THEN
    RETURN QUERY SELECT false, 'Perk is no longer active'::text, (v_uses_per_month)::bigint, v_uses_per_month;
    RETURN;
  END IF;

  -- 4. Check perk hasn't expired
  IF v_valid_until IS NOT NULL AND v_valid_until <= now() THEN
    RETURN QUERY SELECT false, 'Perk has expired'::text, (v_uses_per_month)::bigint, v_uses_per_month;
    RETURN;
  END IF;

  -- 5. Tier comparison: bronze(1) < silver(2) < gold(3) < platinum(4)
  v_tier_rank := CASE v_user_tier
    WHEN 'platinum' THEN 4
    WHEN 'gold'     THEN 3
    WHEN 'silver'   THEN 2
    WHEN 'bronze'   THEN 1
    ELSE                 0  -- rock or unknown
  END;

  v_required_rank := CASE v_tier_required
    WHEN 'platinum' THEN 4
    WHEN 'gold'     THEN 3
    WHEN 'silver'   THEN 2
    WHEN 'bronze'   THEN 1
    ELSE                 0
  END;

  IF v_tier_rank < v_required_rank THEN
    RETURN QUERY SELECT
      false,
      format('Requires %s tier (you are %s)', v_tier_required, v_user_tier),
      0::bigint,
      v_uses_per_month;
    RETURN;
  END IF;

  -- 6. Count redemptions this calendar month (any status counts against limit)
  SELECT COUNT(*) INTO v_used
  FROM public.perk_redemptions pr
  WHERE pr.user_id = p_user_id
    AND pr.perk_id = p_perk_id
    AND pr.created_at >= date_trunc('month', now());

  IF v_used >= v_uses_per_month THEN
    RETURN QUERY SELECT
      false,
      format('Monthly limit reached (%s/%s uses)', v_used, v_uses_per_month),
      0::bigint,
      v_uses_per_month;
    RETURN;
  END IF;

  -- All checks passed — return remaining = max - used
  RETURN QUERY SELECT true, 'Eligible'::text, (v_uses_per_month - v_used)::bigint, v_uses_per_month;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_perk_eligibility(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.check_perk_eligibility IS
  'Checks if a user meets the tier requirement for a perk and has not exceeded '
  'their monthly usage limit. Returns eligibility boolean, reason text, current '
  'month usage count, and max allowed uses.';

-- ─── RPC: get_available_perks ───────────────────────────────────────────────
-- Returns perks available to a user based on their tier, optionally filtered
-- by city.  Includes remaining uses for the current month.

CREATE OR REPLACE FUNCTION public.get_available_perks(
  p_user_id  uuid,
  p_city     text DEFAULT NULL
)
RETURNS TABLE (
  id              uuid,
  partnership_id  uuid,
  title           text,
  description     text,
  perk_type       text,
  tier_required   text,
  uses_per_month  integer,
  is_active       boolean,
  valid_from      timestamptz,
  valid_until     timestamptz,
  created_at      timestamptz,
  restaurant_name text,
  city            text,
  uses_remaining  integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_tier  text;
  v_tier_rank  integer;
BEGIN
  -- Look up the user's current tier
  SELECT u.current_tier INTO v_user_tier
  FROM public.users u
  WHERE u.id = p_user_id;

  IF v_user_tier IS NULL THEN
    RETURN;  -- no rows if user not found
  END IF;

  v_tier_rank := CASE v_user_tier
    WHEN 'platinum' THEN 4
    WHEN 'gold'     THEN 3
    WHEN 'silver'   THEN 2
    WHEN 'bronze'   THEN 1
    ELSE                 0
  END;

  RETURN QUERY
  SELECT
    pp.id,
    pp.partnership_id,
    pp.title,
    pp.description,
    pp.perk_type,
    pp.tier_required,
    pp.uses_per_month,
    pp.is_active,
    pp.valid_from,
    pp.valid_until,
    pp.created_at,
    rp.restaurant_name,
    rp.city,
    -- uses_remaining = max - used this month (floor at 0)
    GREATEST(
      pp.uses_per_month - COALESCE(used.cnt, 0)::integer,
      0
    )::integer AS uses_remaining
  FROM public.partner_perks pp
  JOIN public.restaurant_partnerships rp ON rp.id = pp.partnership_id
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::integer AS cnt
    FROM public.perk_redemptions pr
    WHERE pr.user_id  = p_user_id
      AND pr.perk_id  = pp.id
      AND pr.created_at >= date_trunc('month', now())
  ) used ON true
  WHERE rp.is_active = TRUE
    AND pp.is_active = TRUE
    AND (pp.valid_until IS NULL OR pp.valid_until > now())
    AND (pp.valid_from IS NULL OR pp.valid_from <= now())
    -- Tier filter: user must meet or exceed the required tier
    AND (CASE pp.tier_required
           WHEN 'platinum' THEN 4
           WHEN 'gold'     THEN 3
           WHEN 'silver'   THEN 2
           WHEN 'bronze'   THEN 1
           ELSE                 0
         END) <= v_tier_rank
    -- Optional city filter
    AND (p_city IS NULL OR LOWER(rp.city) = LOWER(p_city))
  ORDER BY pp.tier_required DESC, pp.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_available_perks(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.get_available_perks IS
  'Returns perks available to a user based on their tier and optional city filter. '
  'Includes uses_remaining for the current calendar month. Only active perks from '
  'active partnerships within their validity window are returned.';

COMMIT;
