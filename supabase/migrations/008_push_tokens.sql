-- Migration 008: Push notification token storage & notification preferences
-- Related to ENG-35: Push Notifications — Token Registration

-- Add push token and notification preferences to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS expo_push_token TEXT,
  ADD COLUMN IF NOT EXISTS notification_preferences JSONB NOT NULL DEFAULT '{
    "likes": true,
    "comments": true,
    "tags": true,
    "follows": true,
    "recommendations": true
  }'::jsonb;

-- Index for looking up users by push token (for deduplication)
CREATE INDEX IF NOT EXISTS idx_users_expo_push_token ON users (expo_push_token) WHERE expo_push_token IS NOT NULL;

-- Function to upsert push token (called from client)
CREATE OR REPLACE FUNCTION update_push_token(p_token TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Clear this token from any other user (token can only belong to one device/user)
  UPDATE users SET expo_push_token = NULL WHERE expo_push_token = p_token AND id != auth.uid();
  -- Set token for current user
  UPDATE users SET expo_push_token = p_token WHERE id = auth.uid();
END;
$$;

-- Function to update notification preferences
CREATE OR REPLACE FUNCTION update_notification_preferences(p_preferences JSONB)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE users SET notification_preferences = p_preferences WHERE id = auth.uid();
END;
$$;

-- Function to clear push token (called on sign out)
CREATE OR REPLACE FUNCTION clear_push_token()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE users SET expo_push_token = NULL WHERE id = auth.uid();
END;
$$;
