-- Migration: drop duplicate index flagged by linter
-- Drop the index `idx_bookings_pitch_id` if it exists. Verify in staging first.

BEGIN;

-- Safe drop: use IF EXISTS so this migration is idempotent
DROP INDEX IF EXISTS idx_bookings_pitch_id;

COMMIT;

-- Notes:
-- 1) Before applying, check index usage in staging: query pg_stat_user_indexes for idx_scan values.
-- 2) If you need to rollback, recreate the index with a follow-up migration or restore from backup.
