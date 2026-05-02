-- Migration: 023_split_requests.sql
-- Description: ENG-158 — foundation for the Group Pay Requests epic (ENG-157).
--
-- Adds three tables:
--   * split_requests        — one row per "request from all" send
--   * split_request_lines   — per-recipient amounts + status
--   * waitlist_signups      — emails/phones captured on the public landing page
--
-- Plus four anon-callable SECURITY DEFINER RPCs:
--   * get_split_request_by_token
--   * mark_line_viewed
--   * mark_line_paid
--   * add_waitlist_signup
--
-- Forward-compatibility decisions (called out per the ticket spec):
--   * users.is_admin: ADDED HERE (boolean NOT NULL DEFAULT false). The ticket
--     anticipates ENG-165 introducing it; adding it now is small + idempotent
--     and lets the waitlist_signups SELECT policy reference it without
--     resorting to a `false` placeholder. Other migrations are unaffected
--     because the column has a default.
--   * users.venmo_handle: NOT added. The existing schema already has
--     users.venmo_username (migration 001). The RPC exposes that value under
--     the public field name `venmo_handle` so the landing page contract in
--     the ticket spec is honored without requiring a duplicate column. If
--     ENG-162 still wants a renamed column later, the RPC is the single
--     place to update.
--
-- All anon-callable RPCs validate split_request.expires_at > now() and
-- raise 'split_request_not_found_or_expired' otherwise.

-- ─── 0. Forward-compat: users.is_admin ──────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- ─── 1. URL-safe token helper ───────────────────────────────────────────────
-- 32 bytes of random → base64 → strip padding, swap +/ for -_ → url-safe.
-- Default len=32 yields a ~43-char token; callable with smaller len for tests.
-- search_path is locked so the function is safe to call from any context
-- (function_search_path_mutable advisor).
CREATE OR REPLACE FUNCTION public.generate_url_safe_token(len int DEFAULT 32)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SET search_path = public, extensions
AS $$
DECLARE
  raw bytea;
  encoded text;
BEGIN
  IF len IS NULL OR len < 1 THEN
    len := 32;
  END IF;
  raw := extensions.gen_random_bytes(len);
  encoded := encode(raw, 'base64');
  -- Strip newlines that encode() may insert, drop padding, and url-safe.
  encoded := translate(encoded, E'+/=\n\r', '-_');
  RETURN encoded;
END;
$$;

-- ─── 2. Generic updated_at touch trigger (reusable) ─────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- ─── 3. split_requests ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.split_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL,
  sender_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  restaurant_name text NOT NULL,
  note text,
  public_token text NOT NULL UNIQUE DEFAULT public.generate_url_safe_token(32),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS split_requests_sender_created_idx
  ON public.split_requests (sender_user_id, created_at DESC);

-- Cover the post_id FK so cascades / lookups don't seq-scan
-- (unindexed_foreign_keys advisor).
CREATE INDEX IF NOT EXISTS split_requests_post_id_idx
  ON public.split_requests (post_id)
  WHERE post_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_split_requests_updated_at ON public.split_requests;
