-- =====================================================
-- PHASE 2: Add Opening/Closing Hours to Pitches
-- Enables automatic hourly slot generation
-- =====================================================

-- Add open_time and close_time columns to pitches table
-- Times are stored as TIME type (HH:MM:SS format)
-- Default: 08:00 (8 AM) to 22:00 (10 PM)
ALTER TABLE pitches
ADD COLUMN open_time TIME NOT NULL DEFAULT '08:00',
ADD COLUMN close_time TIME NOT NULL DEFAULT '22:00';

-- Add CHECK constraint to ensure open_time < close_time
ALTER TABLE pitches
ADD CONSTRAINT valid_opening_hours CHECK (open_time < close_time);

-- Create indexes on time columns for faster queries
CREATE INDEX idx_pitches_open_time ON pitches(open_time);
CREATE INDEX idx_pitches_close_time ON pitches(close_time);
