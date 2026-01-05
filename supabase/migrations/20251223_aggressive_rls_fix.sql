-- =====================================================
-- AGGRESSIVE FIX: Remove ALL RLS policies and rebuild
-- =====================================================

-- Disable RLS on all tables to allow modifications
ALTER TABLE IF EXISTS profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS pitches DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS slots DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS bookings DISABLE ROW LEVEL SECURITY;

-- Delete ALL policies from profiles table
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'profiles')
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || pol.policyname || '" ON profiles';
  END LOOP;
END $$;

-- Delete ALL policies from pitches table
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'pitches')
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || pol.policyname || '" ON pitches';
  END LOOP;
END $$;

-- Delete ALL policies from slots table
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'slots')
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || pol.policyname || '" ON slots';
  END LOOP;
END $$;

-- Delete ALL policies from bookings table
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'bookings')
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || pol.policyname || '" ON bookings';
  END LOOP;
END $$;

-- Re-enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE pitches ENABLE ROW LEVEL SECURITY;
ALTER TABLE slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Create new clean policies (no recursion)
-- PROFILES: Users can only see/edit their own
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (true);

-- PITCHES: All authenticated users can read, write checks are in app layer
CREATE POLICY "pitches_read" ON pitches FOR SELECT TO authenticated USING (true);
CREATE POLICY "pitches_write" ON pitches FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "pitches_update" ON pitches FOR UPDATE TO authenticated USING (true);
CREATE POLICY "pitches_delete" ON pitches FOR DELETE TO authenticated USING (true);

-- SLOTS: All authenticated users can read, write checks are in app layer
CREATE POLICY "slots_read" ON slots FOR SELECT TO authenticated USING (true);
CREATE POLICY "slots_write" ON slots FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "slots_update" ON slots FOR UPDATE TO authenticated USING (true);
CREATE POLICY "slots_delete" ON slots FOR DELETE TO authenticated USING (true);

-- BOOKINGS: Users can see all (app layer will filter), create only their own
CREATE POLICY "bookings_read" ON bookings FOR SELECT TO authenticated USING (true);
CREATE POLICY "bookings_create" ON bookings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "bookings_update" ON bookings FOR UPDATE TO authenticated USING (true);
CREATE POLICY "bookings_delete" ON bookings FOR DELETE TO authenticated USING (true);
