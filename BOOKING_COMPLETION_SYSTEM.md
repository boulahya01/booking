# Booking Completion System - Complete Architecture

## Problem Analysis

Your booking from 2025-12-20 is still `active` even though `slot_datetime_end = 2025-12-20T10:00:00+00:00` (past). This happens because:

1. **The booking existed BEFORE the job system was created** → No job entry in `booking_jobs` table
2. **The job scheduler was never invoked** → Even if jobs existed, nothing runs them

## Solution: Three-Layer Cleanup System

### Layer 1: PostgreSQL Trigger (AUTO-INSERTS JOBS)
**File**: `supabase/migrations/20251221002100_create_booking_jobs_trigger.sql`

- **When**: AFTER INSERT/UPDATE/DELETE on `bookings`
- **What it does**: 
  - Calculates `run_at` = `slot_datetime_end` (or fallback to `slot_datetime + 1 hour`)
  - For `status = 'active'`: Inserts/updates pending job in `booking_jobs`
  - For non-active bookings: Removes pending job
- **Coverage**: ✅ ALL NEW BOOKINGS (going forward)
- **Limitation**: ❌ Existing bookings (created before trigger deployed)

```sql
-- Example: Booking created with slot_datetime_end
INSERT INTO bookings (user_id, pitch_id, slot_datetime, slot_datetime_end, status)
  VALUES (...);
  
-- Trigger AUTOMATICALLY runs:
-- Inserts: booking_jobs(booking_id, run_at='2025-12-21T10:00:00Z', status='pending')
```

### Layer 2: Scheduled Job Processor (RUNS JOBS)
**File**: `supabase/functions/process-booking-jobs/index.ts`

**How it works:**
```
1. Queries: booking_jobs WHERE status='pending' AND run_at <= NOW() (limit 100)
2. For each due job:
   - Fetch corresponding booking
   - If booking.status = 'active': UPDATE to 'completed'
   - Mark job as 'processed' with timestamp
3. Return count of processed jobs
```

**Status**: ✅ DEPLOYED but ❌ NEVER SCHEDULED
- **Current deployment URL**: `https://mismymbsavogkuovfyvj.supabase.co/functions/v1/process-booking-jobs`
- **Issue**: No cron schedule = function never auto-runs

**Critical fix needed**: Schedule in Supabase Dashboard
```
Go to: Functions → process-booking-jobs → Schedule
Cron: */5 * * * *  (every 5 minutes)
```

### Layer 3: Fallback Cleanup in available-slots (CATCHES STRAGGLERS)
**File**: `supabase/functions/available-slots/index.ts` 

**New cleanup function** that runs EVERY TIME someone fetches available slots:
```typescript
cleanupPastBookings()
  - Finds: status='active' AND slot_datetime_end < NOW()
  - Updates: status='completed'
  - Runs in background (non-blocking, doesn't affect response time)
```

**Coverage**: ✅ Catches any bookings missed by job scheduler
**Frequency**: Every time slots are fetched (often enough for user experience)
**Limitation**: Won't catch bookings if no one fetches slots

## Execution Flow for a Booking

### Timeline: Booking at 09:00-10:00 on Dec 21

```
2025-12-21 08:00 → User books 09:00 slot
  ↓
  Trigger fires (upsert_booking_job)
  ↓
  INSERT booking_jobs(booking_id, run_at='2025-12-21T10:00:00Z', status='pending')
  
2025-12-21 10:05 → process-booking-jobs runs (scheduled)
  ↓
  Query: SELECT * FROM booking_jobs WHERE status='pending' AND run_at <= NOW()
  ↓
  Finds: booking_jobs row with run_at='2025-12-21T10:00:00Z'
  ↓
  UPDATE bookings SET status='completed' WHERE id=booking_id
  ↓
  UPDATE booking_jobs SET status='processed', processed_at=NOW()

2025-12-21 10:10 → User fetches available slots (fallback layer)
  ↓
  cleanupPastBookings() runs in background
  ↓
  Catches any remaining status='active' with slot_datetime_end < NOW()
  ↓
  Marks them 'completed'
```

## Database Schema

