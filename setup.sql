-- Run this SQL in your Supabase SQL Editor to prepare your database.

-- 1. Create the custom schema
CREATE SCHEMA IF NOT EXISTS library_management;

-- 2. Create the Auth/Users table if it doesn't already exist
CREATE TABLE IF NOT EXISTS library_management.auth (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  user_type TEXT DEFAULT 'User',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. (Optional) Enable Row Level Security (RLS)
ALTER TABLE library_management.auth ENABLE ROW LEVEL SECURITY;

-- 4. Simple Policy: Allow all operations for now (for development purposes)
CREATE POLICY "Enable all for all" 
ON library_management.auth 
FOR ALL USING (true);
