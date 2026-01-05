# ⚠️ CRITICAL FIX: Pitches Table is Empty!

## Problem
The `/bookings` page shows empty because the `pitches` table has **NO DATA**.

The frontend tries to fetch pitches:
```typescript
const { data, error: fetchError } = await supabase
  .from('pitches')
  .select('*')
```

But the table is empty, so `pitches` array is empty, and nothing shows on the page.

## Solution: Insert Test Pitch

### Option 1: Using Supabase Dashboard (Fastest) ✅

1. Go to **Supabase Dashboard** → Your Project
2. Click **SQL Editor** (left sidebar)
3. Click **New Query**
4. Paste this SQL:

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

5. Click **Run** (blue button)
6. You should see: `Query executed successfully`

### Option 2: Using psql command line

```bash
# Use a connection string with placeholders. DO NOT paste real passwords into docs.
psql "postgres://postgres:REPLACE_WITH_PASSWORD@<HOST>:6543/postgres?sslmode=require" \
  -c "INSERT INTO pitches (name, location, capacity, open_time, close_time) VALUES ('Football Pitch', 'Downtown Sports Complex', 20, '08:00'::TIME, '22:00'::TIME);"
```

### Option 3: Via Supabase REST API

```bash
# Use your anon key stored in environment when making requests. Replace the placeholder below.
curl -X POST "https://mismymbsavogkuovfyvj.supabase.co/rest/v1/pitches" \
  -H "apikey: REPLACE_WITH_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Football Pitch",
    "location": "Downtown Sports Complex",
    "capacity": 20,
    "open_time": "08:00",
    "close_time": "22:00"
  }'
```

## After Inserting Pitch

1. **Refresh the browser** (F5)
2. You should now see:
   - ✅ 🏟️ Football Pitch - Downtown Sports Complex
   - ✅ Orange cards with times (8:00, 9:00, 10:00, etc.)
   - ✅ Operating Hours: 08:00 - 22:00

## Code Changes Applied

✅ **Fixed:** Admin can now access booking page (bypassed approval check for role='admin')
✅ **Added:** Better console logs for debugging
✅ **Added:** Debug info shown if account not approved
✅ **Updated:** Slot card styling with orange/red gradients
✅ **Updated:** Grid layout responsive (2 columns on mobile)

## Files Modified Today

1. `frontend/src/pages/Bookings.tsx` - Admin bypass, debug logs, safety checks
2. `frontend/src/context/AuthContext.tsx` - Admin bypass, profile logs
3. `frontend/src/ui/SlotCard.tsx` - Better design
4. `frontend/src/ui/SlotCard.css` - Orange/red gradients
5. `frontend/src/styles/Bookings.css` - Responsive grid
6. `supabase/migrations/20251219000000_insert_test_pitch.sql` - Create test data (needs manual deployment)

## Next Steps

1. **Insert pitch data** using one of the 3 methods above
2. **Refresh browser**
3. **Check console logs** - should show `[Bookings] Fetched pitches: 1 [{...}]`
4. **See orange slot cards** - If not, take a screenshot and share console errors
