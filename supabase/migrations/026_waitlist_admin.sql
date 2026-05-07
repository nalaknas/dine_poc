-- Migration: 026_waitlist_admin.sql
-- Description: ENG-165 — admin-tool plumbing for the waitlist review screen.
--
--   1. waitlist_signups.dismissed_at — admin-set timestamp meaning "we
--      explicitly looked at this signup and chose NOT to invite". Distinct
--      from invited_at (already exists from 023) so future analytics can
--      tell "didn't invite yet" from "looked at and skipped".
--   2. RLS on waitlist_signups: admins (users.is_admin = true) can UPDATE
--      rows. SELECT was already gated to admins in 023; INSERT stays anon
--      (the public landing form). DELETE intentionally not added — soft
--      dismiss via dismissed_at preserves data.
--   3. Index supporting the default admin view (oldest pending first).
--   4. Flip nalaknas.is_admin = true so the screen has a real admin to
--      gate against on first load. Other accounts stay default-false.

-- 1. Soft-dismiss column
ALTER TABLE public.waitlist_signups
  ADD COLUMN IF NOT EXISTS dismissed_at timestamptz;

-- 2. Admin-update policy
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'waitlist_signups'
      AND policyname = 'Admins can update waitlist signups'
  ) THEN
    CREATE POLICY "Admins can update waitlist signups"
      ON public.waitlist_signups
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM public.users
          WHERE id = (select auth.uid())
            AND COALESCE(is_admin, false) = true
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.users
          WHERE id = (select auth.uid())
            AND COALESCE(is_admin, false) = true
        )
      );
  END IF;
END $$;

-- 3. Index supporting the default view (pending = neither invited nor
--    dismissed, oldest first so we work through the queue FIFO).
CREATE INDEX IF NOT EXISTS waitlist_signups_pending_idx
  ON public.waitlist_signups (created_at)
  WHERE invited_at IS NULL AND dismissed_at IS NULL;

-- 4. Bootstrap admin
UPDATE public.users SET is_admin = true WHERE username = 'nalaknas';
