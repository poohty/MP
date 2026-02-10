-- SUPABASE_SCHEMA_HOTFIX.sql
-- Fixes schema mismatches between app code and database
-- Safe to run multiple times (idempotent)

-- ============================================
-- A) user_profiles: Add auth_id column + unique constraint
-- ============================================

-- Add auth_id column if missing
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS auth_id uuid;

-- Add unique constraint on auth_id (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_profiles_auth_id_unique'
  ) THEN
    ALTER TABLE user_profiles 
    ADD CONSTRAINT user_profiles_auth_id_unique UNIQUE (auth_id);
  END IF;
END $$;

-- ============================================
-- B) recipes: Add owner_auth_id column + index
-- ============================================

-- Add owner_auth_id column if missing
ALTER TABLE recipes 
ADD COLUMN IF NOT EXISTS owner_auth_id uuid;

-- Add index on owner_auth_id
CREATE INDEX IF NOT EXISTS idx_recipes_owner_auth_id 
ON recipes(owner_auth_id);

-- ============================================
-- C) friend_links: Add auth_id columns + indexes
-- ============================================

-- Add requester_auth_id column if missing
ALTER TABLE friend_links 
ADD COLUMN IF NOT EXISTS requester_auth_id uuid;

-- Add recipient_auth_id column if missing
ALTER TABLE friend_links 
ADD COLUMN IF NOT EXISTS recipient_auth_id uuid;

-- Add indexes on auth_id columns
CREATE INDEX IF NOT EXISTS idx_friend_links_requester_auth_id 
ON friend_links(requester_auth_id);

CREATE INDEX IF NOT EXISTS idx_friend_links_recipient_auth_id 
ON friend_links(recipient_auth_id);

-- ============================================
-- D) Force PostgREST schema cache reload
-- ============================================

NOTIFY pgrst, 'reload schema';

-- Done! The schema now matches the app code expectations.
