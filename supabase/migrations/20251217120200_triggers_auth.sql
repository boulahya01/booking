-- =====================================================
-- PHASE 3: Triggers & Functions
-- Handles automatic profile creation on user signup
-- =====================================================

-- =====================================================
-- FUNCTION: handle_new_user()
-- Automatically creates a profile entry when a new user
-- signs up in auth.users
-- =====================================================
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
    role,
    status
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'student_id', ''),
    'student',
    'pending'
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- =====================================================
-- TRIGGER: on_auth_user_created
-- Fires after a new user is inserted into auth.users
-- Calls handle_new_user() to create corresponding profile
-- =====================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =====================================================
-- FUNCTION: update_updated_at_timestamp()
-- Automatically updates the updated_at column
-- whenever a row is modified
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- =====================================================
-- TRIGGERS: Auto-update updated_at columns
-- =====================================================
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_timestamp();

DROP TRIGGER IF EXISTS update_bookings_updated_at ON bookings;
CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_timestamp();
