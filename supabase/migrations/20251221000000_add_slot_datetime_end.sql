-- Add slot_datetime_end to bookings so we can reliably detect slot end time
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS slot_datetime_end TIMESTAMP WITH TIME ZONE;

-- Optional: backfill slot_datetime_end for existing rows where slot_datetime exists
-- Assuming default slot length is 1 hour for virtual slots
UPDATE bookings
SET slot_datetime_end = slot_datetime + INTERVAL '1 hour'
WHERE slot_datetime IS NOT NULL AND slot_datetime_end IS NULL;

-- Note: for bookings referencing real slots (slot_id), the canonical source
-- of end time remains the `slots.datetime_end` column.
