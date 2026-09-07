# AI Agent Guidelines for Booking System

This document provides essential information for AI coding agents to effectively work with the Booking System codebase.

## 1. Project Overview
The Booking System is a full-stack application for managing sports facility reservations. It utilizes SvelteKit for the frontend and Supabase for the backend, including PostgreSQL, Auth, and Edge Functions.

### Key Features:
-   **Student-facing**: Pitch browsing, real-time slot availability, booking management, automated notifications.
-   **Admin-facing**: User registration approval/rejection, pitch management, booking oversight.
-   **Core Workflow**: Dynamic slot generation, secure authentication, automated booking lifecycle management.

## 2. Key Areas of Focus

### 2.1. Available Slots Generation (Critical Feature)

**Purpose**: Dynamically generates available time slots for pitches based on their opening hours and active bookings. This avoids storing all possible slots in the database, saving storage and ensuring real-time availability.

**Architecture**: Virtual slots are computed on-demand rather than pre-created, ensuring real-time accuracy and reducing database size.

#### Backend: Edge Function

**Location**: [supabase/functions/available-slots/index.ts](supabase/functions/available-slots/index.ts)

**Request/Response**:
- **Endpoint**: `POST /functions/v1/available-slots` or `GET /functions/v1/available-slots?pitch_id={id}`
- **Auth**: Requires valid JWT in `Authorization: Bearer {token}` header
- **Input**: Optional `pitch_id` (UUID). Omit to get slots for all pitches
- **Rate Limit**: 60 requests per IP per 60 seconds (in-memory, resets on redeploy)

**Algorithm**:
1. Validate JWT and check rate limit (return 401/429 if failed)
2. Query pitches table for `id, name, open_time, close_time`
3. For each pitch, query active bookings: `SELECT id, pitch_id, slot_datetime FROM bookings WHERE pitch_id = ? AND status = 'active'`
4. Generate virtual slots for next 24 hours from current UTC time:
   - Skip current partial hour (e.g., if 10:15 UTC, skip 10:00-11:00 slot)
   - Respect pitch `open_time` to `close_time` (24:00 = end of day)
   - Loop through 2 calendar days to ensure 24-hour coverage across midnight
5. For each slot, check if any booking matches by UTC year/month/date/hour
6. Mark slot `is_available: false` if match found
7. Sort all slots by `datetime_start` and return JSON array

**VirtualSlot Response Format**:
```typescript
interface VirtualSlot {
    id: string;                 // "pitch_id-ISO_datetime_start"
    pitch_id: string;
    pitch_name: string;
    datetime_start: string;     // ISO 8601 UTC (e.g., "2024-01-15T10:00:00Z")
    datetime_end: string;       // ISO 8601 UTC
    is_available: boolean;
}
```

**Important Notes**:
- ⚠️ **No booker information returned** (Privacy: no PII in API response)
- ⚠️ **All times are UTC** - times must be converted to user's local timezone on frontend
- ⚠️ **If booking query fails**, function still returns 200 with slots marked available (graceful degradation)

#### Frontend: Slot Display & Booking

**Primary Location**: [frontend/src/routes/(app)/pitch/[id]/+page.svelte](frontend/src/routes/(app)/pitch/[id]/+page.svelte)

**Slot Fetching** (Dual Strategy):
```typescript
// Strategy 1: Use Supabase JS SDK
const res = await supabase.functions.invoke('available-slots', { 
  body: JSON.stringify({ pitch_id: pitchId }) 
})

// Strategy 2 (Fallback): Direct HTTP POST with JWT
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const token = sessionData?.session?.access_token
const resp = await fetch(`${supabaseUrl}/functions/v1/available-slots`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ pitch_id: pitchId }),
})
```

**State Management**:
- `slots`: Array of VirtualSlot objects
- `selectedDate`: Grouped by **local date** (⚠️ potential timezone mismatch)
- `loadingSlots`: Loading state during fetch
- `refreshInterval`: Auto-refresh every 2 minutes + visibility change

**Data Display**:
```typescript
// Group slots by LOCAL date
$: grouped = slots.reduce((acc, s) => {
  const d = new Date(s.datetime_start).toLocaleDateString()  // ⚠️ LOCAL DATE
  ;(acc[d] ??= []).push(s)
  return acc
}, {})
```

