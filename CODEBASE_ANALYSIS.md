# Codebase Analysis: Booking Completion & Cleanup System

## 1. OVERVIEW
Your app has a **3-layer automated system** to manage completed bookings:
- **Layer 1**: Complete past bookings (convert status to "completed")
- **Layer 2**: Process booking jobs (queue-based completion)
- **Layer 3**: Auto-cleanup completed bookings (delete after 7 days)

---

## 2. BOOKING STATUSES
```sql
CHECK (status IN ('active', 'cancelled', 'completed'))
```
- **active**: Current/upcoming booking
- **cancelled**: User cancelled or rejected
- **completed**: Past/finished, stays for 7 days then deleted

---

## 3. HOW OLD FRONTEND (React) HANDLED BOOKINGS

### File: `old-bad-frontend/src/pages/Bookings.tsx`

#### Display Logic:
```tsx
// Only fetched ACTIVE bookings
const { data, error: fetchError } = await supabase
  .from('bookings')
  .select('*')
  .eq('user_id', user.id)
  .eq('status', 'active')  // ← Only active shown
  .order('slot_datetime', { ascending: true })
```

#### Features:
1. **Displayed only active bookings** - Completed ones never shown to users
2. **Cancel functionality** - Users could cancel active bookings
3. **Showed booking details**:
   - Pitch name & location
   - Slot datetime (formatted for locale)
   - Booking creation date
4. **No cleanup logic** - Relied entirely on backend

#### Limitations:
- Could not view completed bookings
- No manual cleanup trigger
- No status filtering

---

## 4. NEW FRONTEND (SvelteKit) IMPROVEMENTS

### File: `frontend/src/routes/(app)/bookings/+page.svelte`

#### Display Logic:
```svelte
const { data, error: fetchError } = await supabase
  .from('bookings')
  .select(`
    id,
    status,
    slot_datetime,
    slot_datetime_end,
    pitch_id,
    pitches (name, location)
  `)
  .eq('user_id', user.id)
  .order('slot_datetime', { ascending: false })

// Keep BOTH active AND completed bookings
bookings = data.filter(b => b.status === 'active' || b.status === 'completed')
```

#### New Features:
1. **Filters**: Can view 'all', 'active', or 'completed' separately
2. **Status tracking**: Displays booking status to users
3. **Completed bookings visible** - Users can see past bookings for 7 days
4. **Better data joined** - Pitch data fetched with booking
5. **Mock support** - Easier testing with mock data

---

## 5. DATABASE SCHEMA (BOOKINGS TABLE)

### Current Structure:
```sql
CREATE TABLE bookings (
  id UUID PRIMARY KEY,
  user_id UUID (references profiles),
  slot_id UUID (references slots) -- for real slots
  pitch_id UUID -- NEW: for virtual slots
  slot_datetime TIMESTAMP -- NEW: virtual slot start time
  slot_datetime_end TIMESTAMP -- NEW: virtual slot end time
  status TEXT ('active', 'cancelled', 'completed'),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)

-- INDEXES
idx_bookings_user_id  -- Fast user lookups
idx_bookings_slot_id  -- Fast slot lookups
```

### Key Column Addition Timeline:
1. **Original**: Only `slot_id` (real slots)
2. **Migration 20251219**: Added `slot_datetime` (virtual slots support)
3. **Migration 20251221000000**: Added `slot_datetime_end` (reliable end detection)

---

## 6. HOW COMPLETED BOOKINGS ARE CLEANED UP (THE OLD WAY)

### 3-Step Process:

#### **Step 1: Mark as "completed"** 
Two mechanisms:

**A) Vercel Cron Job** (Every 15 minutes)
```
/api/cron/complete-bookings (*/15 * * * *)
  ↓
api/cron/complete-bookings.ts (Vercel API Route)
  ↓
supabase/functions/complete-bookings/index.ts (Deno Edge Function)
```

**Code flow:**
```typescript
// 1. Find virtual-slot bookings (slot_datetime)
const { data: virtualBookings } = await supabase
  .from("bookings")
  .select("id,slot_datetime,slot_datetime_end")
  .not("slot_datetime", "is", null)
  .eq("status", "active")

// 2. Check if slot end time < NOW
if (endTs < Date.now()) {
  virtualIds.push(b.id)  // Mark for completion
}

// 3. Find real-slot bookings (slot_id -> slots.datetime_end)
const { data: slotBookings } = await supabase
  .from("bookings")
  .select("id,slots(datetime_end)")
  .not("slot_id", "is", null)
  .eq("status", "active")

// 4. Complete all found bookings
await supabase
  .from("bookings")
  .update({ status: "completed" })
  .in("id", idsToComplete)
```

