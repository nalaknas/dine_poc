-- Migration: 018_group_dining.sql
-- Description: Group Dining Coordination (ENG-57).
--              Adds dining plans, plan membership, restaurant candidates with
--              voting, date/time proposals with voting, and RPCs for fetching
--              a user's plans and vote tallies.
-- Created: 2026-03-31

BEGIN;

-- ─── DINING PLANS ───────────────────────────────────────────────────────────
-- A group dinner plan created by a host. Progresses through a status workflow:
-- inviting → voting → scheduling → confirmed → completed/cancelled.

CREATE TABLE IF NOT EXISTS public.dining_plans (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id                 uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title                   text        NOT NULL,
  status                  text        NOT NULL DEFAULT 'inviting'
                                      CHECK (status IN ('inviting', 'voting', 'scheduling', 'confirmed', 'completed', 'cancelled')),
  chosen_restaurant_name  text,
  chosen_restaurant_city  text,
  chosen_date             timestamptz,
  notes                   text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dining_plans_host
  ON public.dining_plans (host_id, status);

-- ─── DINING PLAN MEMBERS ────────────────────────────────────────────────────
-- Tracks who is invited to / participating in a dining plan.

CREATE TABLE IF NOT EXISTS public.dining_plan_members (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id      uuid        NOT NULL REFERENCES public.dining_plans(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role         text        NOT NULL DEFAULT 'member'
                           CHECK (role IN ('host', 'member')),
  status       text        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'accepted', 'declined')),
  responded_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_dining_plan_members_user
  ON public.dining_plan_members (user_id, status);

CREATE INDEX IF NOT EXISTS idx_dining_plan_members_plan
  ON public.dining_plan_members (plan_id);

-- ─── DINING PLAN RESTAURANTS ────────────────────────────────────────────────
-- Restaurant candidates added for group voting. Can come from manual
-- suggestions, AI recommendations, or a user's wishlist/playlist.

CREATE TABLE IF NOT EXISTS public.dining_plan_restaurants (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id          uuid        NOT NULL REFERENCES public.dining_plans(id) ON DELETE CASCADE,
  restaurant_name  text        NOT NULL,
  city             text,
  state            text,
  cuisine_type     text,
  source           text        NOT NULL DEFAULT 'suggestion'
                               CHECK (source IN ('suggestion', 'recommendation', 'wishlist')),
  suggested_by     uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, restaurant_name, city)
);

-- ─── RESTAURANT VOTES ───────────────────────────────────────────────────────
-- Upvote (true) or downvote (false) on a restaurant candidate.

