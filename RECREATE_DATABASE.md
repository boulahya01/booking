# Recreate Supabase Database

This repository contains the Supabase schema and migration history needed to rebuild the database from scratch.

## What is available

- `supabase/migrations/` contains the full incremental schema, functions, triggers, and RLS policy history.
- `supabase/current-active-db.sql` contains an exported schema snapshot for reference.
- There are no usable repository backups with production data in this repo; the available `.dump` files are empty.

## Recommended restore process

1. Ensure you have a valid Supabase database available.
   - For local development, start the Supabase stack and use the local DB URL.
   - For a remote project, use the Supabase project database URL.

2. Set the database URL in your environment:

```bash
export SUPABASE_DB_URL="postgresql://user:password@host:port/database"
```

or add it to `.env.local` as:

```ini
SUPABASE_DB_URL="postgresql://user:password@host:port/database"
```

3. Run the helper script from the repository root:

```bash
chmod +x restore-database.sh
./restore-database.sh
```

This will apply every SQL migration file in `supabase/migrations` in lexical order.

## Notes

- The canonical schema lives in `supabase/migrations/20251217120000_init_schema.sql` plus all subsequent migrations.
- The frontend expects additional fields and functions such as `sport_type`, booking frequency settings, profile verification fields, and notification RPCs.
- If you need to restore data, there is no valid dump in this repository. You must recover data from an external backup or another environment.

## If the database has been lost completely

- Create the database in your Postgres instance if it does not exist.
- Use the connection URL in `SUPABASE_DB_URL`.
- Run `./restore-database.sh` to build the schema and migrations from scratch.

## After restore

- Clear browser storage/cookies and log in again.
- Verify the following objects exist:
  - `profiles`, `pitches`, `slots`, `bookings`, `booking_jobs`, `system_notifications`, `user_dismissed_notifications`
  - `public.create_profile_on_auth_signup`, `public.get_email_by_student_id`
  - `public.get_active_notifications_for_user`, `public.dismiss_notification_for_user`
  - Required RLS policies on `profiles`, `pitches`, `slots`, `bookings`
