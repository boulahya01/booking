-- Migration: replace per-row auth function calls with (select auth.uid())
-- Purpose: avoid re-evaluating auth.uid() for each row in RLS policies (performance)
-- Run this in staging first and verify behavior before applying to production.

BEGIN;

-- Safe approach: DROP the policy if it exists, then CREATE it with the desired expression.
-- This avoids "policy ... does not exist" errors when running the migration in different environments.

-- Profiles: ensure SELECT policy exists and uses (select auth.uid())
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = id);

-- Profiles: UPDATE policy (profiles_update_own)
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

-- Bookings: INSERT policy (Approved users can create bookings)
DROP POLICY IF EXISTS "Approved users can create bookings" ON public.bookings;
CREATE POLICY "Approved users can create bookings" ON public.bookings
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id AND is_approved());

COMMIT;

-- Notes:
-- 1) Run in staging first. If your project uses different policy names, adjust the quoted names above.
-- 2) After deployment, run representative queries and compare EXPLAIN ANALYZE to confirm performance improvements.