CREATE TABLE IF NOT EXISTS public.restaurant_votes (
  id                  uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_restaurant_id  uuid    NOT NULL REFERENCES public.dining_plan_restaurants(id) ON DELETE CASCADE,
  user_id             uuid    NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  vote                boolean NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_restaurant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_restaurant_votes_restaurant
  ON public.restaurant_votes (plan_restaurant_id);

-- ─── DINING PLAN DATE OPTIONS ───────────────────────────────────────────────
-- Proposed date/time slots that members can vote on.

CREATE TABLE IF NOT EXISTS public.dining_plan_date_options (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id        uuid        NOT NULL REFERENCES public.dining_plans(id) ON DELETE CASCADE,
  proposed_date  timestamptz NOT NULL,
  proposed_by    uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ─── DATE VOTES ─────────────────────────────────────────────────────────────
-- Upvote (true) or downvote (false) on a proposed date/time.

CREATE TABLE IF NOT EXISTS public.date_votes (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  date_option_id  uuid    NOT NULL REFERENCES public.dining_plan_date_options(id) ON DELETE CASCADE,
  user_id         uuid    NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  vote            boolean NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (date_option_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_date_votes_option
  ON public.date_votes (date_option_id);

-- ─── RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE public.dining_plans              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dining_plan_members       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dining_plan_restaurants   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_votes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dining_plan_date_options  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.date_votes                ENABLE ROW LEVEL SECURITY;

-- Helper: checks if a user is a member (any status) of a given plan.
-- Used in multiple RLS policies below.
CREATE OR REPLACE FUNCTION public._is_plan_member(p_plan_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.dining_plan_members
    WHERE plan_id = p_plan_id AND user_id = p_user_id
  );
$$;

-- Helper: checks if a user is an accepted member or host of a given plan.
CREATE OR REPLACE FUNCTION public._is_active_plan_member(p_plan_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.dining_plan_members
    WHERE plan_id = p_plan_id
      AND user_id = p_user_id
      AND (role = 'host' OR status = 'accepted')
  );
$$;

-- ── dining_plans policies ───────────────────────────────────────────────────

-- SELECT: host or any member can view their plans
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Plan members can view dining plans' AND tablename = 'dining_plans') THEN
    CREATE POLICY "Plan members can view dining plans"
      ON public.dining_plans FOR SELECT
      TO authenticated
      USING (
        auth.uid() = host_id
        OR public._is_plan_member(id, auth.uid())
      );
  END IF;
END $$;

-- INSERT: any authenticated user can create a plan (must be the host)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can create dining plans' AND tablename = 'dining_plans') THEN
    CREATE POLICY "Users can create dining plans"
      ON public.dining_plans FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = host_id);
  END IF;
END $$;

-- UPDATE: only the host can update their plan
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Host can update dining plans' AND tablename = 'dining_plans') THEN
    CREATE POLICY "Host can update dining plans"
      ON public.dining_plans FOR UPDATE
      TO authenticated
      USING (auth.uid() = host_id)
      WITH CHECK (auth.uid() = host_id);
  END IF;
END $$;

-- ── dining_plan_members policies ────────────────────────────────────────────

-- SELECT: plan members can see the member list
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Plan members can view membership' AND tablename = 'dining_plan_members') THEN
    CREATE POLICY "Plan members can view membership"
      ON public.dining_plan_members FOR SELECT
      TO authenticated
      USING (public._is_plan_member(plan_id, auth.uid()));
  END IF;
END $$;

-- INSERT: only the host can invite members
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Host can add plan members' AND tablename = 'dining_plan_members') THEN
    CREATE POLICY "Host can add plan members"
      ON public.dining_plan_members FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.dining_plans
          WHERE id = plan_id AND host_id = auth.uid()
        )
      );
  END IF;
END $$;

-- UPDATE: members can update their own row (accept/decline)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Members can update own membership' AND tablename = 'dining_plan_members') THEN
    CREATE POLICY "Members can update own membership"
      ON public.dining_plan_members FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ── dining_plan_restaurants policies ────────────────────────────────────────

-- SELECT: plan members can view restaurant candidates
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Plan members can view restaurant candidates' AND tablename = 'dining_plan_restaurants') THEN
    CREATE POLICY "Plan members can view restaurant candidates"
      ON public.dining_plan_restaurants FOR SELECT
      TO authenticated
      USING (public._is_plan_member(plan_id, auth.uid()));
  END IF;
END $$;

-- INSERT: active plan members (host or accepted) can suggest restaurants
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Active members can suggest restaurants' AND tablename = 'dining_plan_restaurants') THEN
    CREATE POLICY "Active members can suggest restaurants"
      ON public.dining_plan_restaurants FOR INSERT
      TO authenticated
      WITH CHECK (public._is_active_plan_member(plan_id, auth.uid()));
  END IF;
END $$;

-- ── restaurant_votes policies ───────────────────────────────────────────────

-- SELECT: plan members can view votes
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Plan members can view restaurant votes' AND tablename = 'restaurant_votes') THEN
    CREATE POLICY "Plan members can view restaurant votes"
      ON public.restaurant_votes FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.dining_plan_restaurants dpr
          WHERE dpr.id = plan_restaurant_id
            AND public._is_plan_member(dpr.plan_id, auth.uid())
        )
      );
  END IF;
END $$;

-- INSERT: members can cast their own votes
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Members can cast restaurant votes' AND tablename = 'restaurant_votes') THEN
    CREATE POLICY "Members can cast restaurant votes"
      ON public.restaurant_votes FOR INSERT
      TO authenticated
      WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
          SELECT 1 FROM public.dining_plan_restaurants dpr
          WHERE dpr.id = plan_restaurant_id
            AND public._is_plan_member(dpr.plan_id, auth.uid())
        )
      );
  END IF;
END $$;

-- UPDATE: members can change their own votes
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Members can update own restaurant votes' AND tablename = 'restaurant_votes') THEN
    CREATE POLICY "Members can update own restaurant votes"
      ON public.restaurant_votes FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ── dining_plan_date_options policies ───────────────────────────────────────

-- SELECT: plan members can view date proposals
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Plan members can view date options' AND tablename = 'dining_plan_date_options') THEN
    CREATE POLICY "Plan members can view date options"
      ON public.dining_plan_date_options FOR SELECT
      TO authenticated
      USING (public._is_plan_member(plan_id, auth.uid()));
  END IF;
END $$;

-- INSERT: active plan members can propose dates
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Active members can propose dates' AND tablename = 'dining_plan_date_options') THEN
    CREATE POLICY "Active members can propose dates"
      ON public.dining_plan_date_options FOR INSERT
      TO authenticated
      WITH CHECK (public._is_active_plan_member(plan_id, auth.uid()));
  END IF;
END $$;

-- ── date_votes policies ─────────────────────────────────────────────────────

