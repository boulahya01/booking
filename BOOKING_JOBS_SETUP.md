# Booking Jobs System - Setup Guide

## Current Status - SIMPLIFIED (No External Scheduler Needed!)

✅ **Deployed:**
- `booking_jobs` table with automatic trigger
- `process-booking-jobs` edge function (ready anytime)
- PostgreSQL auto-completion functions
- Automatic cleanup on every slot request

❌ **Removed:**
- Vercel cron (Hobby plan limitation)
- External scheduler requirement

## How It Works Now

**Three-layer safety net for auto-completing bookings:**

### Layer 1: PostgreSQL Trigger (Immediate)
- When booking is inserted: trigger fires
- If slot has already ended: marks as 'completed' immediately
- No external call needed

### Layer 2: Available-Slots Function (On Every Request)
- Every time user loads booking page: auto-complete runs
- Marks ALL past active bookings as completed
- Happens within the normal app flow

### Layer 3: Edge Function (Manual or On-Demand)
- Can be called manually if needed
- Processes pending jobs from `booking_jobs` table
- Marks corresponding bookings as completed

## Step-by-Step Setup

### Step 1: Deploy Migrations

Run these SQL queries in Supabase SQL Editor:

**First migration: Emergency fix for existing overdue bookings**
```sql
-- File: supabase/migrations/20251221003000_emergency_process_overdue_jobs.sql
SELECT public.process_booking_completion_jobs();
```

**Second migration: Auto-completion functions**
```sql
-- File: supabase/migrations/20251221003100_auto_complete_bookings.sql
-- (This is deployed automatically when you push)
```

### Step 2: Test Immediately

Go to Supabase SQL Editor and run:

```sql
-- Check if old bookings are now completed
SELECT 
  id,
  status,
  slot_datetime_end,
  (NOW() > slot_datetime_end) as "is_past"
FROM public.bookings
WHERE slot_datetime_end < NOW()
ORDER BY slot_datetime_end DESC
LIMIT 5;
```

Should show: `status = 'completed'` for all past slots

### Step 3: Verify in App

1. Log into your booking app
2. Go to bookings page
3. Old bookings from yesterday should NOT appear (they're now completed)
4. You should be able to rebook the same slot

### Step 4: Deploy to Vercel

```bash
cd /home/shobee/Desktop/database/booking
git add .
git commit -m "Remove Vercel cron, use PostgreSQL auto-completion"
git push origin main
```

---

## Architecture

```
┌─────────────────────────────────────────┐
│     User Creates Booking                │
└────────────────┬────────────────────────┘
                 ↓
┌─────────────────────────────────────────┐
│  PostgreSQL Trigger fires               │
│  (upsert_booking_job)                   │
└────────────────┬────────────────────────┘
                 ↓
        ┌────────┴─────────┐
        ↓                  ↓
    ┌─────────┐      ┌──────────────┐
    │ Job     │      │ Booking is   │
    │ created │      │ in future?   │
    │ in jobs │      └──────┬───────┘
    │ table   │             │
    └─────────┘        ┌────┴────┐
                       │ YES: OK  │
                       │ NO: mark │
                       │ complete │
                       └──────────┘

[Later - User loads app]
       ↓
┌─────────────────────────────────────┐
│  available-slots function called    │
└────────────────┬────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│  auto_complete_past_bookings()      │
│  (PostgreSQL function)              │
└────────────────┬────────────────────┘
                 ↓
    ┌────────────┴────────────┐
    ↓                         ↓
UPDATE bookings          UPDATE booking_jobs
WHERE slot_end < NOW()   WHERE run_at < NOW()
SET status='completed'   SET status='processed'
```

---

## Advantages of This Approach

✅ **No external dependencies** - Everything in PostgreSQL
✅ **Works on Hobby plan** - No scheduler restrictions
✅ **Automatic** - Runs every time user interacts with slots
✅ **Reliable** - Database triggers are atomic
✅ **Fallback safety** - Multiple layers ensure accuracy
✅ **Zero latency** - No API calls to external services

---

## Testing

### Test 1: Create and Auto-Complete a Booking

```sql
-- In Supabase SQL Editor
SELECT public.auto_complete_past_bookings();

-- Then check
SELECT COUNT(*) as now_completed 
FROM public.bookings 
WHERE status = 'completed' AND slot_datetime_end < NOW();
```

### Test 2: Verify User Experience

1. Open your app
2. Create a test booking for 10 minutes in the future
3. Wait 12 minutes
4. Refresh the page
5. Old booking should disappear from "My Bookings" (marked completed)
6. Slot should be available to rebook

### Test 3: Check Database State

```sql
-- All bookings
SELECT id, status, slot_datetime_end, 
       (NOW() > slot_datetime_end) as is_past
FROM public.bookings
ORDER BY slot_datetime_end DESC;

-- All jobs
SELECT booking_id, status, run_at, 
       (NOW() > run_at) as is_overdue
FROM public.booking_jobs
ORDER BY run_at DESC;
```

---

## Files Changed

- ✅ `vercel.json` - Removed cron config
- ✅ `supabase/migrations/20251221003000_emergency_process_overdue_jobs.sql` - Emergency fix
- ✅ `supabase/migrations/20251221003100_auto_complete_bookings.sql` - NEW: Auto-completion functions
- ✅ `supabase/functions/available-slots/index.ts` - Uses new RPC function
- ✅ Removed `api/cron/process-booking-jobs.ts` - No longer needed

---

## Database Functions Created

### `auto_complete_past_bookings()`
Marks all past active bookings as completed. Called automatically by:
- `available-slots` function on every slot fetch
- User can call manually anytime

### `process_booking_completion_jobs()`
Processes pending jobs from `booking_jobs` table. Used by:
- `process-booking-jobs` edge function (if called manually)
- Emergency SQL script

### `trg_check_booking_completion()`
Trigger function that runs BEFORE INSERT/UPDATE on bookings:
- If booking slot has already ended: marks as 'completed' immediately
- No separate query needed

---

## Troubleshooting

### Bookings still active after slot ends?

Run this in SQL Editor:
```sql
SELECT public.auto_complete_past_bookings();

-- Verify
SELECT COUNT(*) FROM public.bookings 
WHERE status = 'active' AND slot_datetime_end < NOW();
-- Should return: 0
```

### Jobs table not getting updated?

Check that `20251221003100_auto_complete_bookings.sql` migration ran:
```sql
SELECT routine_name FROM information_schema.routines 
WHERE routine_name LIKE 'auto_complete%';
-- Should show 3 functions
```

### User can't rebook after slot ends?

1. Load a slot page (this triggers auto-complete)
2. Check bookings table
3. Old booking should now be completed
4. Slot should be available again

---

## Summary

**Before:** Had jobs but no scheduler → bookings stuck as active
**Now:** Automatic PostgreSQL functions → bookings auto-complete
**Result:** Works on free Hobby plan, no external dependencies needed!
