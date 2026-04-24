-- Function to upsert job for a booking when booking is created/updated/deleted
CREATE OR REPLACE FUNCTION public.upsert_booking_job()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_run_at TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Decide which row to use (NEW on insert/update, OLD on delete)
  IF (TG_OP = 'DELETE') THEN
    -- On delete, remove job if exists
    DELETE FROM public.booking_jobs WHERE booking_id = OLD.id;
    RETURN OLD;
  END IF;

  -- For INSERT or UPDATE use NEW
  IF (NEW.slot_datetime_end IS NOT NULL) THEN
    target_run_at := NEW.slot_datetime_end;
  ELSIF (NEW.slot_datetime IS NOT NULL) THEN
    -- fallback: assume 1 hour duration
    target_run_at := NEW.slot_datetime + INTERVAL '1 hour';
  ELSE
    -- If booking references a real slot, try to fetch slot.datetime_end
    SELECT s.datetime_end INTO target_run_at FROM public.slots s WHERE s.id = NEW.slot_id LIMIT 1;
  END IF;

  IF target_run_at IS NULL THEN
    -- If we still don't have an end time, do nothing
    RETURN NEW;
  END IF;

  IF NEW.status <> 'active' THEN
    -- If booking not active, remove any pending job
    DELETE FROM public.booking_jobs WHERE booking_id = NEW.id AND status = 'pending';
    RETURN NEW;
  END IF;

  -- Upsert job for this booking
  INSERT INTO public.booking_jobs (booking_id, run_at, status)
  VALUES (NEW.id, target_run_at, 'pending')
  ON CONFLICT (booking_id) DO UPDATE
    SET run_at = EXCLUDED.run_at,
        status = CASE WHEN public.booking_jobs.status = 'processed' THEN public.booking_jobs.status ELSE EXCLUDED.status END,
        created_at = public.booking_jobs.created_at;

  RETURN NEW;
END;
$$;

-- Trigger: after insert or update on bookings, call upsert_booking_job
DROP TRIGGER IF EXISTS trg_upsert_booking_job ON public.bookings;
CREATE TRIGGER trg_upsert_booking_job
  AFTER INSERT OR UPDATE OR DELETE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.upsert_booking_job();
