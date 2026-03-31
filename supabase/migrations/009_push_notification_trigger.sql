-- Migration 009: Push notification trigger on notification insert
-- Related to ENG-36: Push Notifications — Edge Function & Triggers
--
-- When a new notification row is inserted, this trigger calls the
-- send-push-notification Edge Function to deliver a push to the user's device.
-- Notification preferences and token availability are checked server-side
-- in the Edge Function itself.

-- Helper: map notification type to a human-readable title
CREATE OR REPLACE FUNCTION notification_title(n_type TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE n_type
    WHEN 'like'         THEN 'New Like'
    WHEN 'comment'      THEN 'New Comment'
    WHEN 'comment_like' THEN 'Comment Liked'
    WHEN 'tag'          THEN 'You Were Tagged'
    WHEN 'follow'       THEN 'New Follower'
    WHEN 'recommendation' THEN 'New Recommendation'
    ELSE 'Dine'
  END;
$$;

-- Helper: build a deep link URL from the notification
CREATE OR REPLACE FUNCTION notification_deep_link(n_type TEXT, n_post_id UUID, n_from_user_id UUID)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN n_post_id IS NOT NULL THEN 'dine://post/' || n_post_id::text
    WHEN n_type = 'follow' AND n_from_user_id IS NOT NULL THEN 'dine://profile/' || n_from_user_id::text
    ELSE NULL
  END;
$$;

-- Trigger function: fires on INSERT to notifications table
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
BEGIN
  -- Build push title from notification type
  push_title := notification_title(NEW.type);

  -- Build deep link
  deep_link := notification_deep_link(NEW.type, NEW.post_id, NEW.from_user_id);

  -- Get the sender's display name for a richer notification body
  SELECT COALESCE(display_name, username, 'Someone')
    INTO from_display_name
    FROM users
    WHERE id = NEW.from_user_id;

  -- Build body: "Alex liked your post"
  push_body := from_display_name || ' ' || NEW.message;

  -- Build the JSON payload for the Edge Function
  request_payload := jsonb_build_object(
    'userId', NEW.user_id,
    'title', push_title,
    'body', push_body,
    'notificationType', NEW.type
  );

  -- Add deep link data if available
  IF deep_link IS NOT NULL THEN
    request_payload := request_payload || jsonb_build_object(
      'data', jsonb_build_object('url', deep_link)
    );
  END IF;

  -- Call the Edge Function via pg_net (async HTTP POST)
  -- This is fire-and-forget so it doesn't block the INSERT
  edge_function_url := current_setting('app.settings.supabase_url', true)
    || '/functions/v1/send-push-notification';

  PERFORM net.http_post(
    url := edge_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := request_payload
  );

  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS on_notification_insert_send_push ON notifications;
CREATE TRIGGER on_notification_insert_send_push
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION trigger_send_push_notification();
