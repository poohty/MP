-- ========================================
-- SUPABASE TABLE SETUP FOR SOCIAL FEATURES
-- ========================================
-- Run this SQL in your Supabase SQL Editor to create the required tables

-- 1. USER PROFILES TABLE
CREATE TABLE IF NOT EXISTS user_profiles (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  username TEXT NOT NULL,
  display_name TEXT NOT NULL,
  share_cookbook_with_friends BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on username for fast searches (case-insensitive)
CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON user_profiles (LOWER(username));

-- Create index on email for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles (email);

-- 2. FRIEND LINKS TABLE
CREATE TABLE IF NOT EXISTS friend_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  friend_user_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for fast friend link lookups
CREATE INDEX IF NOT EXISTS idx_friend_links_user_id ON friend_links (user_id);
CREATE INDEX IF NOT EXISTS idx_friend_links_friend_user_id ON friend_links (friend_user_id);
CREATE INDEX IF NOT EXISTS idx_friend_links_status ON friend_links (status);

-- Composite index for queries that filter by user and status
CREATE INDEX IF NOT EXISTS idx_friend_links_user_status ON friend_links (user_id, status);
CREATE INDEX IF NOT EXISTS idx_friend_links_friend_status ON friend_links (friend_user_id, status);

-- Prevent duplicate friend links (A->B or B->A should be unique)
CREATE UNIQUE INDEX IF NOT EXISTS idx_friend_links_unique ON friend_links (
  LEAST(user_id, friend_user_id),
  GREATEST(user_id, friend_user_id)
);

-- ========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ========================================
-- These policies allow public read/write access for the social features
-- Adjust these based on your security requirements

-- Enable RLS on both tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_links ENABLE ROW LEVEL SECURITY;

-- Allow all operations on user_profiles (adjust as needed)
CREATE POLICY "Allow public read access to user_profiles" 
  ON user_profiles FOR SELECT 
  USING (true);

CREATE POLICY "Allow public insert to user_profiles" 
  ON user_profiles FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Allow public update to user_profiles" 
  ON user_profiles FOR UPDATE 
  USING (true);

-- Allow all operations on friend_links (adjust as needed)
CREATE POLICY "Allow public read access to friend_links" 
  ON friend_links FOR SELECT 
  USING (true);

CREATE POLICY "Allow public insert to friend_links" 
  ON friend_links FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Allow public update to friend_links" 
  ON friend_links FOR UPDATE 
  USING (true);

CREATE POLICY "Allow public delete to friend_links" 
  ON friend_links FOR DELETE 
  USING (true);

-- ========================================
-- NOTES
-- ========================================
-- 1. Make sure to configure your Supabase environment variables:
--    - EXPO_PUBLIC_SUPABASE_URL
--    - EXPO_PUBLIC_SUPABASE_ANON_KEY
--
-- 2. The RLS policies above are permissive for development.
--    For production, you should:
--    - Implement proper authentication
--    - Restrict policies to authenticated users
--    - Add row-level checks (e.g., users can only update their own profile)
--
-- 3. The unique index on friend_links prevents duplicate connections
--    between two users, regardless of who initiated the request.
