# Supabase V2

This directory is the **clean database source of truth** for Booking V2.

The previous Vercel-managed Supabase database is no longer treated as a migration source. V2 starts with fresh Auth users and an empty booking history; students register again.

## Important: do not replay V1

The repository still contains `supabase/migrations/`, which is historical V1 migration material. It includes the schema drift and lifecycle complexity V2 is replacing.

**Do not initialize a new V2 project from that directory.**

The V2 initialization order is:

1. `schema.sql`
2. `002_security_contract.sql`
3. `003_onboarding_booking_rules.sql`
4. `tests/booking_contract.sql`
5. `tests/security_contract.sql`

When the hosted V2 project is created, the three schema layers should be recorded as the first real V2 migrations through the Supabase migration API/tooling rather than by replaying V1 history.

## Product rules represented here

- new Auth users map one-to-one to `profiles`
- application identities use the `@usmba.ac.ma` university email domain
- Student IDs are normalized and validated server-side
- email confirmation can move a pending account into the approved state
- pending/suspended users retain their account/profile state but cannot browse shared facility availability
- protected `student_id`, `role`, and `status` fields are not self-editable
- students can update their own display name only through `update_my_profile(...)`
- no persistent slot rows
- no booking jobs / completion cron
- bookings store `starts_at` / `ends_at`
- completed state is derived from time
- a student may hold only one active/upcoming scheduled booking at a time
- concurrent booking attempts by the same user are serialized before that rule is checked
- overlapping scheduled bookings for the same pitch are rejected by PostgreSQL
- approved students can see booked-slot display names through the availability RPC
- direct booking writes are not granted to clients; booking/cancellation use narrow RPCs
- cancellation cutoff is facility configuration, defaulting to one hour
- new V2 booking history begins empty

## Files

- `schema.sql` — clean V2 schema, RLS and core booking RPC baseline
- `002_security_contract.sql` — approval boundary and safe self-profile mutation hardening
- `003_onboarding_booking_rules.sql` — university identity validation and one-active-booking race guard
- `tests/booking_contract.sql` — transactional booking behavior tests against the final V2 rules
- `tests/security_contract.sql` — transactional profile/approval boundary tests

## Zero-cost validation

No paid Supabase development branch is required.

For a free disposable Postgres/Supabase runtime:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/v2/schema.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/v2/002_security_contract.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/v2/003_onboarding_booking_rules.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/v2/tests/booking_contract.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/v2/tests/security_contract.sql
```

Each contract test rolls back its fixtures.

The contract suites cover:

- successful booking creation
- same-pitch overlap protection
- one-active/upcoming-booking enforcement
- peer display-name visibility
- facility booking-frequency enforcement after a previous booking is completed
- blocking direct authenticated booking inserts
- cancellation cutoff and successful cancellation
- derived completed lifecycle without cron/jobs
- approved-only facility/availability access
- pending-account denial
- safe display-name self updates
- role-escalation resistance
- invalid profile-name rejection

## Hosted V2 rule

A hosted V2 project must start empty, receive only the V2 schema layers above, pass the contract/advisor gates, and only then be connected to Vercel.
