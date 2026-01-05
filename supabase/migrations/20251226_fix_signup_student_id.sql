-- =====================================================
-- Fix signup trigger to avoid duplicate empty student_id
-- When signup doesn't provide student_id in raw_user_meta_data,
-- generate a unique placeholder using gen_random_uuid().
-- This prevents UNIQUE constraint violations on student_id when
-- many users don't supply student IDs.
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    student_id,
    role,
    status
  )
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'student_id', ''), gen_random_uuid()::text),
    'student',
    'pending'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Notes:
-- Uses NULLIF(..., '') to treat empty strings as NULL and fallback to gen_random_uuid().
-- Apply this migration in Supabase SQL editor or via migration runner.
