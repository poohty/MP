-- ===================================================================
-- RECIPE SHARING TABLES FOR SUPABASE
-- ===================================================================
-- Run this SQL in your Supabase SQL Editor
-- This will create tables to store recipes and enable cookbook sharing
-- ===================================================================

-- ==================
-- 1. RECIPES TABLE
-- ==================

CREATE TABLE IF NOT EXISTS recipes (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  data_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_recipes_owner_user_id ON recipes(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_recipes_category ON recipes(category);
CREATE INDEX IF NOT EXISTS idx_recipes_created_at ON recipes(created_at DESC);

-- ==================
-- 2. RLS POLICIES
-- ==================

-- Enable Row Level Security
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read recipes (we'll filter by friend status in the app)
CREATE POLICY "Anyone can read recipes" ON recipes
  FOR SELECT
  USING (true);

-- Users can insert their own recipes
CREATE POLICY "Users can insert their own recipes" ON recipes
  FOR INSERT
  WITH CHECK (true);

-- Users can update their own recipes
CREATE POLICY "Users can update their own recipes" ON recipes
  FOR UPDATE
  USING (true);

-- Users can delete their own recipes
CREATE POLICY "Users can delete their own recipes" ON recipes
  FOR DELETE
  USING (true);

-- ==================
-- 3. VERIFY SETUP
-- ==================

-- Test that the table was created
SELECT 
  tablename, 
  schemaname 
FROM pg_tables 
WHERE tablename = 'recipes';

-- Check indexes
SELECT 
  indexname, 
  indexdef 
FROM pg_indexes 
WHERE tablename = 'recipes';

-- Check RLS is enabled
SELECT 
  tablename, 
  rowsecurity 
FROM pg_tables 
WHERE tablename = 'recipes';

-- ==================
-- 4. NOTES
-- ==================
-- - The recipes table stores each user's cookbook
-- - owner_user_id links to user_profiles.id
-- - data_json stores the full Recipe object (ingredients, instructions, image, etc.)
-- - RLS policies are permissive for now (we filter by friend status in the app)
-- - For stricter security, you can update RLS policies to check friend_links table
