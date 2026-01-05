# Quick Deployment Checklist

## 🚀 Deploy Available-Slots Function

```bash
cd /home/shobee/Desktop/database/booking
npx supabase functions deploy available-slots
```

✅ Wait for success (should take ~30 seconds)

**OR Deploy via Dashboard:**
1. Go to [Supabase Dashboard](https://app.supabase.com) → Your Project → Functions
2. Click "available-slots"
3. Open file: `/supabase/functions/available-slots/index.ts`
4. Copy all content
5. Paste into dashboard editor
6. Click "Deploy updates" button
7. Wait for green checkmark

---

## 📊 Run Database Migration

In **Supabase SQL Editor**, paste and run:

```sql
-- Add virtual slot columns to bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS slot_datetime TIMESTAMP WITH TIME ZONE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pitch_id UUID REFERENCES pitches(id);

-- Create indexes
CREATE INDEX IF NOT EXISTS bookings_pitch_id_slot_datetime_idx ON bookings(pitch_id, slot_datetime);

-- Ensure profiles have full_name
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name TEXT;

-- Optional: populate test data
-- UPDATE profiles SET full_name = 'Test User' WHERE full_name IS NULL;
```

✅ Should complete without errors

---

## 🌐 Update Frontend

```bash
cd /home/shobee/Desktop/database/booking/frontend

# For development (already running):
npm run dev
# Just refresh browser (Ctrl+Shift+R)

# For production:
npm run build
# Deploy built files to Vercel or your host
```

---

## 🧪 Quick Test

1. **Open:** http://localhost:5173
2. **Login** with approved account
3. **Expected:** 14 orange slots (8 AM - 10 PM)
4. **Click "Book"** on any slot
5. **Expected:** Slot turns RED with your name
6. **Go to** /bookings
7. **Expected:** Your booking shows with slot time

---

## ✅ Verify Success

**In Browser Console (F12):**
```
[available-slots] Returning 14 total virtual slots
[Home] ✅ Received slots via invoke(): 14
```

**In Database (SQL Editor):**
```sql
SELECT COUNT(*) FROM bookings WHERE status = 'active';
-- Should show your test booking
```

---

## 🔴 If Something Goes Wrong

**No slots showing?**
- Check: Supabase Dashboard → Functions → available-slots → Logs
- Check: Browser DevTools → Network → look for "available-slots" response
- Check: pitches table has `open_time` and `close_time` set

**Duplicate slots?**
- Clear browser cache: Ctrl+Shift+R
- Wait 5 minutes for deployment to fully propagate

**Booking doesn't update?**
- Check browser console for errors (F12)
- Verify database migration ran successfully
- Try logging out and back in

---

## 📱 Update to Production

If using Vercel:

```bash
cd /home/shobee/Desktop/database/booking
git add -A
git commit -m "feat: fix slot booking system - virtual slots with full names"
git push origin main
# Vercel auto-deploys on push
```

---

## 📚 Documentation

For detailed information, see:
- `DEPLOYMENT_STEPS.md` - Full deployment guide with explanations
- `TESTING_GUIDE_NEW.md` - Comprehensive testing scenarios
- `IMPLEMENTATION_SUMMARY.md` - Complete overview of all changes

---

**Time Estimate:**
- Deploy function: 2 minutes
- Run migration: 1 minute  
- Test: 5-10 minutes
- **Total: ~15 minutes**

**Done?** Check the "✅ Verify Success" section above to confirm!
