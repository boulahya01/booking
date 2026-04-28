-- Migration: Email Verification Auto-Approval
-- Created: 2026-04-28
-- Purpose: Replace manual admin approval with automatic approval on email verification.
--          Remove photo verification columns (id_photo_url, selfie_url, verification_status, etc.)
--          Keep student_id + email (@usmba.ac.ma) verification only.

-- ============================================================================
-- STEP 1: Create on_email_verified trigger function
-- When a user verifies their email, automatically approve their account.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_email_verification()
RETURNS TRIGGER AS $$
BEGIN
  -- When auth.users.email_confirmed_at is set (email verified),
  -- update the corresponding profile status to 'approved'
  IF NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL THEN
    UPDATE public.profiles
    SET status = 'approved',
        updated_at = NOW()
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users table
DROP TRIGGER IF EXISTS on_email_verified ON auth.users;
CREATE TRIGGER on_email_verified
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_email_verification();

-- ============================================================================
-- STEP 2: Also auto-approve existing users who already verified their email
-- ============================================================================

UPDATE public.profiles
SET status = 'approved',
    updated_at = NOW()
WHERE status = 'pending'
  AND id IN (
    SELECT id FROM auth.users WHERE email_confirmed_at IS NOT NULL
  );

-- ============================================================================
-- STEP 3: Remove photo verification columns from profiles table
-- ============================================================================

-- Drop columns that are no longer needed
ALTER TABLE public.profiles DROP COLUMN IF EXISTS id_photo_url;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS selfie_url;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS verification_status;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS verification_notes;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS verified_by;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS verified_at;

-- Note: Keep rejection_reason for now (admins can still manually reject if needed)
-- Note: Keep status column (pending/approved/rejected/suspended)

-- ============================================================================
-- STEP 4: Update create_profile_on_auth_signup trigger to not set photo fields
-- (No changes needed - the trigger only sets student_id, full_name, role, status)
-- ============================================================================

-- ============================================================================
-- STEP 5: Clean up storage bucket (id-photos bucket no longer needed)
-- ============================================================================

-- Storage tables are owned by supabase_storage_admin, so we can't DELETE directly.
-- Use the storage API function or simply drop policies and leave the bucket orphaned.
-- The bucket will become unused since no code references it anymore.

-- Option 1: Try using storage management function (if available)
DO $$
BEGIN
  -- Attempt to delete via storage management
  PERFORM storage.delete_bucket('id-photos');
EXCEPTION WHEN OTHERS THEN
  -- If the function doesn't available, just ignore - bucket will be orphaned but harmless
  RAISE NOTICE 'Could not delete id-photos bucket via storage API: %. Bucket will be orphaned.', SQLERRM;
END $$;

-- ============================================================================
-- DONE
-- ============================================================================
