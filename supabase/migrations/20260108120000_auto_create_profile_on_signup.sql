-- =====================================================
-- AUTO-CREATE PROFILE TRIGGER
-- When a new auth user is created, automatically create
-- a corresponding profile row with default values
-- =====================================================

-- Drop existing trigger if it exists (to replace with improved version)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_new ON auth.users;

-- Create the trigger function
CREATE OR REPLACE FUNCTION public.create_profile_on_auth_signup()
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
    status,
    created_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'student_id', ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'student',
    'pending',
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Create the trigger on auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_profile_on_auth_signup();

-- Add comment for documentation
COMMENT ON FUNCTION public.create_profile_on_auth_signup() IS 'Automatically creates a profile row when a new auth user signs up. Prevents client-side profile creation and race conditions.';