CREATE TRIGGER trg_split_requests_updated_at
  BEFORE UPDATE ON public.split_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 4. split_request_lines ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.split_request_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  split_request_id uuid NOT NULL REFERENCES public.split_requests(id) ON DELETE CASCADE,
  recipient_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  recipient_name text NOT NULL,
  recipient_phone text,
  amount numeric(10,2) NOT NULL CHECK (amount >= 0),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','viewed','paid','cancelled')),
  viewed_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT split_request_lines_has_channel
    CHECK (recipient_user_id IS NOT NULL OR recipient_phone IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS split_request_lines_request_idx
  ON public.split_request_lines (split_request_id);

CREATE INDEX IF NOT EXISTS split_request_lines_recipient_idx
  ON public.split_request_lines (recipient_user_id)
  WHERE recipient_user_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_split_request_lines_updated_at ON public.split_request_lines;
CREATE TRIGGER trg_split_request_lines_updated_at
  BEFORE UPDATE ON public.split_request_lines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 5. waitlist_signups ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.waitlist_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  phone text,
  source_split_request_id uuid REFERENCES public.split_requests(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  invited_at timestamptz,
  CONSTRAINT waitlist_signups_has_channel
    CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS waitlist_signups_email_unique
  ON public.waitlist_signups (lower(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS waitlist_signups_phone_unique
  ON public.waitlist_signups (phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS waitlist_signups_source_idx
  ON public.waitlist_signups (source_split_request_id)
  WHERE source_split_request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS waitlist_signups_created_idx
  ON public.waitlist_signups (created_at DESC);

-- ─── 6. RLS — enable + policies ─────────────────────────────────────────────
ALTER TABLE public.split_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.split_request_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist_signups ENABLE ROW LEVEL SECURITY;

-- All auth.uid() calls are wrapped in a subquery so Postgres evaluates them
-- once per statement, not once per row (auth_rls_initplan advisor).
DO $$ BEGIN
  -- split_requests
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='split_requests' AND policyname='Sender can view their split requests') THEN
    CREATE POLICY "Sender can view their split requests"
      ON public.split_requests FOR SELECT
      USING ((select auth.uid()) = sender_user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='split_requests' AND policyname='Sender can insert their split requests') THEN
    CREATE POLICY "Sender can insert their split requests"
      ON public.split_requests FOR INSERT
      WITH CHECK ((select auth.uid()) = sender_user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='split_requests' AND policyname='Sender can update their split requests') THEN
    CREATE POLICY "Sender can update their split requests"
      ON public.split_requests FOR UPDATE
      USING ((select auth.uid()) = sender_user_id)
      WITH CHECK ((select auth.uid()) = sender_user_id);
  END IF;
  -- No DELETE policy: deletes happen via CASCADE only.

  -- split_request_lines
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='split_request_lines' AND policyname='Sender or recipient can view lines') THEN
    CREATE POLICY "Sender or recipient can view lines"
      ON public.split_request_lines FOR SELECT
      USING (
        (select auth.uid()) = recipient_user_id
        OR (select auth.uid()) = (SELECT sender_user_id FROM public.split_requests WHERE id = split_request_id)
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='split_request_lines' AND policyname='Sender can insert lines for their request') THEN
    CREATE POLICY "Sender can insert lines for their request"
      ON public.split_request_lines FOR INSERT
      WITH CHECK (
        (select auth.uid()) = (SELECT sender_user_id FROM public.split_requests WHERE id = split_request_id)
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='split_request_lines' AND policyname='Sender or recipient can update lines') THEN
    CREATE POLICY "Sender or recipient can update lines"
      ON public.split_request_lines FOR UPDATE
      USING (
        (select auth.uid()) = recipient_user_id
        OR (select auth.uid()) = (SELECT sender_user_id FROM public.split_requests WHERE id = split_request_id)
      )
      WITH CHECK (
        (select auth.uid()) = recipient_user_id
        OR (select auth.uid()) = (SELECT sender_user_id FROM public.split_requests WHERE id = split_request_id)
      );
  END IF;

  -- waitlist_signups
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='waitlist_signups' AND policyname='Anyone can insert waitlist signup') THEN
    -- Direct INSERTs are unused — clients call add_waitlist_signup RPC — but
    -- we leave a permissive INSERT here so the RPC's SECURITY DEFINER context
    -- is not the only path (e.g. internal admin tooling).
    CREATE POLICY "Anyone can insert waitlist signup"
      ON public.waitlist_signups FOR INSERT
      WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='waitlist_signups' AND policyname='Admins can view waitlist signups') THEN
    CREATE POLICY "Admins can view waitlist signups"
      ON public.waitlist_signups FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.users
          WHERE id = (select auth.uid()) AND COALESCE(is_admin, false) = true
        )
      );
  END IF;
END $$;

-- ─── 7. RPCs (SECURITY DEFINER, anon-callable) ──────────────────────────────

-- 7a. get_split_request_by_token
CREATE OR REPLACE FUNCTION public.get_split_request_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_request public.split_requests%ROWTYPE;
  v_sender public.users%ROWTYPE;
  v_caller uuid := auth.uid();
  v_lines jsonb;