-- SELECT: plan members can view date votes
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Plan members can view date votes' AND tablename = 'date_votes') THEN
    CREATE POLICY "Plan members can view date votes"
      ON public.date_votes FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.dining_plan_date_options dpo
          WHERE dpo.id = date_option_id
            AND public._is_plan_member(dpo.plan_id, auth.uid())
        )
      );
  END IF;
END $$;

-- INSERT: members can cast their own date votes
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Members can cast date votes' AND tablename = 'date_votes') THEN
    CREATE POLICY "Members can cast date votes"
      ON public.date_votes FOR INSERT
      TO authenticated
      WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
          SELECT 1 FROM public.dining_plan_date_options dpo
          WHERE dpo.id = date_option_id
            AND public._is_plan_member(dpo.plan_id, auth.uid())
        )
      );
  END IF;
END $$;

-- UPDATE: members can change their own date votes
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Members can update own date votes' AND tablename = 'date_votes') THEN
    CREATE POLICY "Members can update own date votes"
      ON public.date_votes FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ─── RPC: get_my_dining_plans ───────────────────────────────────────────────
-- Returns all dining plans where the user is a host or member, with member
-- count and basic info. Ordered by most recently updated first.

CREATE OR REPLACE FUNCTION public.get_my_dining_plans(p_user_id uuid)
RETURNS TABLE (
  id                      uuid,
  host_id                 uuid,
  title                   text,
  status                  text,
  chosen_restaurant_name  text,
  chosen_restaurant_city  text,
  chosen_date             timestamptz,
  notes                   text,
  created_at              timestamptz,
  updated_at              timestamptz,
  member_count            bigint,
  accepted_count          bigint,
  user_role               text,
  user_status             text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dp.id,
    dp.host_id,
    dp.title,
    dp.status,
    dp.chosen_restaurant_name,
    dp.chosen_restaurant_city,
    dp.chosen_date,
    dp.notes,
    dp.created_at,
    dp.updated_at,
    -- Total member count (including host)
    (SELECT COUNT(*) FROM public.dining_plan_members m WHERE m.plan_id = dp.id)
      AS member_count,
    -- Accepted member count
    (SELECT COUNT(*) FROM public.dining_plan_members m
     WHERE m.plan_id = dp.id AND (m.status = 'accepted' OR m.role = 'host'))
      AS accepted_count,
    -- Caller's role and status in this plan
    dpm.role  AS user_role,
    dpm.status AS user_status
  FROM public.dining_plans dp
  INNER JOIN public.dining_plan_members dpm
    ON dpm.plan_id = dp.id AND dpm.user_id = p_user_id
  ORDER BY dp.updated_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_dining_plans(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_my_dining_plans IS
  'Returns all dining plans where the given user is a host or member, with '
  'member counts and the caller''s role/status. Ordered by updated_at DESC.';

-- ─── RPC: get_vote_results ──────────────────────────────────────────────────
-- Returns restaurant candidates for a plan with aggregated vote tallies,
-- ordered by net score (upvotes - downvotes) descending.

CREATE OR REPLACE FUNCTION public.get_vote_results(p_plan_id uuid)
RETURNS TABLE (
  restaurant_id    uuid,
  restaurant_name  text,
  city             text,
  state            text,
  cuisine_type     text,
  source           text,
  suggested_by     uuid,
  upvotes          bigint,
  downvotes        bigint,
  net_score        bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify the caller is a member of this plan
  IF NOT EXISTS (
    SELECT 1 FROM public.dining_plan_members
    WHERE plan_id = p_plan_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not a member of this dining plan';
  END IF;

  RETURN QUERY
  SELECT
    dpr.id           AS restaurant_id,
    dpr.restaurant_name,
    dpr.city,
    dpr.state,
    dpr.cuisine_type,
    dpr.source,
    dpr.suggested_by,
    COALESCE(SUM(CASE WHEN rv.vote = true  THEN 1 ELSE 0 END), 0) AS upvotes,
    COALESCE(SUM(CASE WHEN rv.vote = false THEN 1 ELSE 0 END), 0) AS downvotes,
    COALESCE(SUM(CASE WHEN rv.vote = true  THEN 1 ELSE -1 END), 0) AS net_score
  FROM public.dining_plan_restaurants dpr
  LEFT JOIN public.restaurant_votes rv ON rv.plan_restaurant_id = dpr.id
  WHERE dpr.plan_id = p_plan_id
  GROUP BY dpr.id, dpr.restaurant_name, dpr.city, dpr.state,
           dpr.cuisine_type, dpr.source, dpr.suggested_by
  ORDER BY net_score DESC, upvotes DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_vote_results(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_vote_results IS
  'Returns restaurant candidates for a dining plan with vote tallies (upvotes, '
  'downvotes, net score). Caller must be a member of the plan. Ordered by net '
  'score descending.';

COMMIT;
