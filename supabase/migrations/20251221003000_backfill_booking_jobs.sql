-- Backfill booking_jobs for all existing active bookings
-- This ensures bookings created before the job system have completion jobs

INSERT INTO public.booking_jobs (booking_id, run_at, status)
SELECT 
  b.id,
  COALESCE(b.slot_datetime_end, b.slot_datetime + INTERVAL '1 hour', s.datetime_end),
  'pending'
FROM public.bookings b
LEFT JOIN public.slots s ON b.slot_id = s.id
WHERE b.status = 'active'
  AND NOT EXISTS (SELECT 1 FROM public.booking_jobs WHERE booking_id = b.id)
ON CONFLICT DO NOTHING;

-- Verify backfill
SELECT COUNT(*) as jobs_created FROM public.booking_jobs WHERE status = 'pending';
