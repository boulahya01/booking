-- =====================================================
-- Modify bookings table to support virtual slots
-- Make slot_id nullable, add constraints for virtual slot data
-- =====================================================

-- Make slot_id nullable to support virtual slots
ALTER TABLE bookings
ALTER COLUMN slot_id DROP NOT NULL;

-- Add unique constraint: either slot_id XOR (pitch_id + slot_datetime) must exist
-- This ensures no double-booking on the same slot/datetime
CREATE UNIQUE INDEX idx_bookings_unique_slot ON bookings(
  CASE WHEN slot_id IS NOT NULL THEN slot_id::TEXT ELSE pitch_id::TEXT || '-' || slot_datetime::TEXT END
) 
WHERE status = 'active';

-- Update existing bookings that have slot_id to have both virtual and real references
ALTER TABLE bookings
ADD CONSTRAINT valid_booking CHECK (
  (slot_id IS NOT NULL) OR (pitch_id IS NOT NULL AND slot_datetime IS NOT NULL)
);

COMMENT ON TABLE bookings IS 'Bookings can reference either real slots (slot_id) or virtual slots (pitch_id + slot_datetime)';
