-- ─── STREAK TRACKING (ENG-41) ───────────────────────────────────────────────
-- Atomic streak update RPC with row locking to prevent race conditions.
-- Called from the calculate-post-credits Edge Function.

CREATE OR REPLACE FUNCTION public.update_streak(
  p_user_id      uuid,
  p_current_week text
)
RETURNS TABLE (new_streak integer, previous_streak integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_week    text;
  v_old_streak   integer;
  v_new_streak   integer;
  v_next_week    text;
BEGIN
  -- Lock the user row to prevent concurrent streak corruption
  SELECT streak_weeks, last_post_week
    INTO v_old_streak, v_last_week
    FROM public.users
    WHERE id = p_user_id
    FOR UPDATE;

  IF v_last_week = p_current_week THEN
    -- Same week — no streak change
    v_new_streak := v_old_streak;
  ELSE
    -- Calculate what the next ISO week after last_post_week would be
    -- Using ISO week arithmetic in SQL
    IF v_last_week IS NOT NULL THEN
      v_next_week := to_char(
        date_trunc('week', to_date(
          substring(v_last_week from 1 for 4) || ' ' ||
          substring(v_last_week from 7), 'IYYY IW'
        )) + interval '7 days',
        'IYYY"-W"IW'
      );
    END IF;

    IF v_last_week IS NOT NULL AND v_next_week = p_current_week THEN
      -- Next consecutive week — increment
      v_new_streak := v_old_streak + 1;
    ELSE
      -- Gap > 1 week or first post — reset
      v_new_streak := 1;
    END IF;

    -- Update the user's streak data
    UPDATE public.users
    SET streak_weeks = v_new_streak, last_post_week = p_current_week
    WHERE id = p_user_id;
  END IF;

  RETURN QUERY SELECT v_new_streak, v_old_streak;
END;
$$;

-- Only service role can call update_streak
REVOKE EXECUTE ON FUNCTION public.update_streak FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_streak FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.update_streak FROM anon;
