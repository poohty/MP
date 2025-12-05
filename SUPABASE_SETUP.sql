-- =====================================================
-- SUPABASE SETUP FOR SOCIAL FEATURES
-- =====================================================
-- Run this SQL in your Supabase SQL Editor to create
-- the necessary tables and policies for the social layer.
-- =====================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TABLE: user_profiles
-- =====================================================
-- Stores user profile information for social features

CREATE TABLE IF NOT EXISTS user_profiles (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  username TEXT NOT NULL,
  display_name TEXT NOT NULL,
  share_cookbook_with_friends BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create unique index on username (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_username_unique_idx 
  ON user_profiles (LOWER(username));

-- Create index for case-insensitive username search
CREATE INDEX IF NOT EXISTS user_profiles_username_search_idx 
  ON user_profiles (LOWER(username) text_pattern_ops);

-- Create index on email for lookups
CREATE INDEX IF NOT EXISTS user_profiles_email_idx 
  ON user_profiles (email);

-- =====================================================
-- TABLE: friend_links
-- =====================================================
-- Stores friend relationships between users

CREATE TABLE IF NOT EXISTS friend_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  friend_user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_status CHECK (status IN ('pending', 'accepted', 'rejected')),
  CONSTRAINT no_self_friend CHECK (user_id != friend_user_id)
);

-- Create indexes for efficient friend link queries
CREATE INDEX IF NOT EXISTS friend_links_user_id_idx 
  ON friend_links (user_id);

CREATE INDEX IF NOT EXISTS friend_links_friend_user_id_idx 
  ON friend_links (friend_user_id);

CREATE INDEX IF NOT EXISTS friend_links_status_idx 
  ON friend_links (status);

-- Composite index for checking existing links
CREATE INDEX IF NOT EXISTS friend_links_user_friend_idx 
  ON friend_links (user_id, friend_user_id);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================
-- For now, we'll use permissive policies that allow
-- any authenticated client with the anon key to read/write.
-- In production, you should restrict these based on auth.

-- Enable RLS on both tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_links ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for re-running this script)
DROP POLICY IF EXISTS "Allow public read access to user_profiles" ON user_profiles;
DROP POLICY IF EXISTS "Allow public insert access to user_profiles" ON user_profiles;
DROP POLICY IF EXISTS "Allow public update access to user_profiles" ON user_profiles;
DROP POLICY IF EXISTS "Allow public delete access to user_profiles" ON user_profiles;

DROP POLICY IF EXISTS "Allow public read access to friend_links" ON friend_links;
DROP POLICY IF EXISTS "Allow public insert access to friend_links" ON friend_links;
DROP POLICY IF EXISTS "Allow public update access to friend_links" ON friend_links;
DROP POLICY IF EXISTS "Allow public delete access to friend_links" ON friend_links;

-- user_profiles policies (permissive for MVP)
CREATE POLICY "Allow public read access to user_profiles"
  ON user_profiles FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert access to user_profiles"
  ON user_profiles FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update access to user_profiles"
  ON user_profiles FOR UPDATE
  USING (true);

CREATE POLICY "Allow public delete access to user_profiles"
  ON user_profiles FOR DELETE
  USING (true);

-- friend_links policies (permissive for MVP)
CREATE POLICY "Allow public read access to friend_links"
  ON friend_links FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert access to friend_links"
  ON friend_links FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update access to friend_links"
  ON friend_links FOR UPDATE
  USING (true);

CREATE POLICY "Allow public delete access to friend_links"
  ON friend_links FOR DELETE
  USING (true);

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for user_profiles
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for friend_links
DROP TRIGGER IF EXISTS update_friend_links_updated_at ON friend_links;
CREATE TRIGGER update_friend_links_updated_at
  BEFORE UPDATE ON friend_links
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- Run these to verify your setup:
--
-- Check tables exist:
-- SELECT * FROM user_profiles LIMIT 5;
-- SELECT * FROM friend_links LIMIT 5;
--
-- Check indexes:
-- SELECT indexname, tablename FROM pg_indexes 
-- WHERE schemaname = 'public' 
-- AND (tablename = 'user_profiles' OR tablename = 'friend_links');
--
-- Check RLS policies:
-- SELECT tablename, policyname, permissive, roles, cmd 
-- FROM pg_policies 
-- WHERE schemaname = 'public' 
-- AND (tablename = 'user_profiles' OR tablename = 'friend_links');
--
-- =====================================================
-- SETUP COMPLETE
-- =====================================================
-- Your social features should now work!
-- 
-- Next steps:
-- 1. Make sure EXPO_PUBLIC_SUPABASE_URL is set in your Expo config
-- 2. Make sure EXPO_PUBLIC_SUPABASE_ANON_KEY is set in your Expo config
-- 3. Sign up a user on your device
-- 4. Check that a row appears in user_profiles:
--    SELECT * FROM user_profiles ORDER BY created_at DESC;
-- 5. Sign up another user on a different device
-- 6. Use the Friends debug button to verify both users appear
-- 7. Search for users and send friend requests
-- =====================================================
