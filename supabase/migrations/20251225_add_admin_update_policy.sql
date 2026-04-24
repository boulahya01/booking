-- =====================================================
-- ADD ADMIN UPDATE POLICY FOR PROFILES
-- =====================================================
-- This migration adds an admin UPDATE policy to allow
-- admins to approve/reject pending users.
--
-- The aggressive RLS fix (20251223) removed all admin
-- policies. This re-adds the UPDATE policy for admins
-- while keeping the user self-update policy intact.
-- =====================================================

-- Add admin UPDATE policy for profiles
-- Allows admins to update any profile (e.g., change status to approved/rejected)
CREATE POLICY "profiles_update_admin" 
  ON profiles 
  FOR UPDATE 
  TO authenticated 
  USING (is_admin()) 
  WITH CHECK (is_admin());

-- Verify both policies exist
-- User can update own profile
-- Admin can update any profile
-- The USING clause determines which rows can be accessed
-- The WITH CHECK clause determines which row updates are allowed
