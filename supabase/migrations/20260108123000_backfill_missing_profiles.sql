-- Backfill profiles for existing auth users that lack a profile row
-- SAFE VERSION: skips rows that would violate unique constraint on student_id
WITH candidates AS (
  SELECT
    u.id,
    nullif(u.raw_user_meta_data->>'student_id','') AS student_id,
    COALESCE(u.raw_user_meta_data->>'full_name', u.email) AS full_name
  FROM auth.users u
)
INSERT INTO public.profiles (id, student_id, full_name, role, status, created_at)
SELECT id, student_id, full_name, 'student', 'pending', NOW()
FROM candidates c
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = c.id)
  AND (c.student_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles p2 WHERE p2.student_id = c.student_id));

-- Note: This will skip any rows that would cause a duplicate student_id error
-- Run once in Supabase SQL editor or via supabase db push
