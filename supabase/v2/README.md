# Supabase V2 baseline

This directory contains the proposed clean V2 database contract.

It is intentionally **not** inside `supabase/migrations/`. Nothing here should be pushed to the current production database until the schema and migration path have been validated in an isolated local Postgres/Supabase environment.

## Why this is separate

The current production project contains schema and migration-history drift. Replaying or rewriting the historical V1 migrations is not a safe V2 starting point.

V2 therefore follows this sequence:

1. keep production V1 read-only while the baseline is designed
2. validate `schema.sql` against a clean local database
3. run the database contract tests
4. write an explicit V1 -> V2 data migration
5. verify row counts and relationships using a production snapshot/export
6. cut over only after application smoke tests pass

No paid Supabase development branch is required for this workflow.

## Product rules represented here

- existing auth users map one-to-one to `profiles`
- email confirmation approves a pending account
- protected role/status fields are not self-editable through table RLS
- persistent `slots` and `booking_jobs` are removed
- bookings store `starts_at` / `ends_at`
- completed state is derived from time instead of synchronized by jobs
- overlapping scheduled bookings for the same pitch are rejected by PostgreSQL
- students can see booked-slot display names through the availability RPC
- direct booking writes are not granted to clients; booking/cancellation go through narrow RPCs
- V1's one-hour cancellation cutoff is preserved as the default, but becomes facility configuration
- booking history is retained

## Files

- `schema.sql` — clean V2 schema/RLS/RPC baseline for an isolated target
- `tests/booking_contract.sql` — transactional database contract tests for booking behavior and security boundaries

## Zero-cost local validation

Use a disposable local Supabase/Postgres database. Do **not** point these commands at production.

With `psql` available:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/v2/schema.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/v2/tests/booking_contract.sql
```

The contract test transaction rolls back all fixtures after the run. The schema itself is intended for a fresh/disposable database.

The current contract suite checks:

- successful one-hour booking creation
- database-level same-pitch overlap protection
- peer display-name visibility in availability
- facility booking-frequency enforcement
- blocking direct authenticated booking inserts
- cancellation cutoff enforcement
- successful cancellation outside the cutoff
- derived completed lifecycle without cron/jobs

Do not treat this directory as an applied migration history yet.
