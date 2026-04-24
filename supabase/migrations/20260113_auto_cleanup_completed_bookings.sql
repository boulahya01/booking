-- =====================================================
-- Auto-cleanup: Delete completed bookings after 7 days
-- Runs as a database trigger (SECURITY DEFINER)
-- ZERO API COST - runs inside the database
-- =====================================================

-- Function to clean up old completed bookings (>7 days old)
CREATE OR REPLACE FUNCTION public.cleanup_old_completed_bookings()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO public
AS $$
  DELETE FROM public.bookings
  WHERE status = 'completed'
    AND created_at < NOW() - INTERVAL '7 days';
$$;

-- Grant permission to authenticated users
GRANT EXECUTE ON FUNCTION public.cleanup_old_completed_bookings() TO authenticated, anon;

-- Create a trigger that cleans up automatically
-- Runs after any INSERT or UPDATE on bookings
CREATE OR REPLACE FUNCTION public.trg_cleanup_completed_on_query()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  -- Clean up completed bookings older than 7 days (runs silently in background)
  DELETE FROM public.bookings
  WHERE status = 'completed'
    AND created_at < NOW() - INTERVAL '7 days';
  
  RETURN NULL;
END;
$$;

-- Attach the cleanup trigger to run whenever bookings are modified
DROP TRIGGER IF EXISTS trg_cleanup_completed_on_query ON public.bookings;
CREATE TRIGGER trg_cleanup_completed_on_query
  AFTER INSERT OR UPDATE ON public.bookings
  FOR EACH STATEMENT EXECUTE FUNCTION public.trg_cleanup_completed_on_query();
