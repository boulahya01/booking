-- =====================================================
-- Migration: Fix profiles table for existing users
-- Ensures all profiles have valid full_name values
-- =====================================================

-- Update any NULL full_name values to empty string
UPDATE profiles SET full_name = '' WHERE full_name IS NULL;

-- Ensure full_name is NOT NULL
ALTER TABLE profiles ALTER COLUMN full_name SET NOT NULL;
