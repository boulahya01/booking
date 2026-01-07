-- =====================================================
-- ADD DELETE POLICY FOR PROFILES TABLE (ADMIN ONLY)
-- Allows admins to delete user profiles
-- Uses is_admin() helper function to prevent RLS recursion
-- =====================================================

CREATE POLICY "Admins can delete profiles"
  ON profiles FOR DELETE
  TO authenticated
  USING (is_admin());
