-- ===================================================================
-- RLS SECURITY FIX: Replace permissive policies with auth-based policies
-- ===================================================================
-- This migration adds auth_id columns to link rows to auth.uid()
-- and replaces all "USING (true)" policies with restrictive ones.
-- ===================================================================

-- ==================
-- 1. ADD AUTH COLUMNS
-- ==================

-- Add owner_auth_id to recipes table
ALTER TABLE recipes 
ADD COLUMN IF NOT EXISTS owner_auth_id UUID;

-- Add auth_id to user_profiles table
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS auth_id UUID;

-- Add auth columns to friend_links table
ALTER TABLE friend_links 
ADD COLUMN IF NOT EXISTS requester_auth_id UUID;

ALTER TABLE friend_links 
ADD COLUMN IF NOT EXISTS recipient_auth_id UUID;

-- ==================
-- 2. CREATE INDEXES
-- ==================

CREATE INDEX IF NOT EXISTS idx_recipes_owner_auth_id ON recipes(owner_auth_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_auth_id ON user_profiles(auth_id);
CREATE INDEX IF NOT EXISTS idx_friend_links_requester_auth_id ON friend_links(requester_auth_id);
CREATE INDEX IF NOT EXISTS idx_friend_links_recipient_auth_id ON friend_links(recipient_auth_id);

-- ==================
-- 3. DROP OLD PERMISSIVE POLICIES
-- ==================

-- Drop recipes policies
DROP POLICY IF EXISTS "Anyone can read recipes" ON recipes;
DROP POLICY IF EXISTS "Users can insert their own recipes" ON recipes;
DROP POLICY IF EXISTS "Users can update their own recipes" ON recipes;
DROP POLICY IF EXISTS "Users can delete their own recipes" ON recipes;

-- Drop user_profiles policies
DROP POLICY IF EXISTS "Allow public read access to user_profiles" ON user_profiles;
DROP POLICY IF EXISTS "Allow public insert access to user_profiles" ON user_profiles;
DROP POLICY IF EXISTS "Allow public update access to user_profiles" ON user_profiles;
DROP POLICY IF EXISTS "Allow public delete access to user_profiles" ON user_profiles;

-- Drop friend_links policies
DROP POLICY IF EXISTS "Allow public read access to friend_links" ON friend_links;
DROP POLICY IF EXISTS "Allow public insert access to friend_links" ON friend_links;
DROP POLICY IF EXISTS "Allow public update access to friend_links" ON friend_links;
DROP POLICY IF EXISTS "Allow public delete access to friend_links" ON friend_links;

-- ==================
-- 4. CREATE RESTRICTIVE POLICIES - RECIPES
-- ==================

-- Users can only read their own recipes
CREATE POLICY "Users can read their own recipes" ON recipes
  FOR SELECT
  USING (
    owner_auth_id = auth.uid()
  );

-- Users can only insert recipes with their own auth_id
CREATE POLICY "Users can insert their own recipes" ON recipes
  FOR INSERT
  WITH CHECK (
    owner_auth_id = auth.uid()
  );

-- Users can only update their own recipes
CREATE POLICY "Users can update their own recipes" ON recipes
  FOR UPDATE
  USING (
    owner_auth_id = auth.uid()
  )
  WITH CHECK (
    owner_auth_id = auth.uid()
  );

-- Users can only delete their own recipes
CREATE POLICY "Users can delete their own recipes" ON recipes
  FOR DELETE
  USING (
    owner_auth_id = auth.uid()
  );

-- ==================
-- 5. CREATE RESTRICTIVE POLICIES - USER_PROFILES
-- ==================

-- Authenticated users can read all profiles (needed for user search and friend features)
CREATE POLICY "Authenticated users can read all profiles" ON user_profiles
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
  );

-- Users can only insert their own profile
CREATE POLICY "Users can insert their own profile" ON user_profiles
  FOR INSERT
  WITH CHECK (
    auth_id = auth.uid()
  );

-- Users can only update their own profile
CREATE POLICY "Users can update their own profile" ON user_profiles
  FOR UPDATE
  USING (
    auth_id = auth.uid()
  )
  WITH CHECK (
    auth_id = auth.uid()
  );

-- Users can only delete their own profile
CREATE POLICY "Users can delete their own profile" ON user_profiles
  FOR DELETE
  USING (
    auth_id = auth.uid()
  );

-- ==================
-- 6. CREATE RESTRICTIVE POLICIES - FRIEND_LINKS
-- ==================

-- Users can read friend links where they are either requester or recipient
CREATE POLICY "Users can read their own friend links" ON friend_links
  FOR SELECT
  USING (
    requester_auth_id = auth.uid() OR recipient_auth_id = auth.uid()
  );

-- Users can only create friend requests as the requester
CREATE POLICY "Users can create friend requests as requester" ON friend_links
  FOR INSERT
  WITH CHECK (
    requester_auth_id = auth.uid()
  );

-- Users can update friend links where they are requester or recipient
CREATE POLICY "Users can update their own friend links" ON friend_links
  FOR UPDATE
  USING (
    requester_auth_id = auth.uid() OR recipient_auth_id = auth.uid()
  )
  WITH CHECK (
    requester_auth_id = auth.uid() OR recipient_auth_id = auth.uid()
  );

-- Users can delete friend links where they are requester or recipient
CREATE POLICY "Users can delete their own friend links" ON friend_links
  FOR DELETE
  USING (
    requester_auth_id = auth.uid() OR recipient_auth_id = auth.uid()
  );

-- ==================
-- 7. VERIFICATION QUERIES
-- ==================

-- Check that RLS policies were updated:
-- SELECT tablename, policyname, permissive, cmd, qual, with_check 
-- FROM pg_policies 
-- WHERE schemaname = 'public' 
-- AND tablename IN ('recipes', 'user_profiles', 'friend_links')
-- ORDER BY tablename, policyname;

-- Check that new columns exist:
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_schema = 'public' 
-- AND table_name IN ('recipes', 'user_profiles', 'friend_links')
-- AND column_name LIKE '%auth%'
-- ORDER BY table_name, column_name;

-- ===================================================================
-- MIGRATION COMPLETE
-- ===================================================================
-- Next steps:
-- 1. Update app code to populate the new auth_id columns on INSERT
-- 2. For existing rows without auth_id, they will be inaccessible until backfilled
-- 3. Run Security Advisor again to verify warnings are resolved
-- ===================================================================
