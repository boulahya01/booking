-- =====================================================
-- Normalize all existing student IDs to uppercase
-- This ensures consistency with the new UPPER() function
-- in the signup trigger and login function.
-- =====================================================

UPDATE profiles 
SET student_id = UPPER(student_id) 
WHERE student_id IS NOT NULL 
  AND student_id != '';

-- Verify the update
-- SELECT student_id, COUNT(*) FROM profiles GROUP BY student_id;
