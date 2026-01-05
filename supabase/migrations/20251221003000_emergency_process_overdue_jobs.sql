-- ====================================================================
-- EMERGENCY FIX: Process all overdue booking jobs immediately
-- This script marks all bookings as completed if their job run_at < NOW
-- ====================================================================

-- Step 1: Mark all overdue jobs as processed and complete their bookings
SELECT public.process_booking_completion_jobs();

-- Step 2: Verify completion
SELECT 
  COUNT(*) as total_bookings,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
  COUNT(CASE WHEN status = 'active' AND slot_datetime_end < NOW() THEN 1 END) as still_active_past_count
FROM public.bookings;
