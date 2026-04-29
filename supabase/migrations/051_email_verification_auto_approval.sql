-- Migration: Email Verification Auto-Approval
-- Created: 2026-04-28
-- This script is safe to run regardless of current database state.
-- It checks for column existence before dropping and handles all cases.

-- ============================================================================
-- STEP 1: Recreate ALL triggers that reference columns we may drop
-- Must happen BEFORE dropping columns.
-- ============================================================================

-- Recreate create_profile_on_auth_signup - only uses columns that ALWAYS exist
CREATE OR REPLACE FUNCTION public.create_profile_on_auth_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, student_id, full_name, role, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'student_id', ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'student',
    'pending'
  );
  RETURN NEW;
END;
$$;

-- Recreate profiles_verify_fields_guard - no column references, just passthrough
CREATE OR REPLACE FUNCTION profiles_verify_fields_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN NEW;
END;
$$;

-- Recreate enforce_verification_fields - only uses rejection_reason if it exists
CREATE OR REPLACE FUNCTION enforce_verification_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only check rejection_reason if the column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'rejection_reason'
  ) THEN
    IF NEW.id = auth.uid() THEN
      IF NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason THEN
        RAISE EXCEPTION 'You cannot update your own rejection reason';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Recreate trigger on all possible columns (use DROP + CREATE to handle missing columns)
DROP TRIGGER IF EXISTS trg_enforce_verification_fields ON profiles;

-- ============================================================================
-- STEP 2: Drop photo/verification columns (only if they exist)
-- ============================================================================

DO $$
DECLARE
  col_name TEXT;
  cols_to_drop TEXT[] := ARRAY[
    'id_photo_url', 'selfie_url', 'verification_status',
    'verification_notes', 'verified_by', 'verified_at', 'rejection_reason'
  ];
BEGIN
  FOREACH col_name IN ARRAY cols_to_drop
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = col_name
    ) THEN
      EXECUTE format('ALTER TABLE public.profiles DROP COLUMN %I', col_name);
      RAISE NOTICE 'Dropped column: %', col_name;
    ELSE
      RAISE NOTICE 'Column already dropped: %', col_name;
    END IF;
  END LOOP;
END $$;

-- Drop index that references dropped column
DROP INDEX IF EXISTS idx_profiles_verification_status;

-- ============================================================================
-- STEP 3: Create on_email_verified trigger - auto-approve on email verification
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_email_verification()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL THEN
    UPDATE public.profiles
    SET status = 'approved',
        updated_at = NOW()
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_email_verified ON auth.users;
CREATE TRIGGER on_email_verified
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_email_verification();

-- ============================================================================
-- STEP 4: Auto-approve existing users who already verified their email
-- ============================================================================

UPDATE public.profiles
SET status = 'approved',
    updated_at = NOW()
WHERE status = 'pending'
  AND id IN (
    SELECT id FROM auth.users WHERE email_confirmed_at IS NOT NULL
  );

-- ============================================================================
-- STEP 5: Clean up storage buckets (best effort)
-- ============================================================================

DO $$
BEGIN
  PERFORM storage.delete_bucket('id-photos');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not delete id-photos bucket: %. Bucket will be orphaned.', SQLERRM;
END $$;

DO $$
BEGIN
  PERFORM storage.delete_bucket('selfies');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not delete selfies bucket: %. Bucket will be orphaned.', SQLERRM;
END $$;

-- ============================================================================
-- DONE
-- ============================================================================
