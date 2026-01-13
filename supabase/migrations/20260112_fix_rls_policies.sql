DROP POLICY IF EXISTS "bookings_read" ON bookings;
DROP POLICY IF EXISTS "bookings_create" ON bookings;
DROP POLICY IF EXISTS "bookings_update" ON bookings;
DROP POLICY IF EXISTS "bookings_delete" ON bookings;
-- Allow all authenticated users to view all bookings (intentional)
CREATE POLICY "bookings_select" ON bookings FOR SELECT
  TO authenticated
  USING (true);
-- Allow users to create only their own bookings
CREATE POLICY "bookings_insert" ON bookings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "bookings_update_admin" ON bookings FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- Allow users to update their own bookings (change status to cancelled)
CREATE POLICY "bookings_update_own" ON bookings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "bookings_delete_admin" ON bookings FOR DELETE
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- Allow users to delete their own bookings (cancel)
CREATE POLICY "bookings_delete_own" ON bookings FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
-- Drop old permissive pitches policies
DROP POLICY IF EXISTS "pitches_read" ON pitches;
DROP POLICY IF EXISTS "pitches_write" ON pitches;
DROP POLICY IF EXISTS "pitches_update" ON pitches;
DROP POLICY IF EXISTS "pitches_delete" ON pitches;

-- Allow all authenticated users to view pitches
CREATE POLICY "pitches_select" ON pitches FOR SELECT
  TO authenticated
  USING (true);

-- Allow only admins to insert pitches
CREATE POLICY "pitches_insert" ON pitches FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- Allow only admins to update pitches
CREATE POLICY "pitches_update" ON pitches FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- Allow only admins to delete pitches
CREATE POLICY "pitches_delete" ON pitches FOR DELETE
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );
DROP POLICY IF EXISTS "slots_read" ON slots;
DROP POLICY IF EXISTS "slots_write" ON slots;
DROP POLICY IF EXISTS "slots_update" ON slots;
DROP POLICY IF EXISTS "slots_delete" ON slots;
CREATE POLICY "slots_select" ON slots FOR SELECT
  TO authenticated
  USING (true);
CREATE POLICY "slots_insert" ON slots FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );
CREATE POLICY "slots_update" ON slots FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- Allow only admins to delete slots
CREATE POLICY "slots_delete" ON slots FOR DELETE
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );
CREATE POLICY "booking_jobs_deny_all" ON booking_jobs FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "profiles_insert" ON profiles;

CREATE POLICY "profiles_insert" ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (false);
