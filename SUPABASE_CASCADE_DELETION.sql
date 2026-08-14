-- ====================================================================
-- MEAL PLANNER ROULETTE - AUTOMATIC CASCADE DELETION MIGRATION (BULLETPROOF)
-- ====================================================================
-- 1. Drops CHECK constraints that compare user_id vs friend_user_id before type change
-- 2. Purges orphaned test records
-- 3. Converts columns to UUID safely
-- 4. Re-adds CHECK constraints and ON DELETE CASCADE foreign keys
-- ====================================================================

BEGIN;

-- 1. Drop check constraint on friend_links if present (avoids uuid <> text error during type alter)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'friend_links'
  ) THEN
    ALTER TABLE public.friend_links DROP CONSTRAINT IF EXISTS no_self_friend;
  END IF;
END $$;

-- 2. Purge orphaned test records from public tables
DELETE FROM public.user_profiles WHERE id::text NOT IN (SELECT id::text FROM auth.users);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'recipes' AND column_name = 'owner_user_id'
  ) THEN
    DELETE FROM public.recipes WHERE owner_user_id::text NOT IN (SELECT id::text FROM auth.users);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'friend_links' AND column_name = 'user_id'
  ) THEN
    DELETE FROM public.friend_links WHERE user_id::text NOT IN (SELECT id::text FROM auth.users);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'friend_links' AND column_name = 'friend_user_id'
  ) THEN
    DELETE FROM public.friend_links WHERE friend_user_id::text NOT IN (SELECT id::text FROM auth.users);
  END IF;
END $$;

-- 3. Convert column types to UUID
ALTER TABLE public.user_profiles ALTER COLUMN id TYPE uuid USING id::uuid;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'recipes' AND column_name = 'owner_user_id'
  ) THEN
    ALTER TABLE public.recipes ALTER COLUMN owner_user_id TYPE uuid USING owner_user_id::uuid;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'friend_links'
  ) THEN
    ALTER TABLE public.friend_links ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
    ALTER TABLE public.friend_links ALTER COLUMN friend_user_id TYPE uuid USING friend_user_id::uuid;
  END IF;
END $$;

-- 4. Re-add no_self_friend constraint on friend_links
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'friend_links'
  ) THEN
    ALTER TABLE public.friend_links ADD CONSTRAINT no_self_friend CHECK (user_id != friend_user_id);
  END IF;
END $$;

-- 5. Add Foreign Key constraints with ON DELETE CASCADE
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_id_fkey;
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_id_fkey 
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'recipes' AND column_name = 'owner_user_id'
  ) THEN
    ALTER TABLE public.recipes DROP CONSTRAINT IF EXISTS recipes_owner_user_id_fkey;
    ALTER TABLE public.recipes ADD CONSTRAINT recipes_owner_user_id_fkey 
      FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'friend_links' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.friend_links DROP CONSTRAINT IF EXISTS friend_links_user_id_fkey;
    ALTER TABLE public.friend_links ADD CONSTRAINT friend_links_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'friend_links' AND column_name = 'friend_user_id'
  ) THEN
    ALTER TABLE public.friend_links DROP CONSTRAINT IF EXISTS friend_links_friend_user_id_fkey;
    ALTER TABLE public.friend_links ADD CONSTRAINT friend_links_friend_user_id_fkey 
      FOREIGN KEY (friend_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

COMMIT;
