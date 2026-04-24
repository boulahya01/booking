-- =====================================================
-- FIX RLS INFINITE RECURSION - USE HELPER FUNCTIONS
-- Root cause: EXISTS (SELECT FROM profiles) subqueries trigger 
-- RLS evaluation recursively, causing infinite loops and 500 errors
-- Solution: Create helper functions that check role/status directly
-- without triggering RLS on the profiles table
-- =====================================================

-- =====================================================
-- HELPER FUNCTION 1: is_admin()
-- Safely checks if current user is an admin
-- Uses SECURITY DEFINER to bypass RLS on internal profile check
-- =====================================================
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Query profile directly with SECURITY DEFINER privilege
  -- This bypasses RLS, so no recursion occurs
  SELECT role INTO user_role FROM profiles 
  WHERE id = auth.uid() 
  LIMIT 1;
  
  RETURN user_role = 'admin';
END;
$$;

-- =====================================================
-- HELPER FUNCTION 2: is_approved()
-- Safely checks if current user is approved
-- Uses SECURITY DEFINER to bypass RLS on internal profile check
-- =====================================================
CREATE OR REPLACE FUNCTION is_approved()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_status TEXT;
BEGIN
  -- Query profile directly with SECURITY DEFINER privilege
  SELECT status INTO user_status FROM profiles 
  WHERE id = auth.uid() 
  LIMIT 1;
  
  RETURN user_status = 'approved';
END;
$$;

-- =====================================================
-- DROP OLD PROBLEMATIC POLICIES
-- =====================================================
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can insert pitches" ON pitches;
DROP POLICY IF EXISTS "Admins can update pitches" ON pitches;
DROP POLICY IF EXISTS "Admins can delete pitches" ON pitches;
DROP POLICY IF EXISTS "Admins can insert slots" ON slots;
DROP POLICY IF EXISTS "Admins can update slots" ON slots;
DROP POLICY IF EXISTS "Admins can delete slots" ON slots;
DROP POLICY IF EXISTS "Admins can view all bookings" ON bookings;
DROP POLICY IF EXISTS "Approved users can create bookings" ON bookings;
DROP POLICY IF EXISTS "Users can update their own bookings" ON bookings;
DROP POLICY IF EXISTS "Admins can delete bookings" ON bookings;
DROP POLICY IF EXISTS "Users can view slots" ON slots;
DROP POLICY IF EXISTS "Users can view available bookings" ON bookings;

-- =====================================================
-- PROFILES TABLE POLICIES (FIXED - NO RECURSION)
-- =====================================================

-- Allow users to view their own profile
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Allow admins to view all profiles (using helper function - NO RECURSION)
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (is_admin());

-- Allow users to update their own profile
CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow admins to update any profile (using helper function - NO RECURSION)
CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- =====================================================
-- PITCHES TABLE POLICIES (FIXED - NO RECURSION)
-- =====================================================

-- All authenticated users can view pitches
CREATE POLICY "Anyone can view pitches"
  ON pitches FOR SELECT
  TO authenticated
  USING (true);

-- Allow admins to insert pitches (using helper function - NO RECURSION)
CREATE POLICY "Admins can insert pitches"
  ON pitches FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- Allow admins to update pitches (using helper function - NO RECURSION)
CREATE POLICY "Admins can update pitches"
  ON pitches FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Allow admins to delete pitches (using helper function - NO RECURSION)
CREATE POLICY "Admins can delete pitches"
  ON pitches FOR DELETE
  TO authenticated
  USING (is_admin());

-- =====================================================
-- SLOTS TABLE POLICIES (FIXED - NO RECURSION)
-- =====================================================

-- All authenticated users can view slots
CREATE POLICY "Anyone can view slots"
  ON slots FOR SELECT
  TO authenticated
  USING (true);

-- Allow admins to insert slots (using helper function - NO RECURSION)
CREATE POLICY "Admins can insert slots"
  ON slots FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- Allow admins to update slots (using helper function - NO RECURSION)
CREATE POLICY "Admins can update slots"
  ON slots FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Allow admins to delete slots (using helper function - NO RECURSION)
CREATE POLICY "Admins can delete slots"
  ON slots FOR DELETE
  TO authenticated
  USING (is_admin());

-- =====================================================
-- BOOKINGS TABLE POLICIES (FIXED - NO RECURSION)
-- =====================================================

-- All authenticated users can view their own bookings
CREATE POLICY "Users can view their own bookings"
  ON bookings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can view all bookings (using helper function - NO RECURSION)
CREATE POLICY "Admins can view all bookings"
  ON bookings FOR SELECT
  TO authenticated
  USING (is_admin());

-- Approved users can insert bookings (using helper function - NO RECURSION)
CREATE POLICY "Approved users can create bookings"
  ON bookings FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND is_approved()
  );

-- Users can update their own bookings
CREATE POLICY "Users can update their own bookings"
  ON bookings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins can delete bookings (using helper function - NO RECURSION)
CREATE POLICY "Admins can delete bookings"
  ON bookings FOR DELETE
  TO authenticated
  USING (is_admin());