**Booking Flow**:
1. User selects a slot
2. Verify user is email-verified (`status !== 'pending'`)
3. Check for existing active bookings (only 1 active booking per user at a time)
4. Call RPC function: `create_booking_with_approval({ pitch_id, slot_datetime, slot_datetime_end })`
5. Close modal and refresh slots list

**Related Components**:
- [frontend/src/lib/components/SlotCard.svelte](frontend/src/lib/components/SlotCard.svelte): Displays individual slot
- [frontend/src/lib/components/BookingModal.svelte](frontend/src/lib/components/BookingModal.svelte): Booking confirmation UI

## 3. Known Issues & Critical Bugs in Available Slots

⚠️ **These issues affect production behavior. Prioritize fixes in this order:**

### 3.1 🔴 Critical Issues (Production Impact)

#### Issue #1: Timezone Grouping Mismatch
**Problem**: Backend generates slots in UTC, but frontend groups by **local date**. This causes slots to appear on wrong calendar date for users outside UTC timezone.

**Example**:
- UTC: `2024-01-15 23:00:00Z` - `2024-01-16 00:00:00Z` (midnight slot)
- User in UTC-5 (EST): shows as `2024-01-15 18:00:00 EST`
- Frontend groups by LOCAL date (`2024-01-15`), but backend generated for UTC date (`2024-01-16`)
- **Result**: Slots appear on `2024-01-15` in frontend, but backend thought they were `2024-01-16`

