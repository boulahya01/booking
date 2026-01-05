-- =====================================================
-- Migration: Add full_name to profiles table
-- Adds full_name field for user identification
-- =====================================================

-- Add full_name column to profiles table (nullable first)
ALTER TABLE profiles
ADD COLUMN full_name TEXT DEFAULT '';

-- Update existing rows to have empty string instead of NULL
UPDATE profiles SET full_name = '' WHERE full_name IS NULL;

-- Now make it NOT NULL since all existing rows have values
ALTER TABLE profiles ALTER COLUMN full_name SET NOT NULL;

-- Update trigger to extract full_name from auth metadata
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    student_id,
    full_name,
    role,
    status
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'student_id', ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'student',
    'pending'
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Create index on full_name for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_full_name ON profiles(full_name);
