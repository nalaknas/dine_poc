-- ─── CONTACTS SYSTEM ─────────────────────────────────────────────────────────
-- Server-side contacts table keyed by phone number.
-- Contacts persist across devices, remember Venmo handles, and backfill
-- when a contact later creates an account.

-- ─── Phone normalization helper ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.normalize_phone(raw text)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  digits text;
BEGIN
  IF raw IS NULL OR raw = '' THEN RETURN NULL; END IF;
  digits := regexp_replace(raw, '[^0-9+]', '', 'g');
  IF left(digits, 1) = '+' THEN RETURN digits; END IF;
  IF length(digits) = 10 THEN RETURN '+1' || digits; END IF;
  IF length(digits) = 11 AND left(digits, 1) = '1' THEN RETURN '+' || digits; END IF;
  RETURN '+' || digits;
END;
$$;

-- ─── CONTACTS TABLE ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  phone_number text,                       -- E.164 format; nullable for quick-add friends
  display_name text NOT NULL,
  venmo_username text,
  linked_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  split_count integer NOT NULL DEFAULT 0,
  last_split_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One contact per phone per owner (only enforced when phone is present)
CREATE UNIQUE INDEX IF NOT EXISTS contacts_owner_phone_unique
  ON public.contacts (owner_id, phone_number) WHERE phone_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS contacts_owner_id ON public.contacts (owner_id);
CREATE INDEX IF NOT EXISTS contacts_phone_number ON public.contacts (phone_number) WHERE phone_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS contacts_linked_user_id ON public.contacts (linked_user_id) WHERE linked_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS contacts_owner_split ON public.contacts (owner_id, split_count DESC);

-- ─── ALTER post_tagged_friends: add phone_number for backfill matching ───────
ALTER TABLE public.post_tagged_friends
  ADD COLUMN IF NOT EXISTS phone_number text;

CREATE INDEX IF NOT EXISTS post_tagged_friends_phone
  ON public.post_tagged_friends (phone_number) WHERE phone_number IS NOT NULL;

-- ─── Unique phone on users (prevent duplicate registrations) ─────────────────
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_number_unique
  ON public.users (phone_number) WHERE phone_number IS NOT NULL;

-- ─── RLS for contacts ────────────────────────────────────────────────────────
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own contacts' AND tablename = 'contacts') THEN
    CREATE POLICY "Users can view their own contacts" ON public.contacts FOR SELECT USING (auth.uid() = owner_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert their own contacts' AND tablename = 'contacts') THEN
    CREATE POLICY "Users can insert their own contacts" ON public.contacts FOR INSERT WITH CHECK (auth.uid() = owner_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their own contacts' AND tablename = 'contacts') THEN
    CREATE POLICY "Users can update their own contacts" ON public.contacts FOR UPDATE USING (auth.uid() = owner_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete their own contacts' AND tablename = 'contacts') THEN
    CREATE POLICY "Users can delete their own contacts" ON public.contacts FOR DELETE USING (auth.uid() = owner_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tagged friends can update their own rows' AND tablename = 'post_tagged_friends') THEN
    CREATE POLICY "Tagged friends can update their own rows" ON public.post_tagged_friends FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

-- ─── Trigger: normalize phone + set updated_at on contacts ───────────────────
CREATE OR REPLACE FUNCTION public.contacts_normalize_phone_trigger()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.phone_number := public.normalize_phone(NEW.phone_number);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contacts_normalize_phone ON public.contacts;
CREATE TRIGGER contacts_normalize_phone
  BEFORE INSERT OR UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.contacts_normalize_phone_trigger();

-- ─── Trigger: auto-link contact to existing user on insert ───────────────────
CREATE OR REPLACE FUNCTION public.contacts_auto_link_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  matched_user_id uuid;
BEGIN
  IF NEW.linked_user_id IS NOT NULL THEN RETURN NEW; END IF;
  IF NEW.phone_number IS NULL THEN RETURN NEW; END IF;

  SELECT id INTO matched_user_id
  FROM public.users
  WHERE phone_number = NEW.phone_number
  LIMIT 1;

  IF matched_user_id IS NOT NULL THEN
    NEW.linked_user_id := matched_user_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contacts_auto_link ON public.contacts;
CREATE TRIGGER contacts_auto_link
  BEFORE INSERT ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.contacts_auto_link_trigger();

-- ─── Trigger: backfill when a user registers/updates their phone ─────────────
-- Links contacts + post_tagged_friends rows to the new account.
CREATE OR REPLACE FUNCTION public.on_user_phone_registered()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.phone_number IS NULL OR NEW.phone_number = '' THEN
    RETURN NEW;
  END IF;

  -- Normalize the phone on the user record itself
  NEW.phone_number := public.normalize_phone(NEW.phone_number);

  -- 1. Link all contacts across all users that match this phone
  UPDATE public.contacts
  SET linked_user_id = NEW.id, updated_at = now()
  WHERE phone_number = NEW.phone_number
    AND linked_user_id IS NULL;

  -- 2. Backfill post_tagged_friends: set user_id so they can see/rate past meals
  UPDATE public.post_tagged_friends
  SET user_id = NEW.id
  WHERE phone_number = NEW.phone_number
    AND user_id IS NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_phone_backfill ON public.users;
CREATE TRIGGER user_phone_backfill
  BEFORE INSERT OR UPDATE OF phone_number ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.on_user_phone_registered();
