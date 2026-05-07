-- Migration: 024_split_request_push.sql
-- Description: ENG-163 — push notifications for split_request_lines.
--
-- Wires the existing push pipeline (notifications INSERT trigger →
-- send-push-notification Edge Function) to fire when a Dine recipient is
-- attached to a split_request_line.
--
-- Changes:
--   1. notifications.data jsonb — forward-extensible payload column so future
--      notification types can carry structured deep-link metadata (line_id,
--      public_token, amount, etc.) without re-shaping the schema.
--   2. notifications.type CHECK gains 'split_request_line'.
--   3. notification_title() learns the new type → 'Payment request'.
--   4. trigger_send_push_notification() prefers NEW.data->>'url' for the
--      deep link when present and forwards NEW.data verbatim as the Edge
--      Function `data` field. Legacy rows (NEW.data IS NULL) keep the old
--      { "url": deep_link } shape — no behavior change for existing types.
--   5. trigger_split_request_line_notification() fires on
--      split_request_lines INSERT and (when recipient_user_id is set)
--      inserts the matching notifications row. The existing INSERT trigger
--      on notifications transitively fans out the push.
--      Body is wrapped in EXCEPTION WHEN OTHERS so a push hiccup can never
--      block the line insert (per the project rule on fault-tolerant
--      triggers).

BEGIN;

-- 1. Add data column for structured payload
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS data jsonb;

-- 2. Extend the type CHECK to include split_request_line
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
    'split_request_line'
  ));

-- 3. Teach notification_title() the new type
CREATE OR REPLACE FUNCTION notification_title(n_type TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE n_type
    WHEN 'like'               THEN 'New Like'
    WHEN 'comment'            THEN 'New Comment'
    WHEN 'comment_like'       THEN 'Comment Liked'
    WHEN 'tag'                THEN 'You Were Tagged'
    WHEN 'follow'             THEN 'New Follower'
    WHEN 'recommendation'     THEN 'New Recommendation'
    WHEN 'split_request_line' THEN 'Payment request'
    ELSE 'Dine'
  END;
$$;

-- 4. Update trigger_send_push_notification: prefer NEW.data, fall back to
--    legacy { url } shape when NEW.data is NULL.
CREATE OR REPLACE FUNCTION trigger_send_push_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  push_title TEXT;
  deep_link TEXT;
  from_display_name TEXT;
  push_body TEXT;
  request_payload JSONB;
  edge_function_url TEXT;
  service_key TEXT;
BEGIN
  push_title := notification_title(NEW.type);

  -- Prefer an explicit url from NEW.data when present (new types like
  -- split_request_line carry their own public-token URL). Fall back to the
  -- legacy helper for older notification types whose URL is derivable from
  -- post_id / from_user_id.
  IF NEW.data IS NOT NULL AND NEW.data ? 'url' THEN
    deep_link := NEW.data->>'url';
  ELSE
    deep_link := notification_deep_link(NEW.type, NEW.post_id, NEW.from_user_id);
  END IF;

  SELECT COALESCE(display_name, username, 'Someone')
    INTO from_display_name
    FROM users
    WHERE id = NEW.from_user_id;

  push_body := from_display_name || ' ' || NEW.message;

  request_payload := jsonb_build_object(
    'userId', NEW.user_id,
    'title', push_title,
    'body', push_body,
    'notificationType', NEW.type
  );

  -- Forward NEW.data verbatim when set; otherwise emit the legacy
  -- { "url": deep_link } shape so old notification types are unaffected.
  IF NEW.data IS NOT NULL THEN
    request_payload := request_payload || jsonb_build_object('data', NEW.data);
  ELSIF deep_link IS NOT NULL THEN
    request_payload := request_payload || jsonb_build_object(
      'data', jsonb_build_object('url', deep_link)
    );
  END IF;

  -- Best-effort push delivery. Any failure here (missing vault secret,
  -- pg_net error, network error) is logged and swallowed — the notification
  -- row must always land regardless.
  BEGIN
    SELECT decrypted_secret INTO service_key
      FROM vault.decrypted_secrets
      WHERE name = 'supabase_service_role_key'
      LIMIT 1;

    IF service_key IS NULL THEN
      RAISE LOG 'send-push skipped: vault secret supabase_service_role_key is not set';
    ELSE
      edge_function_url := 'https://pkvzujmglmrdwfeqjjvm.supabase.co/functions/v1/send-push-notification';
      PERFORM net.http_post(
        url := edge_function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || service_key
        ),
        body := request_payload
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'send-push exception: % %', SQLSTATE, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- 5. New trigger function on split_request_lines: emit a notifications row
--    for the recipient when a Dine user is attached.
CREATE OR REPLACE FUNCTION trigger_split_request_line_notification()
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
BEGIN
  -- Lines without a Dine recipient are SMS-only (ENG-162) — skip.
  IF NEW.recipient_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Fault-tolerant: a notification side-effect must never block the line
  -- insert (per project rule on fault-tolerant triggers).
  BEGIN
    SELECT sr.id, sr.sender_user_id, sr.restaurant_name, sr.public_token
      INTO v_split_request_id, v_sender_user_id, v_restaurant_name, v_public_token
      FROM public.split_requests sr
      WHERE sr.id = NEW.split_request_id
      LIMIT 1;

    IF v_sender_user_id IS NULL THEN
      RAISE LOG 'split_request_line_notification: parent split_request % not found', NEW.split_request_id;
      RETURN NEW;
    END IF;

    -- Don't notify the sender if they happen to be a recipient on their own request.
    IF NEW.recipient_user_id = v_sender_user_id THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.notifications (user_id, type, from_user_id, post_id, message, data)
    VALUES (
      NEW.recipient_user_id,
      'split_request_line',
      v_sender_user_id,
      NULL,
      'wants $' || to_char(NEW.amount, 'FM999990.00') || ' for ' || v_restaurant_name,
      jsonb_build_object(
        'url', 'dine://r/' || v_public_token,
        'line_id', NEW.id,
        'split_request_id', v_split_request_id,
        'public_token', v_public_token,
        'amount', NEW.amount,
        'restaurant_name', v_restaurant_name
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'split_request_line_notification exception: % %', SQLSTATE, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- 6. Wire the trigger
DROP TRIGGER IF EXISTS on_split_request_line_insert_notify ON public.split_request_lines;
CREATE TRIGGER on_split_request_line_insert_notify
  AFTER INSERT ON public.split_request_lines
  FOR EACH ROW
  EXECUTE FUNCTION trigger_split_request_line_notification();

COMMIT;
