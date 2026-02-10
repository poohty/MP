-- SUPABASE_SCHEMA_HOTFIX.sql
-- Fixes missing auth-based columns and constraints for current app code
-- Safe to run multiple times (idempotent)

-- ============================================
-- A) user_profiles: add auth_id + unique constraint
-- ============================================

-- Add auth_id column if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'user_profiles' 
    AND column_name = 'auth_id'
  ) THEN
    ALTER TABLE public.user_profiles ADD COLUMN auth_id uuid;
  END IF;
END $$;

-- Add unique constraint on auth_id if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_profiles_auth_id_unique'
  ) THEN
    ALTER TABLE public.user_profiles 
    ADD CONSTRAINT user_profiles_auth_id_unique UNIQUE (auth_id);
  END IF;
END $$;

-- ============================================
-- B) recipes: add owner_auth_id + index
-- ============================================

-- Add owner_auth_id column if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'recipes' 
    AND column_name = 'owner_auth_id'
  ) THEN
    ALTER TABLE public.recipes ADD COLUMN owner_auth_id uuid;
  END IF;
END $$;

-- Add index on owner_auth_id if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename = 'recipes' 
    AND indexname = 'idx_recipes_owner_auth_id'
  ) THEN
    CREATE INDEX idx_recipes_owner_auth_id ON public.recipes(owner_auth_id);
  END IF;
END $$;

-- ============================================
-- C) friend_links: add auth-based columns + indexes
-- ============================================

-- Add requester_auth_id column if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'friend_links' 
    AND column_name = 'requester_auth_id'
  ) THEN
    ALTER TABLE public.friend_links ADD COLUMN requester_auth_id uuid;
  END IF;
END $$;

-- Add recipient_auth_id column if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'friend_links' 
    AND column_name = 'recipient_auth_id'
  ) THEN
    ALTER TABLE public.friend_links ADD COLUMN recipient_auth_id uuid;
  END IF;
END $$;

-- Add index on requester_auth_id if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename = 'friend_links' 
    AND indexname = 'idx_friend_links_requester_auth_id'
  ) THEN
    CREATE INDEX idx_friend_links_requester_auth_id ON public.friend_links(requester_auth_id);
  END IF;
END $$;

-- Add index on recipient_auth_id if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename = 'friend_links' 
    AND indexname = 'idx_friend_links_recipient_auth_id'
  ) THEN
    CREATE INDEX idx_friend_links_recipient_auth_id ON public.friend_links(recipient_auth_id);
  END IF;
END $$;

-- ============================================
-- D) Force PostgREST schema cache reload
-- ============================================

NOTIFY pgrst, 'reload schema';

-- Done! Schema should now match app code expectations.
