# 🚀 NEXT STEPS - Test & Deploy

## ✅ What's Been Completed

1. ✅ Created new `Home.tsx` page for browsing & booking slots
2. ✅ Refactored `Bookings.tsx` to show only user's bookings
3. ✅ Updated `App.tsx` routing (/ → Home, /bookings → My Bookings)
4. ✅ Updated navigation menu with emojis
5. ✅ Added Admin bypass (admins can book without "approved" status)
6. ✅ Created responsive styles for mobile
7. ✅ Added comprehensive console logging

## ❌ CRITICAL BLOCKER: Empty Pitches Table

**REASON NO SLOTS SHOW UP:**
The database `pitches` table is EMPTY. No pitches = No slots can be generated.

### 🔧 Fix: Insert Test Pitch Data

**Fastest method - Use Supabase Dashboard:**

1. Open your Supabase project
2. Go to **SQL Editor** (left sidebar)
3. Click **New Query**
4. **Copy and paste this:**
```sql
INSERT INTO pitches (name, location, capacity, open_time, close_time)
VALUES (
  'Football Pitch',
  'Downtown Sports Complex',
  20,
  '08:00'::TIME,
  '22:00'::TIME
);
```

5. Click the blue **Run** button
6. You should see: `Query executed successfully`

**That's it!** Now go back to your browser and refresh.

---

## 📋 Testing Checklist

After inserting pitch data, test this flow:

### Admin User Testing
- [ ] Login as admin
- [ ] See "⚽ Book Pitch" in menu
- [ ] Click it → see "Football Pitch" button
- [ ] Click "Football Pitch" → see orange slot cards
- [ ] See time slots (8:00, 9:00, 10:00, etc.)
- [ ] Click "Book" on a slot → success message
- [ ] Go to "📅 My Bookings" → see booked slot
- [ ] Click "❌ Cancel" → booking removed

### Student User Testing
- [ ] Login as approved student
- [ ] Same flow as admin
- [ ] Can book and see bookings

### Unapproved Student
- [ ] Login as new student (not approved)
- [ ] Should see "Pending Admin Approval" message
- [ ] Cannot access booking pages

### Mobile Testing
- [ ] Open on phone/tablet
- [ ] Slots show in 2-column grid
- [ ] Buttons are tappable
- [ ] Can scroll and book

---

## 📍 URL Map

```
/login              → Login page
/register           → Register page
/pending-approval   → Waiting for admin approval
/                   → Home (browse & book slots) ← DEFAULT
/bookings           → My bookings
/admin/users        → (Admin) Manage users
/admin/pitches      → (Admin) Manage pitches
/logout             → Log out
```

---

## 🎯 What Happens When You Book

1. User clicks "Book" on a slot
2. Frontend calls `supabase.functions.invoke('available-slots', { body: { pitch_id } })`
3. Edge function generates virtual slots (hourly for next 24h)
4. User sees orange cards with times
5. Click "Book" → inserts into `bookings` table
6. Slot disappears from available list
7. Appears in "My Bookings" page

---

## 📊 Current Architecture

```
DATABASE (Supabase)
├─ profiles (user data, role, approval status)
├─ pitches (football fields) ← NEEDS DATA!
├─ bookings (user reservations)
└─ slots (no longer used, now virtual)

EDGE FUNCTIONS (Supabase)
├─ available-slots → generates hourly slots dynamically
├─ bookings → CRUD operations
└─ login-by-student-id → auth

FRONTEND (Vite + React)
├─ / (Home.tsx) → Browse pitches & slots
├─ /bookings (Bookings.tsx) → My reservations
├─ /admin/* → Admin tools
└─ /auth/* → Login/register
```

---

## 🐛 Debugging Console Logs

Check browser DevTools (F12) Console tab for these logs:

**When opening Home page:**
```
[Home] Page loaded - isApproved: true
[Home] Fetching all pitches...
[Home] Fetched pitches: 1 [{id: "...", name: "Football Pitch", ...}]
[Home] Auto-selecting first pitch: {uuid}
[Home] Fetching available slots for pitch: {uuid}
[Home] Attempting supabase.functions.invoke()...
[Home] ✅ Received slots via invoke(): 15 slots
[Home] ✅ Filtered slots: 15
```

**If something fails:**
```
[Home] Fetched pitches: 0  ← NO DATA IN DATABASE!
[Home] Error: Failed to fetch available slots
[Home] invoke() error: {...} ← FUNCTION FAILED
```

---

## 📞 Troubleshooting

### "No available slots" message
- ✅ Check if it's within operating hours (8:00 - 22:00)
- ✅ Verify pitch exists in database
- ✅ Check console for errors

### "Choose a pitch" showing
- ✅ This should NOT appear anymore (pitches auto-select)
- ✅ If it shows, pitches table is empty

### Slots not appearing
- ✅ **INSERT PITCH DATA** (this is the #1 issue!)
- ✅ Check console for `[Home] Fetched pitches: 0`
- ✅ Verify edge function is deployed (check Supabase dashboard)

### Booking fails
- ✅ Check you're approved (admin bypass included)
- ✅ Check console for error message
- ✅ Verify not double-booking same slot

---

## 🎉 Success Indicators

You know it's working when:

✅ Home page shows "Football Pitch" button
✅ Clicking pitch shows orange slot cards
✅ Times are formatted like "11:00 AM"
✅ "Book" button works and adds to bookings
✅ "/bookings" page shows your reservation
✅ Mobile layout shows 2-column grid
✅ Navigation menu works with emojis

---

**🚀 Ready? Insert the pitch data and test!**

Questions? Check the console logs first - they'll tell you exactly where it's failing.
