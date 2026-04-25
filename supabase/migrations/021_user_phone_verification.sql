-- ENG-147: phone verification at signup
--
-- public.users.phone_number already exists (migration 001) and the
-- unique partial index `users_phone_number_unique` already enforces
-- one-account-per-phone (migration 007). Migration 007 also installs
-- a `user_phone_backfill` trigger that normalizes phone_number and
-- back-links contacts + post_tagged_friends when a user registers a
-- phone — that's the existing ghost-user backfill mechanism.
--
-- This migration only adds the timestamp column the app uses to gate
-- onboarding completion. We need this distinct from `phone_number`
-- being non-NULL because legacy rows have unverified phone values
-- planted on them (e.g. user-typed without OTP) — those should not
-- count as "verified" for the gate.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz;
