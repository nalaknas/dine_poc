-- Migration 022: Repair the push notification pipeline (ENG-153)
--
-- Migration 009 introduced an INSERT trigger on `notifications` that PERFORMs
-- `net.http_post(...)`, but `pg_net` was never installed and the GUCs the
-- trigger reads were never set. The trigger is SECURITY DEFINER with a
-- synchronous PERFORM and no exception handler, so every notification INSERT
-- has been failing with `3F000: schema "net" does not exist` since 2026-03-31.
-- Net effect: the Activity feed is frozen and zero pushes have ever fired.
--
-- This migration:
--   1. Installs pg_net.
--   2. Inlines the (non-secret) project URL in the trigger. We can't ALTER
--      DATABASE postgres SET ... from the MCP role (no superuser), and the
--      Supabase URL is already in the public client config — no value in
--      hiding it.
--   3. Reads the service-role key from Vault so it stays out of git and out
--      of pg_db_role_setting plain text.
--   4. Wraps the pg_net call in EXCEPTION WHEN OTHERS so push delivery can
--      never block a notification row from landing — and short-circuits with
--      a LOG line when the vault secret hasn't been set yet.
--   5. Routes tag pushes to the rate flow (dine://rate/<postId>) instead of
--      the generic post screen.
--
-- After applying, a one-time step is required to populate Vault:
--   SELECT vault.create_secret('<service-role-key>', 'supabase_service_role_key');

-- 1. Install pg_net
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. Route tag pushes to TaggedRate instead of MealDetail
CREATE OR REPLACE FUNCTION notification_deep_link(n_type TEXT, n_post_id UUID, n_from_user_id UUID)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN n_type = 'tag' AND n_post_id IS NOT NULL THEN 'dine://rate/' || n_post_id::text
    WHEN n_post_id IS NOT NULL THEN 'dine://post/' || n_post_id::text
    WHEN n_type = 'follow' AND n_from_user_id IS NOT NULL THEN 'dine://profile/' || n_from_user_id::text
    ELSE NULL
  END;
$$;

-- 3. Harden the trigger: pg_net failures are logged and swallowed, never block
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
  deep_link := notification_deep_link(NEW.type, NEW.post_id, NEW.from_user_id);

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

  IF deep_link IS NOT NULL THEN
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

-- Trigger itself was created in migration 009 and remains valid; the
-- CREATE OR REPLACE FUNCTION above swaps in the new body in place.
