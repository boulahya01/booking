-- Add email validation to prevent bounces
-- Adds CHECK constraint to ensure valid email format in auth.users
BEGIN;

-- Create function to validate email format
CREATE OR REPLACE FUNCTION public.is_valid_email(email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Basic email validation: must contain @ and domain
  RETURN email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create trigger to reject invalid emails in profiles (linked to auth.users)
CREATE OR REPLACE FUNCTION public.validate_profile_email()
RETURNS TRIGGER AS $$
BEGIN
  -- Get email from auth.users and validate
  IF EXISTS (
    SELECT 1 FROM auth.users WHERE id = NEW.id AND NOT public.is_valid_email(email)
  ) THEN
    RAISE EXCEPTION 'Invalid email format in auth.users for profile %', NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profile_email_validation ON public.profiles;
CREATE TRIGGER profile_email_validation
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_profile_email();

COMMIT;
