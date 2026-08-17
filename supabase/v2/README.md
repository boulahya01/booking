# Supabase V2

This directory is the **clean database source of truth** for UNEEM / Booking V2.

The previous Supabase database is not a migration source. V2 starts with fresh Auth users and empty booking history; students register again.

## Important: do not replay V1

The repository still contains `supabase/migrations/`, which is historical V1 material. It contains schema drift and lifecycle complexity that V2 intentionally replaces.

**Do not initialize a new V2 project from that directory.**

The V2 initialization order is:

1. `schema.sql`
2. `002_security_contract.sql`
3. `003_onboarding_booking_rules.sql`
4. `004_availability_window.sql`
5. `005_identity_verification_state.sql`
6. `tests/booking_contract.sql`
7. `tests/security_contract.sql`
8. `tests/identity_contract.sql`

When the hosted V2 project is created, these schema layers become the first real V2 migration history. Do not replay historical V1 migrations.

## Identity and access rules

Membership proof and Student ID proof are deliberately separate.

- a confirmed `@usmba.ac.ma` email is the fast university-membership proof
- academic-email students may receive normal sports access after email confirmation while Student ID verification remains required
- a personal-email account is allowed, but stays restricted from normal booking/match access until manual student-card verification succeeds
- Student ID is trusted only after student-card review
- an unverified Student ID claim does **not** reserve that ID globally
- only a verified Student ID is unique, enforced by a partial PostgreSQL unique index
- competing approvals for the same Student ID are serialized and still protected by the unique index
- verification retries stay on the same Auth account and preserve attempt history
- structured rejection reasons drive remediation instead of dead-end statuses
- duplicate-identity conflicts return a generic error and must route to secure recovery/Help rather than exposing another account
- `get_my_account_state()` is the narrow authoritative payload for routing/access/status UI

## Booking rules

- no persistent slot rows
- no booking jobs / completion cron
- bookings store `starts_at` / `ends_at`
- completed state is derived from time
- one active/upcoming scheduled booking per student
- concurrent booking attempts by the same user are serialized
- same-pitch overlaps are rejected by PostgreSQL
- booking frequency and cancellation cutoff are facility configuration
- approved students can see intentional peer display names in occupied availability
- direct booking writes are not granted to students; booking/cancellation use narrow RPCs
- new V2 booking history begins empty

## Files

- `schema.sql` — clean schema, base RLS and booking contract
- `002_security_contract.sql` — approval boundary and safe self-profile mutation
- `003_onboarding_booking_rules.sql` — original onboarding/booking guardrails; identity rules are superseded by layer 005
- `004_availability_window.sql` — one-call facility availability window
- `005_identity_verification_state.sql` — academic/personal access split, verified Student ID ownership, recoverable verification attempts and account-state RPC
- `tests/booking_contract.sql` — transactional booking behavior tests
- `tests/security_contract.sql` — transactional approval/RLS tests
- `tests/identity_contract.sql` — academic fast path, personal restriction, verified-only uniqueness and reject → remediate → approve behavior

## Zero-cost validation

No paid Supabase development branch is required.

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/v2/schema.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/v2/002_security_contract.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/v2/003_onboarding_booking_rules.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/v2/004_availability_window.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/v2/005_identity_verification_state.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/v2/tests/booking_contract.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/v2/tests/security_contract.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/v2/tests/identity_contract.sql
```

Each contract test rolls back its fixtures.

## Hosted V2 rule

A hosted V2 project must start empty, receive only the V2 schema layers above, pass contract tests plus Supabase security/performance advisors, and only then be connected to production-facing Vercel configuration.
