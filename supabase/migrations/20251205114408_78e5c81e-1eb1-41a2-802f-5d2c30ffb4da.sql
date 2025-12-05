-- Fix: Require authentication for all profile access
-- This prevents anonymous/unauthenticated users from attempting to query profiles

-- Drop existing policies to recreate with proper security
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile (no role)" ON profiles;

-- Create policy requiring authentication for viewing own profile
CREATE POLICY "Users can view their own profile"
ON profiles FOR SELECT
USING (auth.uid() IS NOT NULL AND auth.uid() = id);

-- Create policy for updating own profile (excluding role changes)
CREATE POLICY "Users can update their own profile"
ON profiles FOR UPDATE
USING (auth.uid() IS NOT NULL AND auth.uid() = id)
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = id);