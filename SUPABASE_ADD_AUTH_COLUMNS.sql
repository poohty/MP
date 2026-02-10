-- SUPABASE_ADD_AUTH_COLUMNS.sql
-- Add missing auth_id and owner_auth_id columns + indexes
-- Safe to run multiple times (idempotent)

-- 1) Add auth_id column to user_profiles if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'user_profiles' 
    AND column_name = 'auth_id'
  ) THEN
    ALTER TABLE public.user_profiles 
    ADD COLUMN auth_id uuid;
  END IF;
END $$;

-- 2) Add owner_auth_id column to recipes if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'recipes' 
    AND column_name = 'owner_auth_id'
  ) THEN
    ALTER TABLE public.recipes 
    ADD COLUMN owner_auth_id uuid;
  END IF;
END $$;

-- 3) Create unique index on user_profiles.auth_id (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_auth_id 
ON public.user_profiles(auth_id) 
WHERE auth_id IS NOT NULL;

-- 4) Create index on recipes.owner_auth_id (idempotent)
CREATE INDEX IF NOT EXISTS idx_recipes_owner_auth_id 
ON public.recipes(owner_auth_id);

-- 5) Force PostgREST schema cache refresh
NOTIFY pgrst, 'reload schema';