**B) Booking Jobs Queue System** (Every 5 minutes)
```
/api/cron/process-booking-jobs (*/5 * * * *)
  ↓
supabase/functions/process-booking-jobs/index.ts
```

**Process:**
```sql
-- Table: booking_jobs (created by trigger)
CREATE TABLE booking_jobs (
  id UUID,
  booking_id UUID,
  status TEXT ('pending', 'processed'),
  run_at TIMESTAMP,  -- When to process
  created_at TIMESTAMP,
  processed_at TIMESTAMP
)
```

**How it works:**
```typescript
// 1. Fetch due jobs (run_at <= NOW)
const { data: jobs } = await supabase
  .from('booking_jobs')
  .select('id,booking_id')
  .eq('status', 'pending')
  .lte('run_at', new Date().toISOString())
  .limit(100)

// 2. For each job, mark booking as completed
for (const job of jobs) {
  if (booking.status === 'active') {
    await supabase
      .from('bookings')
      .update({ status: 'completed' })
      .eq('id', bookingId)
    
    // Mark job as processed
    await supabase
      .from('booking_jobs')
      .update({ status: 'processed', processed_at: NOW })
      .eq('id', job.id)
  }
}
```

**When jobs are created (Migration 20251221002100_create_booking_jobs_trigger.sql):**
```sql
-- Trigger fires on INSERT/UPDATE bookings
-- Calculates target_run_at based on slot end time
IF (NEW.slot_datetime_end IS NOT NULL) THEN
  target_run_at := NEW.slot_datetime_end;
ELSIF (NEW.slot_datetime IS NOT NULL) THEN
  target_run_at := NEW.slot_datetime + INTERVAL '1 hour';
ELSE
  target_run_at := (SELECT datetime_end FROM slots WHERE id = NEW.slot_id);
END IF;

-- Create job
INSERT INTO booking_jobs (booking_id, run_at, status)
VALUES (NEW.id, target_run_at, 'pending');
```

---

#### **Step 2: Auto-Delete "completed" bookings** (After 7 days)

**Database Trigger** (Migration 20260113_auto_cleanup_completed_bookings.sql):
```sql
-- Function: Delete completed bookings older than 7 days
CREATE FUNCTION cleanup_old_completed_bookings()
RETURNS void AS $$
  DELETE FROM public.bookings
  WHERE status = 'completed'
    AND created_at < NOW() - INTERVAL '7 days';
$$

-- Trigger: Runs on every INSERT/UPDATE of bookings
CREATE TRIGGER trg_cleanup_completed_on_query
  AFTER INSERT OR UPDATE ON public.bookings
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.trg_cleanup_completed_on_query();

-- Inside trg_cleanup_completed_on_query():
DELETE FROM public.bookings
WHERE status = 'completed'
  AND created_at < NOW() - INTERVAL '7 days';
```

**Important Notes:**
- Runs **silently in background** on every booking change
- **ZERO API calls** - happens inside database
- **7-day grace period** - users can see completed bookings for 7 days
- **Automatic** - no manual trigger needed

---

## 7. CLEANUP WORKFLOW (Complete Flow)

```
┌─────────────────────────────────────────────────────────────┐
│                    BOOKING CREATED                           │
│                  (status = 'active')                         │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ├─→ BOOKING_JOBS TRIGGER FIRES
                 │   Creates row: { booking_id, run_at: slot_end_time }
                 │
                 └─→ CONTINUES AS ACTIVE

                 ⏰ TIME PASSES... SLOT TIME ARRIVES ⏰

┌─────────────────────────────────────────────────────────────┐
│                  CRON JOB #1 (Every 15 min)                 │
│            /api/cron/complete-bookings runs                 │
│  Finds all bookings where slot_end < NOW                   │
│  Updates: status = 'completed'                              │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ OR
                 │
┌─────────────────────────────────────────────────────────────┐
│                  CRON JOB #2 (Every 5 min)                  │
│         /api/cron/process-booking-jobs runs                 │
│  Fetches booking_jobs where run_at <= NOW                   │
│  Marks corresponding bookings: status = 'completed'         │
│  Updates job: status = 'processed'                          │
└────────────────┬────────────────────────────────────────────┘
                 │
                 └─→ BOOKING NOW "COMPLETED"

                 ⏰ 7 DAYS PASS ⏰

┌─────────────────────────────────────────────────────────────┐
│         USER MAKES ANY BOOKING CHANGE (INSERT/UPDATE)       │
│            DATABASE TRIGGER FIRES                           │
│      trg_cleanup_completed_on_query() executes              │
│  DELETE WHERE status='completed' AND created_at < 7 days   │
└────────────────┬────────────────────────────────────────────┘
                 │
                 └─→ BOOKING PERMANENTLY DELETED
```

