-- Migration: 025_split_request_status_push.sql
-- Description: ENG-164 (PR #1 of 3) — push the SENDER of a split request when a
-- recipient transitions their line pending → viewed → paid (or pending → paid).
--
-- Mirrors migration 024 (which pushes recipients on line INSERT). This migration
-- closes the loop the other way so the sender sees who's acting.
--
-- Changes:
--   1. notifications.type CHECK gains 'split_request_status'.
--   2. notification_title() learns the new type → 'Payment update'.
--   3. trigger_split_request_line_status_change() fires AFTER UPDATE OF status
--      on split_request_lines. Inserts a notifications row addressed to the
--      sender. The existing INSERT trigger on notifications transitively fans
--      out the push (migration 022 → 024 pipeline).
--
-- Behavioral notes:
--   * Only fires for status transitions to 'viewed' or 'paid'. We deliberately
--     do not push for 'cancelled' (sender did that themselves) or 'pending'
--     (default; never updated to).
--   * Only fires when recipient_user_id IS NOT NULL. SMS-only recipients are
--     deferred: notifications.from_user_id is NOT NULL and using the sender
--     as a fallback would cause the push fanout trigger to prepend the
--     sender's own display name to the body — wrong-sounding. Skipping is
--     the cleanest correct choice; the sender still sees the line update in
--     the app's split-history view (PR #2 of this epic).
--   * If the recipient is also the sender (self-line), skip — don't notify
--     someone about their own action.
--   * Body is wrapped in EXCEPTION WHEN OTHERS so a push hiccup can never
--     block the line UPDATE (per the project rule on fault-tolerant triggers).

BEGIN;

-- 1. Extend the type CHECK to include split_request_status
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'like',
    'comment',
    'tag',
    'follow',
    'recommendation',
    'comment_like',
    'split_request_line',
    'split_request_status'
  ));

-- 2. Teach notification_title() the new type
CREATE OR REPLACE FUNCTION notification_title(n_type TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE n_type
    WHEN 'like'                 THEN 'New Like'
    WHEN 'comment'              THEN 'New Comment'
    WHEN 'comment_like'         THEN 'Comment Liked'
    WHEN 'tag'                  THEN 'You Were Tagged'
    WHEN 'follow'               THEN 'New Follower'
    WHEN 'recommendation'       THEN 'New Recommendation'
    WHEN 'split_request_line'   THEN 'Payment request'
    WHEN 'split_request_status' THEN 'Payment update'
    ELSE 'Dine'
  END;
$$;

-- 3. Trigger function: emit a notifications row for the sender when a Dine
--    recipient transitions a line to viewed or paid.
CREATE OR REPLACE FUNCTION trigger_split_request_line_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_user_id uuid;
  v_restaurant_name text;
  v_public_token text;
  v_split_request_id uuid;
  v_message text;
BEGIN
  -- Defensive: even though the trigger is wired with UPDATE OF status, a
  -- noop UPDATE can still fire it. Skip if the value didn't actually change.
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  -- Only push for transitions to viewed or paid.
  IF NEW.status NOT IN ('viewed', 'paid') THEN
    RETURN NEW;
  END IF;

  -- SMS-only recipients are deferred — see header for rationale.
  IF NEW.recipient_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Fault-tolerant: a notification side-effect must never block the line
  -- UPDATE (per project rule on fault-tolerant triggers).
  BEGIN
    SELECT sr.id, sr.sender_user_id, sr.restaurant_name, sr.public_token
      INTO v_split_request_id, v_sender_user_id, v_restaurant_name, v_public_token
      FROM public.split_requests sr
      WHERE sr.id = NEW.split_request_id
      LIMIT 1;

    IF v_sender_user_id IS NULL THEN
      RAISE LOG 'split_request_line_status_change: parent split_request % not found', NEW.split_request_id;
      RETURN NEW;
    END IF;

    -- Don't notify the sender about their own actions on a self-line.
    IF NEW.recipient_user_id IS NOT DISTINCT FROM v_sender_user_id THEN
      RETURN NEW;
    END IF;

    v_message := CASE NEW.status
      WHEN 'viewed' THEN 'saw your request for ' || v_restaurant_name
      WHEN 'paid'   THEN 'marked their share paid 💰 for ' || v_restaurant_name
    END;

    INSERT INTO public.notifications (user_id, type, from_user_id, post_id, message, data)
    VALUES (
      v_sender_user_id,
      'split_request_status',
      NEW.recipient_user_id,
      NULL,
      v_message,
      jsonb_build_object(
        'url', 'dine://r/' || v_public_token,
        'split_request_id', v_split_request_id,
        'line_id', NEW.id,
        'public_token', v_public_token,
        'status', NEW.status,
        'amount', NEW.amount,
        'restaurant_name', v_restaurant_name
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'split_request_line_status_change exception: % %', SQLSTATE, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- 4. Wire the trigger
DROP TRIGGER IF EXISTS on_split_request_line_status_change ON public.split_request_lines;
CREATE TRIGGER on_split_request_line_status_change
  AFTER UPDATE OF status ON public.split_request_lines
  FOR EACH ROW
  EXECUTE FUNCTION trigger_split_request_line_status_change();

COMMIT;
