# Testing Guide - Slot Booking System

## Pre-Test Checklist

### 1. Database Setup
Before testing, ensure these columns exist in your `bookings` table:
- `slot_datetime` (TIMESTAMP WITH TIME ZONE) - stores when the slot is booked
- `pitch_id` (UUID) - denormalized reference to the pitch
- `slot_id` (UUID, NULLABLE) - optional reference to real slots (if you migrate from real to virtual)

**Quick SQL check in Supabase SQL Editor:**
```sql
-- Check columns
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'bookings' 
ORDER BY ordinal_position;

-- Should include: id, user_id, pitch_id, slot_datetime, slot_id, status, created_at
```

**If missing, run this in Supabase SQL Editor:**
```sql
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS slot_datetime TIMESTAMP WITH TIME ZONE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pitch_id UUID REFERENCES pitches(id);
CREATE INDEX IF NOT EXISTS bookings_pitch_id_slot_datetime_idx ON bookings(pitch_id, slot_datetime);
```

### 2. Profiles Setup
Ensure `profiles` table has:
- `full_name` column (TEXT) - user's full name to display on booked slots

**Quick check:**
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'profiles' AND column_name = 'full_name';
```

**If missing, run this:**
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
-- Update test user's full name
UPDATE profiles SET full_name = 'Test Student' WHERE student_id = 'YOUR_STUDENT_ID';
```

### 3. Pitches Setup
Ensure pitches have `open_time` and `close_time`:
```sql
-- Check
SELECT id, name, open_time, close_time FROM pitches LIMIT 1;

-- If missing, update
UPDATE pitches SET open_time = '08:00', close_time = '22:00' 
WHERE open_time IS NULL;
```

### 4. Edge Function Deployment
```bash
cd /home/shobee/Desktop/database/booking
npx supabase functions deploy available-slots
```

**Or manually via Supabase Dashboard:**
1. Functions → available-slots
2. Copy from `/supabase/functions/available-slots/index.ts`
3. Paste in editor
4. Click "Deploy updates"
5. Verify success (green checkmark)

---

## Test Scenario 1: View Available Slots

### Steps:
1. Open http://localhost:5173 (or production URL)
2. Login with a test account that is APPROVED
3. Should see "⚽ Book Your Pitch" page
4. Select a pitch
5. Should see 14 slots displayed (8 AM - 10 PM, hourly)

### Expected Results:
- ✅ Exactly 14 slots for today + future slots for tomorrow
- ✅ All slots are ORANGE (available)
- ✅ Each slot shows time in format "HH:MM"
- ✅ Each slot has "Book" button
- ✅ NO duplicated dates or times

### Console Logs (Press F12):
Should see:
```
[Home] Page loaded - isApproved: true
[Home] Fetching all pitches...
[Home] Fetched pitches: 1 [...]
[Home] Auto-selecting first pitch: [pitch-id]
[Home] Fetching available slots for pitch: [pitch-id]
[Home] Attempting supabase.functions.invoke()...
[Home] ✅ Received slots via invoke(): 14
[Home] Enriching slots with booer info...
[Home] ✅ Enriched slots with booker info
[Home] ✅ Total slots: 14
```

---

## Test Scenario 2: Book a Slot

### Steps:
1. From available slots list, click "Book" on ANY orange slot
2. Should see success alert "✅ Slot booked successfully!"
3. Slots should refresh automatically

### Expected Results:
- ✅ Alert appears with success message
- ✅ That specific slot becomes RED with your name (e.g., "👤 Test Student")
- ✅ "Book" button changes to nothing (no action on red cards)
- ✅ Other slots remain orange
- ✅ NO page refresh needed
- ✅ Slot time matches what you clicked

### Console Logs:
```
[Home] Booking slot: {user_id: '...', pitch_id: '...', slot_datetime: '...'}
[Home] ✅ Booking created successfully, refreshing slots...
[Home] Fetching available slots for pitch: [pitch-id]
[Home] ✅ Received slots via invoke(): 14
[Home] Enriching slots with booer info...
[Home] ✅ Enriched slots with booker info
[Home] ✅ Total slots: 14
```

---

## Test Scenario 3: Verify Booking in Database

### Steps:
1. In Supabase Dashboard, go to SQL Editor
2. Run this query:
```sql
SELECT id, user_id, pitch_id, slot_datetime, status, created_at 
FROM bookings 
WHERE status = 'active' 
ORDER BY created_at DESC 
LIMIT 5;
```

### Expected Results:
- ✅ Your booking appears with correct:
  - `user_id` (your user ID)
  - `pitch_id` (the pitch you selected)
  - `slot_datetime` (ISO format, timestamp of the slot)
  - `status` = 'active'

Example:
```
id | user_id | pitch_id | slot_datetime | status | created_at
----|---------|----------|---------------|--------|--------
abc123 | user-123 | pitch-456 | 2025-12-19T15:00:00+00:00 | active | 2025-12-19T14:55:00
```

---

## Test Scenario 4: View My Bookings

### Steps:
1. From Home page, click "📅 My Bookings" navigation link (or go to /bookings)
2. Should see your active booking(s)

### Expected Results:
- ✅ Page title shows "📅 My Bookings"
- ✅ Your booking appears with:
  - Slot Time: [date/time of your booking]
  - Booked: [when you created the booking]
  - Status badge: "✓ Active"
  - "❌ Cancel" button
- ✅ Count shows "You have X active booking(s)"

### Console Logs:
```
[Bookings] Page loaded - isApproved: true
[Bookings] Loading my bookings...
[Bookings] Fetching bookings for user: [user-id]
[Bookings] Fetched bookings: 1
```

---

## Test Scenario 5: Cancel a Booking