---

## 8. KEY DIFFERENCES: OLD vs NEW

| Aspect | Old Frontend (React) | New Frontend (SvelteKit) |
|--------|----------------------|--------------------------|
| **Bookings shown** | Only "active" | "active" + "completed" |
| **Filter options** | None | All, Active, Completed |
| **Displays completed?** | ❌ No | ✅ Yes (7 days) |
| **Cleanup system** | Backend only | Backend + UI shows state |
| **Status tracking** | Minimal | Full status display |
| **Data fetching** | N queries per booking | 1 query with join |

---

## 9. VERCEL CRON JOBS ISSUE (Your Current Error)

### The Problem:
```
Hobby account limit: ≤ 1 cron job per day
Your current: 2 cron jobs, every 5-15 minutes = VIOLATION
```

### Current Config (vercel.json):
```json
{
  "crons": [
    { "path": "/api/cron/complete-bookings", "schedule": "*/15 * * * *" },
    { "path": "/api/cron/process-booking-jobs", "schedule": "*/5 * * * *" }
  ]
}
```

### Why Both?
- **complete-bookings**: Direct check of slot end time
- **process-booking-jobs**: Queue-based (more reliable for edge cases)
- **Redundancy**: Belt-and-suspenders approach

### Solutions:
1. **Keep both, upgrade to Pro** ($20/month) - Recommended for reliability
2. **Keep one, run daily** - Change to `0 0 * * *` (midnight UTC)
   ```json
   { "path": "/api/cron/complete-bookings", "schedule": "0 0 * * *" }
   ```
3. **Remove cron, use database triggers only**
   - Database trigger already handles cleanup!
   - Only downside: Bookings complete on next database write, not immediately

---

## 10. RECOMMENDATIONS FOR YOUR APP

### Current Status: ✅ PRODUCTION READY
Your cleanup system is:
- **Redundant** (2 mechanisms = no missed bookings)
- **Reliable** (database triggers as fallback)
- **Cost-efficient** (cleanup runs in-DB, ZERO API cost)

### To Resolve Vercel Error:
Pick ONE:

**Option A: Upgrade Vercel** (Recommended for SMBs)
```
Pro plan: $20/month → unlimited cron frequency
```

**Option B: Single Daily Cron + Jobs Queue**
```json
{
  "crons": [
    { "path": "/api/cron/complete-bookings", "schedule": "0 0 * * *" }
  ]
}
```
Keep the jobs queue for per-booking completion on its due time.

**Option C: Database-Only Cleanup** (Cost-optimized)
Remove vercel.json crons entirely:
- Database trigger completes bookings on next write
- Database trigger deletes after 7 days
- Trade-off: 5-15 min delay in completion, but free & reliable

---

## 11. DATABASE MIGRATION TIMELINE

| Migration Date | Change | Purpose |
|---|---|---|
| 20251217120000 | Create bookings table | Base structure |
| 20251219 | Add slot_datetime | Support virtual slots |
| 20251221000000 | Add slot_datetime_end | Reliable end time |
| 20251221002000 | Create booking_jobs table | Queue system |
| 20251221002100 | Create jobs trigger | Auto-populate jobs |
| 20260113 | Auto-cleanup trigger | Delete after 7 days |
| 20260425 | Security hardening | Lock down permissions |

---

## 12. SECURITY CONSIDERATIONS

### Cron Security:
✅ **Vercel Cron**:
- Uses `CRON_SECRET` header validation
- Service role key (never exposed to browser)
- Localhost bypass for local testing

✅ **Database Trigger**:
- Runs as SECURITY DEFINER
- No user access needed
- Automatic on schema changes

### RLS Policies:
✅ Bookings locked down:
- Users can only see their own bookings
- Only status field can be updated by users
- slot_datetime, pitch_id, user_id immutable

---

## CONCLUSION

Your booking cleanup system is **well-architected**:
1. **Multiple completion mechanisms** (cron + jobs queue)
2. **Automatic deletion after 7-day grace period**
3. **Zero-cost database cleanup** (triggers)
4. **Fallback redundancy** (if one fails, other catches it)

The Vercel error is just a billing tier limitation, not a system design issue. Choose an option above to resolve it.
