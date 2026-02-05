-- ===================================================================
-- SECURITY FOUNDATION: Auth-based RLS with proper UUID linking
-- ===================================================================
-- This migration establishes security by:
-- 1. Adding auth_id columns to link all user data to auth.uid()
-- 2. Dropping all permissive RLS policies (USING true / WITH CHECK true)
-- 3. Creating strict auth.uid()-based policies
-- 4. Hardening functions against search_path attacks
-- 5. Preserving existing legacy ID columns for compatibility
-- ===================================================================

-- ===================================================================
-- STEP 1: ADD AUTH COLUMNS
-- ===================================================================

-- user_profiles: Add auth_id to link to Supabase auth users
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS auth_id UUID;

-- Make auth_id unique (one profile per auth user)
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

-- Ensure email is unique
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_profiles_email_unique'
  ) THEN
    ALTER TABLE user_profiles 
    ADD CONSTRAINT user_profiles_email_unique UNIQUE (email);
  END IF;
END $$;

-- recipes: Add owner_auth_id to link to auth users
ALTER TABLE recipes 
ADD COLUMN IF NOT EXISTS owner_auth_id UUID;

-- friend_links: Add auth columns for both sides of the relationship
ALTER TABLE friend_links 
ADD COLUMN IF NOT EXISTS requester_auth_id UUID;

ALTER TABLE friend_links 
ADD COLUMN IF NOT EXISTS recipient_auth_id UUID;

-- ===================================================================
-- STEP 2: CREATE INDEXES FOR PERFORMANCE
-- ===================================================================

CREATE INDEX IF NOT EXISTS idx_user_profiles_auth_id 
  ON user_profiles(auth_id);

CREATE INDEX IF NOT EXISTS idx_recipes_owner_auth_id 
  ON recipes(owner_auth_id);

CREATE INDEX IF NOT EXISTS idx_friend_links_requester_auth_id 
  ON friend_links(requester_auth_id);

CREATE INDEX IF NOT EXISTS idx_friend_links_recipient_auth_id 
  ON friend_links(recipient_auth_id);

-- ===================================================================
-- STEP 3: ENABLE RLS ON ALL TABLES
-- ===================================================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_links ENABLE ROW LEVEL SECURITY;

-- ===================================================================
-- STEP 4: DROP ALL PERMISSIVE POLICIES
-- ===================================================================

-- Drop user_profiles permissive policies
DROP POLICY IF EXISTS "Allow public read access to user_profiles" ON user_profiles;
DROP POLICY IF EXISTS "Allow public insert access to user_profiles" ON user_profiles;
DROP POLICY IF EXISTS "Allow public update access to user_profiles" ON user_profiles;
DROP POLICY IF EXISTS "Allow public delete access to user_profiles" ON user_profiles;
DROP POLICY IF EXISTS "Authenticated users can read all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can delete their own profile" ON user_profiles;

-- Drop recipes permissive policies
DROP POLICY IF EXISTS "Anyone can read recipes" ON recipes;
DROP POLICY IF EXISTS "Users can insert their own recipes" ON recipes;
DROP POLICY IF EXISTS "Users can update their own recipes" ON recipes;
DROP POLICY IF EXISTS "Users can delete their own recipes" ON recipes;
DROP POLICY IF EXISTS "Users can read their own recipes" ON recipes;

-- Drop friend_links permissive policies
DROP POLICY IF EXISTS "Allow public read access to friend_links" ON friend_links;
DROP POLICY IF EXISTS "Allow public insert access to friend_links" ON friend_links;
DROP POLICY IF EXISTS "Allow public update access to friend_links" ON friend_links;
DROP POLICY IF EXISTS "Allow public delete access to friend_links" ON friend_links;
DROP POLICY IF EXISTS "Users can read their own friend links" ON friend_links;
DROP POLICY IF EXISTS "Users can create friend requests as requester" ON friend_links;
DROP POLICY IF EXISTS "Users can update their own friend links" ON friend_links;
DROP POLICY IF EXISTS "Users can delete their own friend links" ON friend_links;

-- ===================================================================
-- STEP 5: CREATE STRICT AUTH-BASED POLICIES - user_profiles
-- ===================================================================

-- SELECT: Allow authenticated users to read public profile fields
-- (Needed for user search and friend features)
CREATE POLICY "user_profiles_select_policy" ON user_profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: Users can only create their own profile
CREATE POLICY "user_profiles_insert_policy" ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth_id = auth.uid());

-- UPDATE: Users can only update their own profile
CREATE POLICY "user_profiles_update_policy" ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth_id = auth.uid())
  WITH CHECK (auth_id = auth.uid());

-- DELETE: Users can only delete their own profile
CREATE POLICY "user_profiles_delete_policy" ON user_profiles
  FOR DELETE
  TO authenticated
  USING (auth_id = auth.uid());