### Steps:
1. Go to /bookings page
2. Click "❌ Cancel" on any booking
3. Should see confirmation alert

### Expected Results:
- ✅ Alert: "✅ Booking cancelled successfully!"
- ✅ Booking disappears from My Bookings list
- ✅ Slot becomes available again on Home page
- ✅ Slot turns back to ORANGE

### Verification:
1. Go back to Home page
2. Select same pitch
3. Your previously booked slot should be ORANGE again (available)

### Database Check:
```sql
SELECT * FROM bookings WHERE id = 'booking-id-from-cancellation';
-- Should show status = 'cancelled' instead of 'active'
```

---

## Test Scenario 6: Two Users Booking Same Slot

### Pre-requisite:
- Have TWO approved accounts (can use different emails)
- Be ready to quickly switch between them (or use 2 browsers)

### Steps:
1. **User A:** Login, select pitch, see 14 available orange slots
2. **User B:** Login in different browser, same pitch, see same 14 orange slots
3. **User A:** Book slot at 3 PM
4. **User A:** Refresh → Slot becomes RED "👤 User A Name"
5. **User B:** Refresh or re-select pitch → Slot should also be RED "👤 User A Name"

### Expected Results:
- ✅ When User A books, slot is immediately unavailable for User B
- ✅ User B sees the slot as RED with User A's name
- ✅ Both users see the same slot state (no conflicts)

---

## Test Scenario 7: Timezone Test

### Purpose:
Verify slots don't show past times and handle date boundaries correctly

### Steps:
1. Book a slot for "tomorrow" from Home page
2. Check your timezone in browser console:
```javascript
console.log(new Date().toLocaleString())
```
3. Verify the slot time displayed matches your local timezone

### Expected Results:
- ✅ No slots show times that have already passed
- ✅ Date transitions happen correctly at midnight your local time
- ✅ No duplicate dates/slots across day boundaries

---

## Test Scenario 8: Error Handling

### Test 8a: Not Logged In
- Clear localStorage or open in incognito
- Go to /
- Should see redirect to Login page

### Test 8b: Not Approved
- Login with a pending account (not approved yet)
- Should see "⏳ Pending Admin Approval" message
- Cannot see slots

### Test 8c: Network Error
- Open DevTools Network tab
- Throttle to "Offline"
- Try to book
- Should show error message

### Test 8d: Already Booked Slot
- Book a slot as User A
- Try to book same slot as User A again (if possible)
- Should show error or be prevented by UI

---

## Troubleshooting Guide

### Issue: No slots appear (empty list)

**Check 1: Function Logs**
```
Supabase Dashboard → Functions → available-slots → Logs tab
Look for [available-slots] messages
```

**Check 2: Network Tab**
```
F12 → Network tab → Filter "available-slots"
- Should show 200 response with data
- Click response to see returned slots array
```

**Check 3: Pitch Configuration**
```sql
SELECT id, name, open_time, close_time FROM pitches;
-- Verify open_time and close_time are set
-- Default should be '08:00' and '22:00'
```

**Check 4: Browser Console**
```
[Home] ✅ Received slots via invoke(): 0
↑ If this shows 0, the function returned empty array
```

---

### Issue: Duplicated Slots / Wrong Dates

**OLD BUG:** Used `setDate()` and `setHours()` with local timezone → caused overlaps
**FIX:** Now uses `setUTCDate()` and `setUTCHours()` with proper 7-day window

**Verify Fix:**
- Should see exactly 14 unique slots per day
- No time appears twice
- Slot times are consecutive hours (08:00, 09:00, 10:00, ... 21:00)

---

### Issue: Booker Names Show "Student Unknown"

**Check 1: Profiles Have full_name**
```sql
SELECT id, student_id, full_name FROM profiles LIMIT 5;
-- Verify full_name column exists and is populated
```

**Check 2: Batch Query**
Look in console for:
```
[Home] Enriching slots with booer info...
[Home] ✅ Enriched slots with booker info
```
If enrichment fails, should still show slots (fallback).

**Check 3: Update Test User**
```sql
UPDATE profiles 
SET full_name = 'Test User' 
WHERE student_id = '12345';
```

---

### Issue: Slot Doesn't Refresh After Booking

**Expected Behavior:**
1. Click Book
2. Loading spinner appears
3. Alert shows success
4. Slots list refreshes automatically
5. Booked slot turns RED with your name

**If Not Working:**
- Check console for errors after booking
- Verify database insert succeeded:
```sql
SELECT * FROM bookings WHERE status = 'active' 
ORDER BY created_at DESC LIMIT 1;
```
- Try manual page refresh (F5)

---

## Success Criteria Checklist

After completing all tests, you should have:

- [ ] 14 slots display correctly (8 AM - 10 PM)
- [ ] No duplicate dates or times
- [ ] Can book a slot successfully
- [ ] Booked slot shows as RED with user's full name
- [ ] Can see booking in My Bookings page
- [ ] Can cancel a booking
- [ ] Cancelled slot becomes available again
- [ ] Two users can see each other's bookings
- [ ] No past times show
- [ ] Error messages appear for validation failures
- [ ] Profile icons (👤) display correctly
- [ ] Zone times are correct

---

## Performance Notes

**Slot Generation:** ~14-28 slots per day × number of pitches
**Booker Info Query:** Batch fetches all profiles in one query (not per booking)
**Response Time:** Edge function should return < 500ms
**UI Refresh:** Automatic after booking, no page reload

---

## Next Steps

1. Deploy the updated `available-slots` function
2. Verify database has `slot_datetime` and `pitch_id` columns
3. Update test users' `full_name` in profiles
4. Run through all test scenarios
5. Check browser console for any errors
6. Monitor Supabase function logs
7. Gather feedback and iterate
