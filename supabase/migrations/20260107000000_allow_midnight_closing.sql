-- =====================================================
-- Allow midnight (24:00) as closing time for overnight pitches
-- Enables pitches to close at midnight next day
-- =====================================================

-- Drop existing constraint
ALTER TABLE pitches
DROP CONSTRAINT valid_opening_hours;

-- Add new constraint that allows close_time = '24:00'
-- Interpretation: close_time = '24:00' means the pitch closes at midnight (00:00 next day)
ALTER TABLE pitches
ADD CONSTRAINT valid_opening_hours 
CHECK (
  open_time < close_time OR close_time = '24:00'::time
);

-- Comment for clarity
COMMENT ON CONSTRAINT valid_opening_hours ON pitches IS 
'Open time must be before close time, or close_time can be 24:00 (midnight next day)';
