# Apply Supabase Migrations (quick guide)

This file contains exact commands you can use to apply the local SQL migration files to your Supabase database.

Prerequisites
- `psql` CLI installed and your Supabase Postgres connection string available (or use the Supabase Dashboard SQL editor).
- Alternatively, use the Supabase CLI if you have it configured.

Using psql
Replace `<SUPABASE_DB_URL>` with your database URL (the full connection string):

```bash
psql "<SUPABASE_DB_URL>" -f booking/supabase/migrations/20260418090000_add_id_photo_to_profiles.sql
psql "<SUPABASE_DB_URL>" -f booking/supabase/migrations/20260418091000_add_profiles_verification_trigger.sql
```

Using Supabase Dashboard (recommended if you don't have direct DB access)
1. Open the Supabase project in the web dashboard.
2. Go to "SQL" → "New query".
3. Copy the contents of `booking/supabase/migrations/20260418090000_add_id_photo_to_profiles.sql` and run it.
4. Then copy and run `booking/supabase/migrations/20260418091000_add_profiles_verification_trigger.sql`.

Using Supabase CLI (example)
If you have `supabase` CLI configured and logged in to the right project, you can also run the SQL directly:

```bash
supabase db query "$(cat booking/supabase/migrations/20260418090000_add_id_photo_to_profiles.sql)"
supabase db query "$(cat booking/supabase/migrations/20260418091000_add_profiles_verification_trigger.sql)"
```

Notes
- The second migration adds a trigger that restricts who can change verification fields — ensure it matches your app's expectations.
- After applying migrations, confirm the `profiles` table has the new columns and index:

```sql
\d+ public.profiles
SELECT column_name FROM information_schema.columns WHERE table_name = 'profiles';
```
