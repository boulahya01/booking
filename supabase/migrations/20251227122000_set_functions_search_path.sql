-- Migration: set search_path for functions flagged by linter
-- Purpose: avoid role-mutable search_path for SECURITY DEFINER functions
-- Run in staging first and verify functionality.

BEGIN;

-- Set a safe search_path for functions to avoid accidental schema hijacking
ALTER FUNCTION public.upsert_booking_job() SET search_path = public, pg_catalog;
ALTER FUNCTION public.auto_complete_past_bookings() SET search_path = public, pg_catalog;
ALTER FUNCTION public.trg_auto_complete_before_select() SET search_path = public, pg_catalog;
ALTER FUNCTION public.trg_check_booking_completion() SET search_path = public, pg_catalog;
ALTER FUNCTION public.process_booking_completion_jobs() SET search_path = public, pg_catalog;
ALTER FUNCTION public.update_updated_at_timestamp() SET search_path = public, pg_catalog;

COMMIT;

-- Notes:
-- 1) If any ALTER FUNCTION fails because a signature doesn't match, adjust the function name/signature accordingly.
-- 2) Test in staging by running typical flows that call these functions (triggers, RPCs) and confirm no regressions.
