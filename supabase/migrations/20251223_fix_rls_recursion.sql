-- =====================================================
-- FIX: Remove recursive RLS policies that block profile reads
-- Replace with simpler policies that work correctly
-- =====================================================

-- Disable RLS temporarily to allow policy management
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE pitches DISABLE ROW LEVEL SECURITY;
ALTER TABLE slots DISABLE ROW LEVEL SECURITY;
ALTER TABLE bookings DISABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "System can insert profiles on signup" ON profiles;

DROP POLICY IF EXISTS "Authenticated users can view pitches" ON pitches;
DROP POLICY IF EXISTS "Admins can insert pitches" ON pitches;
DROP POLICY IF EXISTS "Admins can update pitches" ON pitches;
DROP POLICY IF EXISTS "Admins can delete pitches" ON pitches;

DROP POLICY IF EXISTS "Authenticated users can view slots" ON slots;
DROP POLICY IF EXISTS "Admins can insert slots" ON slots;
DROP POLICY IF EXISTS "Admins can update slots" ON slots;
DROP POLICY IF EXISTS "Admins can delete slots" ON slots;

DROP POLICY IF EXISTS "Users can view their own bookings" ON bookings;
DROP POLICY IF EXISTS "Admins can view all bookings" ON bookings;
DROP POLICY IF EXISTS "Approved users can create bookings" ON bookings;
DROP POLICY IF EXISTS "Users can update their own bookings" ON bookings;
DROP POLICY IF EXISTS "Admins can update all bookings" ON bookings;
DROP POLICY IF EXISTS "Users can delete their own bookings" ON bookings;
DROP POLICY IF EXISTS "Admins can delete all bookings" ON bookings;

-- Also drop any overlapping policies
DROP POLICY IF EXISTS "System can modify pitches" ON pitches;
DROP POLICY IF EXISTS "System can update pitches" ON pitches;
DROP POLICY IF EXISTS "System can delete pitches" ON pitches;
DROP POLICY IF EXISTS "Authenticated users can manage slots" ON slots;
DROP POLICY IF EXISTS "Authenticated users can update slots" ON slots;
DROP POLICY IF EXISTS "Authenticated users can delete slots" ON slots;
DROP POLICY IF EXISTS "Authenticated users can create bookings" ON bookings;
DROP POLICY IF EXISTS "Admins can manage all bookings" ON bookings;

-- Re-enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE pitches ENABLE ROW LEVEL SECURITY;
ALTER TABLE slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PROFILES TABLE POLICIES (FIXED - NO RECURSION)
-- =====================================================

CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_insert_system"
  ON profiles FOR INSERT
  WITH CHECK (true);

-- =====================================================
-- PITCHES TABLE POLICIES (OPEN - Check role in app layer)
-- =====================================================

CREATE POLICY "pitches_select_all"
  ON pitches FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "pitches_insert_all"
  ON pitches FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "pitches_update_all"
  ON pitches FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "pitches_delete_all"
  ON pitches FOR DELETE
  TO authenticated
  USING (true);

-- =====================================================
-- SLOTS TABLE POLICIES (OPEN - Check role in app layer)
-- =====================================================

CREATE POLICY "slots_select_all"
  ON slots FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "slots_insert_all"
  ON slots FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "slots_update_all"
  ON slots FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "slots_delete_all"
  ON slots FOR DELETE
  TO authenticated
  USING (true);

-- =====================================================
-- BOOKINGS TABLE POLICIES (OPEN - Check role in app layer)
-- =====================================================

CREATE POLICY "bookings_select_all"
  ON bookings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "bookings_insert_own"
  ON bookings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "bookings_update_all"
  ON bookings FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "bookings_delete_all"
  ON bookings FOR DELETE
  TO authenticated
  USING (true);