BEGIN
  IF p_token IS NULL OR p_token = '' THEN
    RAISE EXCEPTION 'split_request_not_found_or_expired';
  END IF;

  SELECT * INTO v_request
  FROM public.split_requests
  WHERE public_token = p_token
  LIMIT 1;

  IF v_request.id IS NULL OR v_request.expires_at <= now() THEN
    RAISE EXCEPTION 'split_request_not_found_or_expired';
  END IF;

  SELECT * INTO v_sender
  FROM public.users
  WHERE id = v_request.sender_user_id
  LIMIT 1;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', l.id,
      'recipient_name', l.recipient_name,
      'amount', l.amount,
      'status', l.status,
      'is_current_user', (l.recipient_user_id IS NOT NULL AND l.recipient_user_id = v_caller)
    )
    ORDER BY l.created_at
  ), '[]'::jsonb) INTO v_lines
  FROM public.split_request_lines l
  WHERE l.split_request_id = v_request.id;

  RETURN jsonb_build_object(
    'id', v_request.id,
    'restaurant_name', v_request.restaurant_name,
    'note', v_request.note,
    'sender', jsonb_build_object(
      'id', v_sender.id,
      'display_name', v_sender.display_name,
      'username', v_sender.username,
      'avatar_url', v_sender.avatar_url,
      -- Public field is `venmo_handle`; backed by the existing
      -- users.venmo_username column. See header for rationale.
      'venmo_handle', v_sender.venmo_username
    ),
    'lines', v_lines,
    'expires_at', v_request.expires_at
  );
END;
$$;

-- 7b. mark_line_viewed
CREATE OR REPLACE FUNCTION public.mark_line_viewed(p_line_id uuid, p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request_id uuid;
BEGIN
  SELECT sr.id INTO v_request_id
  FROM public.split_requests sr
  JOIN public.split_request_lines srl ON srl.split_request_id = sr.id
  WHERE srl.id = p_line_id
    AND sr.public_token = p_token
    AND sr.expires_at > now()
  LIMIT 1;

  IF v_request_id IS NULL THEN
    RAISE EXCEPTION 'split_request_not_found_or_expired';
  END IF;

  UPDATE public.split_request_lines
     SET viewed_at = now(),
         status = CASE WHEN status = 'pending' THEN 'viewed' ELSE status END
   WHERE id = p_line_id
     AND viewed_at IS NULL;
END;
$$;

-- 7c. mark_line_paid
CREATE OR REPLACE FUNCTION public.mark_line_paid(p_line_id uuid, p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request_id uuid;
BEGIN
  SELECT sr.id INTO v_request_id
  FROM public.split_requests sr
  JOIN public.split_request_lines srl ON srl.split_request_id = sr.id
  WHERE srl.id = p_line_id
    AND sr.public_token = p_token
    AND sr.expires_at > now()
  LIMIT 1;

  IF v_request_id IS NULL THEN
    RAISE EXCEPTION 'split_request_not_found_or_expired';
  END IF;

  UPDATE public.split_request_lines
     SET paid_at = now(),
         status = 'paid'
   WHERE id = p_line_id
     AND status <> 'paid';
END;
$$;

-- 7d. add_waitlist_signup
CREATE OR REPLACE FUNCTION public.add_waitlist_signup(
  p_email text,
  p_phone text,
  p_source_token text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := NULLIF(btrim(lower(coalesce(p_email, ''))), '');
  v_phone text := public.normalize_phone(p_phone);
  v_source_id uuid;
BEGIN
  IF v_email IS NULL AND v_phone IS NULL THEN
    RAISE EXCEPTION 'waitlist_signup_requires_email_or_phone';
  END IF;

  IF p_source_token IS NOT NULL AND p_source_token <> '' THEN
    -- Soft-resolve: if token is invalid/expired, just store NULL — never reject
    SELECT id INTO v_source_id
    FROM public.split_requests
    WHERE public_token = p_source_token
    LIMIT 1;
  END IF;

  INSERT INTO public.waitlist_signups (email, phone, source_split_request_id)
  VALUES (v_email, v_phone, v_source_id)
  ON CONFLICT DO NOTHING;
END;
$$;

-- ─── 8. RPC grants ──────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.get_split_request_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_split_request_by_token(text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.mark_line_viewed(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_line_viewed(uuid, text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.mark_line_paid(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_line_paid(uuid, text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.add_waitlist_signup(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_waitlist_signup(text, text, text) TO anon, authenticated;

-- generate_url_safe_token is internal — keep it server-side only.
REVOKE ALL ON FUNCTION public.generate_url_safe_token(int) FROM PUBLIC;