-- ===================================================================
-- STEP 6: CREATE STRICT AUTH-BASED POLICIES - recipes
-- ===================================================================

-- SELECT: Users can only read their own recipes
CREATE POLICY "recipes_select_policy" ON recipes
  FOR SELECT
  TO authenticated
  USING (owner_auth_id = auth.uid());

-- INSERT: Users can only insert recipes they own
CREATE POLICY "recipes_insert_policy" ON recipes
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_auth_id = auth.uid());

-- UPDATE: Users can only update their own recipes
CREATE POLICY "recipes_update_policy" ON recipes
  FOR UPDATE
  TO authenticated
  USING (owner_auth_id = auth.uid())
  WITH CHECK (owner_auth_id = auth.uid());

-- DELETE: Users can only delete their own recipes
CREATE POLICY "recipes_delete_policy" ON recipes
  FOR DELETE
  TO authenticated
  USING (owner_auth_id = auth.uid());

-- ===================================================================
-- STEP 7: CREATE STRICT AUTH-BASED POLICIES - friend_links
-- ===================================================================

-- SELECT: Users can read links where they are requester OR recipient
CREATE POLICY "friend_links_select_policy" ON friend_links
  FOR SELECT
  TO authenticated
  USING (
    requester_auth_id = auth.uid() 
    OR recipient_auth_id = auth.uid()
  );

-- INSERT: Users can only create links as the requester
CREATE POLICY "friend_links_insert_policy" ON friend_links
  FOR INSERT
  TO authenticated
  WITH CHECK (requester_auth_id = auth.uid());

-- UPDATE: Users can update links where they are requester OR recipient
CREATE POLICY "friend_links_update_policy" ON friend_links
  FOR UPDATE
  TO authenticated
  USING (
    requester_auth_id = auth.uid() 
    OR recipient_auth_id = auth.uid()
  )
  WITH CHECK (
    requester_auth_id = auth.uid() 
    OR recipient_auth_id = auth.uid()
  );

-- DELETE: Users can delete links where they are requester OR recipient
CREATE POLICY "friend_links_delete_policy" ON friend_links
  FOR DELETE
  TO authenticated
  USING (
    requester_auth_id = auth.uid() 
    OR recipient_auth_id = auth.uid()
  );

-- ===================================================================
-- STEP 8: HARDEN TRIGGER FUNCTIONS
-- ===================================================================

-- Replace update_updated_at_column() with hardened version
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- ===================================================================
-- VERIFICATION QUERIES
-- ===================================================================

-- Check that auth columns exist:
DO $$
BEGIN
  RAISE NOTICE 'Checking auth columns...';
END $$;

SELECT 
  table_name, 
  column_name, 
  data_type
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name IN ('user_profiles', 'recipes', 'friend_links')
  AND column_name LIKE '%auth%'
ORDER BY table_name, column_name;

-- Check RLS policies:
DO $$
BEGIN
  RAISE NOTICE 'Checking RLS policies...';
END $$;

SELECT 
  tablename,
  policyname,
  cmd,
  qual IS NOT NULL AND qual != 'true' AS has_using_check,
  with_check IS NOT NULL AND with_check != 'true' AS has_with_check
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('user_profiles', 'recipes', 'friend_links')
ORDER BY tablename, policyname;

-- Check unique constraints:
DO $$
BEGIN
  RAISE NOTICE 'Checking unique constraints...';
END $$;

SELECT 
  conname AS constraint_name,
  conrelid::regclass AS table_name
FROM pg_constraint
WHERE conrelid IN (
  'user_profiles'::regclass, 
  'recipes'::regclass, 
  'friend_links'::regclass
)
  AND contype = 'u'
ORDER BY table_name, constraint_name;

-- ===================================================================
-- MIGRATION COMPLETE
-- ===================================================================
-- 
-- IMPORTANT NEXT STEPS:
-- 
-- 1. Run this SQL in Supabase SQL Editor
-- 
-- 2. Update your app code to populate auth_id columns:
--    - user_profiles: Set auth_id = auth.uid() on INSERT/signup
--    - recipes: Set owner_auth_id = auth.uid() on INSERT
--    - friend_links: Set requester_auth_id = auth.uid(), 
--                    recipient_auth_id = <recipient's auth.uid()>
-- 
-- 3. Backfill existing data (if any):
--    - For user_profiles: Map legacy id to auth.users.id if possible
--    - For recipes: Map owner_user_id to user_profiles.auth_id
--    - For friend_links: Map legacy user_id/friend_user_id to auth_id
-- 
-- 4. Run Supabase Security Advisor to verify all warnings are resolved
-- 
-- 5. Test the app thoroughly:
--    - Signup new user -> should create profile with auth_id
--    - Create recipe -> should save with owner_auth_id
--    - Send friend request -> should use auth_ids
--    - Verify RLS prevents accessing other users' data
-- 
-- ===================================================================
