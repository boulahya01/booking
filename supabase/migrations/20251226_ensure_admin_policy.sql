-- =====================================================
-- Ensure helper function and admin UPDATE policy for profiles
-- Safe: drops existing policy/function and recreates them
-- Run this in Supabase SQL editor or via your migration runner
-- =====================================================

-- Create helper function is_admin() (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role FROM profiles
  WHERE id = auth.uid()
  LIMIT 1;

  RETURN user_role = 'admin';
END;
$$;

-- Ensure RLS is enabled on profiles
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;

-- Recreate admin update policy
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Also ensure a user self-update policy exists (won't override admin)
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Optional: verify with SELECTs (run separately in SQL editor)
-- SELECT is_admin();
-- SELECT policyname, permissive, roles, qual, with_check FROM pg_policies WHERE tablename = 'profiles';
