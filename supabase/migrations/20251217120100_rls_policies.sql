-- =====================================================
-- PHASE 2: Row Level Security (RLS) Policies
-- Defines access control for all tables
-- =====================================================

-- =====================================================
-- PROFILES TABLE POLICIES
-- Control who can view and modify user profiles
-- =====================================================

-- Allow users to view their own profile
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Allow admins to view all profiles
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- Allow users to update their own profile (name, email, etc. but not role/status)
CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT role FROM profiles WHERE id = auth.uid())
    AND status = (SELECT status FROM profiles WHERE id = auth.uid())
  );

-- Allow admins to update any profile
CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- Allow system to insert profiles on signup (via trigger)
CREATE POLICY "System can insert profiles on signup"
  ON profiles FOR INSERT
  WITH CHECK (true);

-- =====================================================
-- PITCHES TABLE POLICIES
-- Pitches are publicly readable, only admins can modify
-- =====================================================

-- Allow all authenticated users to view pitches
CREATE POLICY "Authenticated users can view pitches"
  ON pitches FOR SELECT
  TO authenticated
  USING (true);

-- Allow admins to insert pitches
CREATE POLICY "Admins can insert pitches"
  ON pitches FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- Allow admins to update pitches
CREATE POLICY "Admins can update pitches"
  ON pitches FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- Allow admins to delete pitches
CREATE POLICY "Admins can delete pitches"
  ON pitches FOR DELETE
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- =====================================================
-- SLOTS TABLE POLICIES
-- Slots are publicly readable, admins manage availability
-- =====================================================

-- Allow all authenticated users to view slots
CREATE POLICY "Authenticated users can view slots"
  ON slots FOR SELECT
  TO authenticated
  USING (true);

-- Allow admins to insert slots
CREATE POLICY "Admins can insert slots"
  ON slots FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- Allow admins to update slots
CREATE POLICY "Admins can update slots"
  ON slots FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- Allow admins to delete slots
CREATE POLICY "Admins can delete slots"
  ON slots FOR DELETE
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- =====================================================
-- BOOKINGS TABLE POLICIES
-- Control who can view and manage bookings
-- =====================================================

-- Allow users to view their own bookings
CREATE POLICY "Users can view their own bookings"
  ON bookings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow admins to view all bookings
CREATE POLICY "Admins can view all bookings"
  ON bookings FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- Allow approved users to insert bookings (only their own)
CREATE POLICY "Approved users can create bookings"
  ON bookings FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (SELECT status FROM profiles WHERE id = auth.uid()) = 'approved'
  );

-- Allow users to update their own active bookings
CREATE POLICY "Users can update their own bookings"
  ON bookings FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND status = 'active'
  );

-- Allow admins to update any booking
CREATE POLICY "Admins can update all bookings"
  ON bookings FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- Allow users to delete their own bookings
CREATE POLICY "Users can delete their own bookings"
  ON bookings FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow admins to delete any booking
CREATE POLICY "Admins can delete all bookings"
  ON bookings FOR DELETE
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );
