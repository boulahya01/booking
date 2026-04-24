-- Prevent non-admin users from modifying verification fields except allowed transition
-- Generated: 2026-04-18
BEGIN;

CREATE OR REPLACE FUNCTION profiles_verify_fields_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (NEW.verification_status IS DISTINCT FROM OLD.verification_status
        OR NEW.verified_by IS DISTINCT FROM OLD.verified_by
        OR NEW.verified_at IS DISTINCT FROM OLD.verified_at) THEN
      -- allow admins to change verification fields
      IF is_admin() THEN
        RETURN NEW;
      END IF;
      -- allow users to set verification_status from 'unsubmitted' -> 'pending' (when uploading ID)
      IF OLD.verification_status = 'unsubmitted'
         AND NEW.verification_status = 'pending'
         AND NEW.verified_by IS NULL
         AND NEW.verified_at IS NULL THEN
        RETURN NEW;
      END IF;
      RAISE EXCEPTION 'Only admins may modify verification fields';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_verify_fields_guard ON profiles;
CREATE TRIGGER trg_profiles_verify_fields_guard
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE PROCEDURE profiles_verify_fields_guard();

COMMIT;
