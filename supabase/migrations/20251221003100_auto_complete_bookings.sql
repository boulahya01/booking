-- =====================================================
-- Auto-complete bookings using PostgreSQL triggers
-- Marks bookings as 'completed' when their slot ends
-- No external scheduler needed - pure database logic
-- =====================================================

-- Function to mark past bookings as completed
-- This will be called in various places to ensure consistency
CREATE OR REPLACE FUNCTION public.auto_complete_past_bookings()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.bookings
  SET status = 'completed'
  WHERE status = 'active'
    AND slot_datetime_end IS NOT NULL
    AND slot_datetime_end < NOW()
    AND status <> 'completed';
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.auto_complete_past_bookings() TO authenticated, anon;

-- Trigger on bookings table: auto-complete on SELECT queries
-- This ensures whenever bookings are fetched, past ones are marked completed
CREATE OR REPLACE FUNCTION public.trg_auto_complete_before_select()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Mark all past active bookings as completed
  UPDATE public.bookings
  SET status = 'completed'
  WHERE status = 'active'
    AND slot_datetime_end IS NOT NULL
    AND slot_datetime_end < NOW();
END;
$$;

-- Also create a function that runs on booking inserts/updates
-- to immediately mark the booking if its slot has already passed
CREATE OR REPLACE FUNCTION public.trg_check_booking_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- If this is a new active booking with a slot that has already ended, mark it completed immediately
  IF NEW.status = 'active' AND NEW.slot_datetime_end IS NOT NULL THEN
    IF NEW.slot_datetime_end < NOW() THEN
      NEW.status = 'completed';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Attach trigger to bookings before insert/update
DROP TRIGGER IF EXISTS trg_check_booking_completion ON public.bookings;
CREATE TRIGGER trg_check_booking_completion
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.trg_check_booking_completion();

-- Create a cleanup function that marks bookings completed via job processing
-- This is the function that will be called by process-booking-jobs edge function
CREATE OR REPLACE FUNCTION public.process_booking_completion_jobs()
RETURNS TABLE(processed_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  -- Update booking status for all due jobs
  WITH due_jobs AS (
    SELECT bj.id, bj.booking_id
    FROM public.booking_jobs bj
    WHERE bj.status = 'pending'
      AND bj.run_at <= NOW()
    LIMIT 100
  )
  UPDATE public.bookings b
  SET status = 'completed'
  WHERE b.id IN (SELECT booking_id FROM due_jobs)
    AND b.status = 'active';

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Mark those jobs as processed
  WITH due_jobs AS (
    SELECT bj.id
    FROM public.booking_jobs bj
    WHERE bj.status = 'pending'
      AND bj.run_at <= NOW()
    LIMIT 100
  )
  UPDATE public.booking_jobs bj
  SET status = 'processed', processed_at = NOW()
  WHERE bj.id IN (SELECT id FROM due_jobs);

  RETURN QUERY SELECT v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_booking_completion_jobs() TO authenticated, anon;
