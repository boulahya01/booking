# Deployment Steps for Latest Changes

## 1. Deploy Updated Edge Function

The `available-slots` edge function has been rewritten to fix several critical issues:

**Deploy via CLI:**
```bash
cd /home/shobee/Desktop/database/booking
npx supabase functions deploy available-slots
```

**Or Deploy via Dashboard:**
1. Go to Supabase Dashboard → Functions → available-slots
2. Copy the code from `/supabase/functions/available-slots/index.ts`
3. Paste into the dashboard editor
4. Click "Deploy updates"

**Key Fixes:**
- ✅ Fixed UTC timezone handling (was using local time)
- ✅ Extended slot generation to 7 days instead of 2 (prevents duplicates)
- ✅ Fixed exact datetime matching for bookings
- ✅ Using SERVICE_ROLE_KEY for RLS bypass
- ✅ Using Supabase SDK instead of REST API

## 2. Frontend Changes

**Home.tsx Updates:**
- ✅ `handleBookSlot()` now refreshes slots after booking (was just removing from UI)
- ✅ `enrichSlotsWithBookerInfo()` now fetches `full_name` from profiles (batch query optimized)
- ✅ Added comprehensive logging for debugging

**SlotCard.tsx Updates:**
- ✅ Shows booker name for both 'booked' and 'booked-by-you' statuses
- ✅ Added profile icon (👤) with better styling
- ✅ Improved visual clarity between booked slots

**SlotCard.css Updates:**
- ✅ Enhanced booker name display with background highlighting
- ✅ Better responsive design for mobile

## 3. Database Migrations (If Needed)

If you haven't run these yet:

```sql
-- Migration 1: Add slot_datetime and pitch_id to bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS slot_datetime TIMESTAMP WITH TIME ZONE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pitch_id UUID REFERENCES pitches(id);
CREATE INDEX IF NOT EXISTS bookings_pitch_id_slot_datetime_idx ON bookings(pitch_id, slot_datetime);

-- Migration 2: Make slot_id nullable
ALTER TABLE bookings ALTER COLUMN slot_id DROP NOT NULL;
ALTER TABLE bookings ADD CONSTRAINT bookings_has_slot_or_datetime 
  CHECK ((slot_id IS NOT NULL) OR (pitch_id IS NOT NULL AND slot_datetime IS NOT NULL));
```

## 4. Testing Checklist

- [ ] Deploy available-slots function
- [ ] Refresh browser at http://localhost:5173
- [ ] Check console logs for `[Home]` and `[available-slots]` messages
- [ ] Verify 14 slots appear for the day (8 AM - 10 PM, hourly)
- [ ] Verify slots are not duplicated across days
- [ ] Click "Book" on an available slot
- [ ] Verify:
  - [ ] Slot changes to red with your name
  - [ ] Slots refresh automatically
  - [ ] No duplication in the list
- [ ] Go to /bookings page
- [ ] Verify your booking appears in "My Bookings"
- [ ] Click "Cancel" to cancel the booking
- [ ] Verify slot becomes available again

## 5. Expected Behavior After Deploy

### Slot Display (Home Page):
- **Orange cards** = Available slots, "Book" button
- **Red cards** = Booked by others, shows "👤 Full Name", no button
- **Gray cards** = Your booking, "Cancel" button

### Booker Names:
- Should show actual user `full_name` from profiles
- Format: "👤 John Doe" (not just student ID)
- Fetched efficiently via batch query

### After Booking:
1. Click "Book" on an available slot
2. Card refreshes and shows as red with your name
3. Slots list updates automatically
4. No page reload needed

## 6. Troubleshooting

**Slots not appearing:**
- Check browser console for `[available-slots]` logs
- Check Supabase functions logs: Dashboard → Functions → available-slots
- Verify pitch has `open_time` and `close_time` set

**Wrong booker names showing:**
- Verify profiles have `full_name` column populated
- Check that batch profile query in Home.tsx is working
- Look for batch query logs: `[Home] Enriching slots with booer info...`

**Duplicate dates:**
- OLD: Function was generating slots for today+tomorrow, could overlap
- NEW: Extended to 7 days, uses proper UTC date math, checks `dayEnd > now`
- Should see only future slots

**Cards not changing after booking:**
- Verify `fetchAvailableSlots()` is called after booking insert
- Check that database migration added `slot_datetime` column to bookings

## 7. Rollback Plan

If something breaks:
1. Revert available-slots to previous version from Supabase dashboard
2. Clear browser cache (Ctrl+Shift+R)
3. Check error logs in Supabase dashboard
