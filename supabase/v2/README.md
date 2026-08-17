# Supabase V2 baseline

This directory contains the proposed clean V2 database contract.

It is intentionally **not** inside `supabase/migrations/`. Nothing here should be pushed to the current production database until the schema and migration path have been validated in an isolated Supabase/Postgres environment.

## Why this is separate

The current production project contains schema and migration-history drift. Replaying or rewriting the historical V1 migrations is not a safe V2 starting point.

V2 therefore follows this sequence:

1. keep production V1 read-only while the baseline is designed
2. validate `schema.sql` against a clean database
3. add database-level tests for auth, booking conflicts, frequency limits and cancellation
4. write an explicit V1 -> V2 data migration
5. verify row counts and relationships using a production snapshot/export
6. cut over only after application smoke tests pass

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

Do not treat this directory as an applied migration history yet.