**Root Cause**: [frontend/src/routes/(app)/pitch/[id]/+page.svelte](frontend/src/routes/(app)/pitch/[id]/+page.svelte#L180-L186)
```typescript
$: grouped = slots.reduce((acc, s) => {
  const d = new Date(s.datetime_start).toLocaleDateString()  // ⚠️ WRONG: uses local date
  ;(acc[d] ??= []).push(s)
  return acc
}, {})
```

**Fix**: Group by UTC date instead:
```typescript
$: grouped = slots.reduce((acc, s) => {
  const date = new Date(s.datetime_start)
  const utcDate = date.toISOString().split('T')[0]  // YYYY-MM-DD in UTC
  ;(acc[utcDate] ??= []).push(s)
  return acc
}, {})
```

---

#### Issue #2: Concurrent Booking Race Condition
**Problem**: Two users can book the same slot simultaneously. No transaction/lock prevents duplicate bookings.

**Scenario**:
1. User A fetches slots, sees slot `2024-01-15 10:00 UTC` as available
2. User B fetches slots, sees same slot as available
3. User A clicks "Book" → booking created successfully
4. User B clicks "Book" → booking created successfully (race condition!)
5. Both users now have bookings for the same pitch/time

**Root Cause**: No database constraint or transaction in booking creation. The Edge Function fetches bookings once, but doesn't hold a lock.

**Fix**: Use database-level constraint (PostgreSQL unique partial index):
```sql
CREATE UNIQUE INDEX idx_bookings_unique_active_slot 
ON bookings(pitch_id, slot_datetime) 
WHERE status = 'active' AND slot_datetime IS NOT NULL;
```

Or use advisory locks in RPC function that creates bookings:
```sql
SELECT pg_advisory_xact_lock(hashtext(pitch_id::text || slot_datetime::text));
-- Then verify slot still available before inserting
```

---

#### Issue #3: Booking Query Failure → Treat as Available
**Problem**: If the bookings database query fails (network error, etc.), function still returns 200 with slots marked `is_available: true`. This hides the error and shows incorrect availability.

**Root Cause**: [supabase/functions/available-slots/index.ts](supabase/functions/available-slots/index.ts#L160-L170)
```typescript
const { data: bookings, error } = await supabase
  .from("bookings")
  .select("id,pitch_id,slot_datetime,status")
  .eq("pitch_id", pitch.id)
  .eq("status", "active")

if (error) {
  // ⚠️ Bug: silently continues with empty bookings array
  // This marks all slots as available when DB query fails
  console.error("Booking query failed:", error)
  // bookings remains [] → all slots appear available ❌
}
```

**Impact**: Users see available slots that are actually booked. They attempt to book and get "slot already taken" error during booking confirmation.

**Fix**: Either:
1. Return 500 error if booking query fails (fail-safe: block booking attempts)
2. Or fallback to conservative logic: mark slots uncertain/loading state

---

#### Issue #4: Frontend References Non-Existent `booker_id`
**Problem**: [frontend/src/lib/components/SlotCard.svelte](frontend/src/lib/components/SlotCard.svelte#L35-L40) tries to display `slot.booker_id` and `slot.booker_name`, but Edge Function **never returns** these fields (intentional privacy design).

```typescript
$: bookedByMe = !slot.is_available && slot.booker_id === $authState.user?.id
// ⚠️ slot.booker_id is always undefined
```

**Impact**: UI can't detect if current user booked the slot, so can't show "Cancel" button vs "Book" button.

**Fix**: Either:
1. Query bookings table separately to check if current user has a booking for this slot
2. Include booker_id in Edge Function (security review needed - currently avoided for privacy)

---

### 3.2 🟠 High-Priority Performance Issues

#### Issue #5: Missing Database Index
**Problem**: Every slot generation queries `bookings` with `WHERE pitch_id = ? AND status = 'active'`. Without composite index, full table scan happens.

```sql
-- Current: no index exists
SELECT * FROM bookings WHERE pitch_id = ? AND status = 'active'

-- Should have:
CREATE INDEX idx_bookings_pitch_id_status 
ON bookings(pitch_id, status) INCLUDE (slot_datetime);
```

**Impact**: Slow queries as booking table grows. Noticeable with >1000 bookings.

**Fix**: Apply migration:
```sql
CREATE INDEX IF NOT EXISTS idx_bookings_pitch_status 
ON bookings(pitch_id, status) INCLUDE (slot_datetime);
```

---

#### Issue #6: O(n) Linear Search for Booking Matching
**Problem**: For each generated slot, code does `.find()` through entire bookings array:

```typescript
const booking = bookingsList.find((booking) => {
  const bookingTime = new Date(booking.slot_datetime)
  return (
    bookingTime.getUTCFullYear() === slotStart.getUTCFullYear() &&
    bookingTime.getUTCMonth() === slotStart.getUTCMonth() &&
    bookingTime.getUTCDate() === slotStart.getUTCDate() &&
    bookingTime.getUTCHours() === slotStart.getUTCHours()
  )
})
```

With 40 slots × 100 bookings = 4000 comparisons per request.

**Fix**: Build a Map for O(1) lookup:
```typescript
const bookingMap = new Map<string, boolean>()
bookingsList.forEach(b => {
  const key = `${b.pitch_id}-${b.slot_datetime.split('T')[0]}-${new Date(b.slot_datetime).getUTCHours()}`
  bookingMap.set(key, true)
})

const isBooked = bookingMap.has(`${pitch.id}-${dateStr}-${hour}`)
```

---

#### Issue #7: N+1 Database Queries for Multiple Pitches
**Problem**: When fetching slots for all pitches, code loops through pitches and queries bookings separately for each:

```typescript
for (const pitch of pitches) {
  // ❌ Creates new database query per pitch
  const { data: bookings } = await supabase
    .from("bookings")
    .select("id,pitch_id,slot_datetime,status")
    .eq("pitch_id", pitch.id)
    .eq("status", "active")
}
```

With 10 pitches = 10 separate queries to database.

**Fix**: Batch into single query with `in()`:
```typescript
const pitchIds = pitches.map(p => p.id)
const { data: allBookings } = await supabase
  .from("bookings")
  .select("id,pitch_id,slot_datetime,status")
  .in("pitch_id", pitchIds)
  .eq("status", "active")

// Then group by pitch_id in memory
const bookingsByPitch = new Map<string, typeof allBookings>()
allBookings.forEach(b => {
  if (!bookingsByPitch.has(b.pitch_id)) {
    bookingsByPitch.set(b.pitch_id, [])
  }
  bookingsByPitch.get(b.pitch_id)!.push(b)
})
```

---

### 3.3 🟡 Medium-Priority Edge Cases & Issues

#### Issue #8: Midnight (24:00) Handling
**Problem**: Pitches can have `close_time = '24:00'` to stay open until midnight. Code converts to `closeHour = 24`, but JavaScript Date hours are 0-23, causing edge case bugs.

```typescript
if (pitch.close_time === '24:00') {
  closeHour = 24  // ⚠️ No hour 24 in JavaScript
}

for (let hour = openHour; hour < closeHour; hour++) {  // ⚠️ Will generate 23:00-24:00?
  // ...
}
```

**Fix**: Treat 24:00 as 23:00 for next day:
```typescript
if (pitch.close_time === '24:00' || pitch.close_time === '23:59') {
  closeHour = 24  // Iteration will go 0-23 for next day
} else {
  closeHour = parseInt(pitch.close_time.split(':')[0])
}
```

---

#### Issue #9: Daylight Saving Time (DST) Transitions
**Problem**: No handling for DST transitions. On spring forward (2 AM → 3 AM), the 2:00 hour skips. On fall back (2 AM → 1 AM), hour repeats.

```typescript
// No DST detection or adjustment
const dayStart = new Date(now)
dayStart.setUTCDate(dayStart.getUTCDate() + dayOffset)
```

**Impact**: In rare cases, slot hours may be skipped or duplicated around DST transitions.

**Fix**: Use UTC-based calculations (already done) or handle via timezone library. Current UTC approach is actually correct—UTC doesn't have DST.

---

#### Issue #10: Rate Limiter Reset on Deployment
**Problem**: Rate limiting uses in-memory Map that resets when Edge Function redeploys:

```typescript
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
// ⚠️ Resets to empty {} every redeploy
```

**Impact**: After deployment, any IP can make unlimited requests until rate limit window expires again.

**Fix**: Move to persistent storage (database table or Redis):
```sql
CREATE TABLE rate_limits (
  ip_address TEXT PRIMARY KEY,
  request_count INT DEFAULT 1,
  window_reset_at TIMESTAMP DEFAULT NOW() + INTERVAL '1 minute'
);
```

---

#### Issue #11: Auto-Refresh Hardcoded to 2 Minutes
**Problem**: Frontend refreshes slots every 120 seconds with no configuration:

```typescript
refreshInterval = setInterval(() => {
  if (pitchId) fetchSlots()
}, 120_000)  // ⚠️ Hardcoded, not configurable
```

**Impact**: 
- Too frequent: Wastes bandwidth and API quota
- Too infrequent: Doesn't catch rapid booking changes
- No exponential backoff if API fails

**Fix**: Make configurable and add smarter refresh:
```typescript
const REFRESH_INTERVAL = 60_000  // Move to constants
let consecutiveErrors = 0

refreshInterval = setInterval(() => {
  if (pitchId) {
    fetchSlots().catch(() => {
      consecutiveErrors++
      if (consecutiveErrors > 3) {
        clearInterval(refreshInterval)  // Stop on repeated failures
      }
    })
  }
}, REFRESH_INTERVAL)
```

---

## 4. Troubleshooting & Testing Available Slots

### 4.1 Debugging Checklist

**Slots Not Appearing?**
1. Verify user is logged in and has valid JWT
2. Check Edge Function logs: Supabase Dashboard → Functions → available-slots
3. Verify pitch exists and has valid `open_time` < `close_time` in database
4. Test the Edge Function directly:
   ```bash
   curl -X POST https://{PROJECT}.supabase.co/functions/v1/available-slots \
     -H "Authorization: Bearer {JWT_TOKEN}" \
     -H "Content-Type: application/json" \
     -d '{"pitch_id": "{pitch_id}"}'
   ```
5. Check browser Network tab for failed requests (401, 429, 500 errors)

**Slots Show Wrong Data?**
1. Check UTC timezone in backend vs. local display in frontend
2. Verify `datetime_start` and `datetime_end` are ISO 8601 UTC strings
3. Check if slot end time is correctly calculated (should be +1 hour)
4. Run: `SELECT * FROM bookings WHERE status = 'active' AND pitch_id = '{pitch_id}' ORDER BY slot_datetime;` to verify active bookings

**Slot Appears Available But Can't Book?**
- Likely cause: **Issue #3** (booking query failed in Edge Function)
- Check if you're trying to book a slot that's already booked
- Verify `status` is 'active' for your own booking in database

**Booked Slot Still Shows as Available?**
- Likely cause: **Issue #3** (booking DB query failed)
- Or: Booking has `status != 'active'` in database
- Edge Function only checks for `status = 'active'` bookings

**Too Many/Too Few Slots?**
- Verify pitch `open_time` and `close_time` are correct (24-hour format: HH:MM:SS)
- If 0 slots: `open_time >= close_time` (invalid hours)
- If few slots: Current time might be near end of operating hours

### 4.2 Testing Edge Function Locally

**Using Supabase CLI** (recommended):
```bash
cd supabase
supabase functions serve available-slots --env-file ../.env.local
# Runs on http://localhost:54321/functions/v1/available-slots
```

**Test requests**:
```bash
# Get all available slots (requires valid local JWT)
curl -X POST http://localhost:54321/functions/v1/available-slots \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json"

# Get slots for specific pitch
curl -X POST http://localhost:54321/functions/v1/available-slots \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{"pitch_id": "550e8400-e29b-41d4-a716-446655440000"}'
```

### 4.3 Testing Frontend Slot Display

**E2E Test Example** (using Playwright):
```typescript
// tests/available-slots.spec.ts
import { test, expect } from '@playwright/test'

test('slots should display for valid pitch', async ({ page }) => {
  await page.goto('/pitch/550e8400-e29b-41d4-a716-446655440000')
  
  // Wait for slots to load
  const slotsContainer = page.locator('[data-testid="slots-container"]')
  await slotsContainer.waitFor({ state: 'visible', timeout: 5000 })
  
  // Verify slots have correct structure
  const slots = await page.locator('[data-testid="slot-card"]').all()
  expect(slots.length).toBeGreaterThan(0)
  
  // Check first slot has valid datetime
  const firstSlot = slots[0]
  const time = await firstSlot.locator('[data-testid="slot-time"]').textContent()
  expect(time).toMatch(/\d{1,2}:\d{2}/)  // HH:MM format
})

test('should handle timezone conversion correctly', async ({ page }) => {
  // Set timezone to UTC-5
  const context = await browser.newContext({ locale: 'en-US', timezoneId: 'America/New_York' })
  
  // Verify slot display matches user timezone
  const slotTime = await page.locator('[data-testid="slot-time"]').first().textContent()
  // Should be in EST, not UTC
})
```

### 4.4 Manual Testing Checklist

- [ ] Login as student
- [ ] Navigate to pitch detail page
- [ ] Verify slots load within 2 seconds
- [ ] Verify slots are grouped by date
- [ ] Click on available slot → modal appears
- [ ] Verify modal shows correct time (in local timezone)
- [ ] Click "Confirm Booking" → booking created
- [ ] Refresh page → slot now shows as booked/unavailable
- [ ] Try to book same slot again → error message appears
- [ ] Wait 2 minutes → slots auto-refresh
- [ ] Close browser tab → return after 1 minute → slots should refresh on tab focus
- [ ] Test with user in different timezone (use browser dev tools)

---

## 5. Build and Test Commands
-   `npm run build`: Builds the frontend for production.
-   `npm run preview`: Serves the built frontend locally.
-   `npm run test:e2e`: Runs Playwright end-to-end tests.

## 6. General Development Guidelines

*   **TypeScript First**: All new code should be written in TypeScript with strict typing.
*   **Supabase**: Leverage Supabase Auth, PostgreSQL, and Edge Functions for backend logic.
*   **Styling**: Use Tailwind CSS for all styling.
*   **Internationalization**: Be mindful of i18n support (using `svelte-i18n`).
*   **Testing**: Write end-to-end tests using Playwright for new features.
*   **Security**: Always consider Row-Level Security (RLS) and secure API practices (e.g., JWT verification for Edge Functions).
*   **UTC Time**: Always use UTC for backend time operations to avoid timezone issues.

## 7. Useful Files and Directories

*   `frontend/`: SvelteKit frontend application.
*   `supabase/`: Supabase backend configuration, migrations, and Edge Functions.
*   `supabase/functions/available-slots/index.ts`: Core logic for generating available slots.
*   `api/cron/`: Vercel API routes for background jobs.
*   `README.md`: General project overview and setup instructions.

This `AGENTS.md` should be kept updated with any significant architectural changes or new conventions.
