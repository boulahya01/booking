# 📊 Your Next Manual Steps (Visual Guide)

## Step-by-Step What To Do Now:

```
┌─────────────────────────────────────────────────────────────┐
│  YOU ARE HERE: Code is fixed locally, ready to deploy       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: Open Supabase Dashboard                             │
│ ─────────────────────────────────────────────────────────── │
│ 1. Go to: https://app.supabase.com                         │
│ 2. Select your project (booking)                            │
│ 3. Left sidebar → Functions → available-slots               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 2: Replace the Function Code                           │
│ ─────────────────────────────────────────────────────────── │
│ 1. Select ALL code (Ctrl+A)                                │
│ 2. Delete it                                                │
│ 3. Copy NEW code from:                                      │
│    /supabase/functions/available-slots/index.ts            │
│ 4. Paste it in dashboard                                    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 3: Deploy                                              │
│ ─────────────────────────────────────────────────────────── │
│ 1. Click "Deploy updates" button (top right)               │
│ 2. Wait 30 seconds...                                       │
│ 3. Look for ✅ GREEN checkmark                             │
│ 4. Should show: "Successfully deployed"                     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 4: Test in Browser                                     │
│ ─────────────────────────────────────────────────────────── │
│ 1. Hard refresh: Ctrl+Shift+R (or Cmd+Shift+R)            │
│ 2. Open DevTools: F12 → Console tab                        │
│ 3. Look for: "[available-slots] Returning 14 total..."    │
│ 4. Should see EXACTLY 14 orange slot cards                 │
│ 5. NO duplicates, NO 84 slots                              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 5: Test Booking Flow                                   │
│ ─────────────────────────────────────────────────────────── │
│ 1. Click "Book" on any orange slot                         │
│ 2. Alert appears: ✅ "Slot booked successfully!"          │
│ 3. Slot changes to RED with your name                      │
│ 4. Try to click "Book" on another orange slot              │
│ 5. ERROR appears: "You already have active booking"        │
│ 6. ✅ Double booking prevented!                            │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 6: Test Cancel Button                                  │
│ ─────────────────────────────────────────────────────────── │
│ 1. Click "📅 My Bookings" link                             │
│ 2. See your booking with slot time                         │
│ 3. Click "❌ Cancel" button                                │
│ 4. Alert: ✅ "Booking cancelled successfully!"            │
│ 5. Booking disappears from list                            │
│ 6. Go back to Home → slot is orange again (available)      │
│ 7. ✅ Can now book a new slot                              │
└─────────────────────────────────────────────────────────────┘
                            ↓
                  🎉 YOU'RE DONE! 🎉
                  All systems working!
```

---

## 📝 What Code Changed:

### Frontend Changes (Already Applied):
```
✅ Home.tsx
   - Added double-booking prevention check
   - Before booking: checks if user has active booking
   
✅ Bookings.tsx
   - Shows slot_datetime (when the slot is)
   - Cancel button displays properly
```

### Backend Changes (Need to Deploy):
```
✅ available-slots/index.ts
   - OLD: Generated 7 days of slots (84 slots total)
   - NEW: Generates only 24-hour window (max 14 slots)
   - Key change: 24-hour cutoff calculation
```

---

## ⏱️ Time Estimate:
- Deploy function: **2 minutes**
- Test in browser: **3 minutes**
- Total: **~5 minutes**

---

## 🎯 Expected Results After Deploy:

| Metric | Before | After |
|--------|--------|-------|
| Slots shown | 84 | 14 ✅ |
| Cancel button | ❌ Missing | ✅ Works |
| Double booking | ✅ Allowed | ❌ Prevented |
| Slot times | Duplicate | ✅ Unique |
| User can book | Unlimited | 1 at a time ✅ |

---

## 🚨 If Something Goes Wrong:

**Still seeing 84 slots?**
→ Clear cache: Ctrl+Shift+R and wait 2 minutes

**Cancel button not showing?**
→ Hard refresh: Ctrl+Shift+R

**Can still book 2 slots?**
→ Refresh page and try again

**Slots not loading at all?**
→ Check Supabase Functions logs (Functions → available-slots → Logs)

---

## ✅ Final Checklist Before You Start:

- [ ] You have Supabase dashboard access
- [ ] You're logged into your project
- [ ] VS Code shows the updated files
- [ ] You're ready to copy-paste new code

## ✅ After You Deploy:

- [ ] Function deployed (green checkmark)
- [ ] Browser hard-refreshed
- [ ] Seeing 14 slots (not 84)
- [ ] Booking works
- [ ] Double-booking prevented
- [ ] Cancel button works

---

**You're all set! Follow the steps above and you're done! 🚀**