### booking_jobs Table
```sql
CREATE TABLE booking_jobs (
  id UUID PRIMARY KEY,
  booking_id UUID REFERENCES bookings(id),
  run_at TIMESTAMP,           -- When to process this job
  status TEXT,                -- 'pending', 'processed', or 'cancelled'
  created_at TIMESTAMP,
  processed_at TIMESTAMP
);

CREATE INDEX idx_booking_jobs_run_at_status ON booking_jobs(run_at, status);
```

### Query Pattern in process-booking-jobs
```sql
-- Find due jobs
SELECT id, booking_id FROM booking_jobs
WHERE status = 'pending' AND run_at <= NOW()
LIMIT 100;

-- Mark completed
UPDATE bookings SET status = 'completed' WHERE id = ? AND status = 'active';
UPDATE booking_jobs SET status = 'processed', processed_at = NOW() WHERE id = ?;
```

## Fixes Needed RIGHT NOW

### 1. Backfill Existing Bookings ✅ (Migration Created)
**File**: `supabase/migrations/20251221003000_backfill_booking_jobs.sql`

This INSERT creates jobs for all existing active bookings:
```sql
INSERT INTO booking_jobs (booking_id, run_at, status)
SELECT b.id,
       COALESCE(b.slot_datetime_end, b.slot_datetime + INTERVAL '1 hour', s.datetime_end),
       'pending'
FROM bookings b
LEFT JOIN slots s ON b.slot_id = s.id
WHERE b.status = 'active'
  AND NOT EXISTS (SELECT 1 FROM booking_jobs WHERE booking_id = b.id);
```

**Action**: Deploy this migration to Supabase

### 2. Schedule process-booking-jobs ❌ (CRITICAL)
**Manual Step in Supabase Dashboard**:
1. Open: https://app.supabase.com → Your Project → Edge Functions
2. Find: `process-booking-jobs`
3. Click "Schedule"
4. Set cron: `*/5 * * * *` (every 5 minutes)
5. Save

### 3. Deploy Updated available-slots ✅ (Already updated)
- Now includes fallback cleanup
- Redeploy function to activate

## Code Quality Comparison

### process-booking-jobs ✅ CORRECT
Matches pattern from other functions:
- ✅ `@ts-ignore` for Deno globals
- ✅ Proper error handling with try/catch
- ✅ Logs with prefixes `[process-booking-jobs]`
- ✅ Uses service role key
- ✅ Returns JSON responses
- ✅ No RLS bypass issues (service role has full access)

### available-slots ✅ CORRECT  
- ✅ Query filtering with `.eq()`, `.lt()` properly chained
- ✅ Background cleanup doesn't block slot generation
- ✅ Graceful error handling (logs warning, doesn't crash)

### Trigger ✅ CORRECT
- ✅ Uses `COALESCE` for fallback chain: `slot_datetime_end` → `slot_datetime + 1h` → real slot end
- ✅ Respects status transitions (only keeps job for active bookings)
- ✅ Uses `ON CONFLICT` with proper upsert logic
- ✅ Deletes jobs when booking deleted

## Testing Verification

### How to verify your system works:

1. **Create new booking**:
   ```
   POST /bookings
   {user_id, pitch_id, slot_datetime, slot_datetime_end, status: 'active'}
   ```
   
2. **Check job created** (within 100ms):
   ```
   SELECT * FROM booking_jobs 
   WHERE booking_id = ? AND status = 'pending'
   ```
   Should see: `run_at = slot_datetime_end`

3. **Wait past slot end time**, then:
   ```
   GET /available-slots  (triggers cleanup)
   ```
   Or wait for process-booking-jobs to run
   
4. **Verify booking marked complete**:
   ```
   SELECT status FROM bookings WHERE id = ?
   ```
   Should see: `status = 'completed'`

## Deployment Checklist

- [ ] Deploy migration: `20251221003000_backfill_booking_jobs.sql` (backfill existing)
- [ ] Schedule `process-booking-jobs` function in Supabase Dashboard (cron: `*/5 * * * *`)
- [ ] Redeploy `available-slots` edge function (now has cleanup)
- [ ] Verify first booking completes automatically

## Summary

Your system now has:
1. **Automatic job insertion** (trigger) - catches new bookings ✅
2. **Automated job processing** (scheduled function) - needs scheduling ❌
3. **Fallback cleanup** (available-slots) - safety net ✅
4. **Backfill for existing** (migration) - ready to deploy ✅

The system is **architecturally sound** but needs the one manual step: **schedule the function in Supabase**.
