# Booking V2 Fresh Deployment Plan

Status: accepted reset strategy

V2 now targets a **new, clean Supabase project**. The previous Vercel-managed Supabase project is not treated as a migration source, and legacy Auth users / booking history are not requirements for launch.

Users will register again in V2.

## Non-negotiable rules

- Do not replay the historical V1 migration directory into the new database.
- Do not fabricate legacy Auth users, password hashes, profiles, or booking history.
- Do not copy stale V1 RLS policies, Edge Functions, slot tables, booking jobs, or lifecycle cleanup code.
- Do not spend money on Supabase branches or other validation infrastructure.
- The database is created from the reviewed V2 contract only.
- Once real V2 users/data exist, future schema changes are forward-only migrations.

## What the V1 audit is still useful for

The 2026-08-17 audit remains useful as engineering evidence, not migration input. It showed the problems V2 must avoid:

- Auth/profile drift
- duplicated RLS generations
- repository/production migration drift
- stale `active` booking lifecycle state
- slot/job lifecycle complexity
- availability routed through an Edge Function
- unnecessary client request waterfalls

The old row counts and identities are **not** V2 acceptance criteria anymore.

## V2 source of truth

The clean database contract lives in:

1. `supabase/v2/schema.sql`
2. `supabase/v2/002_security_contract.sql`
3. `supabase/v2/tests/booking_contract.sql`
4. `supabase/v2/tests/security_contract.sql`

The historical `supabase/migrations/` directory is legacy V1 reference only and must not be used to initialize V2.

## Fresh identity strategy

- students sign up again
- each new Auth user receives a new V2 `profiles` row
- Student ID remains unique
- protected profile fields (`student_id`, `role`, `status`) are never self-writable through a permissive table policy
- verified/approved account state controls access to the shared booking experience
- old passwords are not reconstructed
- old sessions are irrelevant
- old booking history starts empty

The first administrator is bootstrapped explicitly after the administrator account is created; there is no public self-promotion path.

## Clean deployment sequence

1. Create a new Supabase project on a $0-compatible plan only.
2. Confirm the project is empty and healthy.
3. Apply `supabase/v2/schema.sql` as the initial V2 database contract.
4. Apply `supabase/v2/002_security_contract.sql`.
5. Run the booking and security contract suites against the fresh project or a free disposable local Postgres runtime.
6. Run Supabase security and performance advisors.
7. Seed only intentional V2 configuration/facilities; do not import stale V1 operational rows.
8. Create/sign up the first real administrator identity and promote it through an explicit privileged operation.
9. Generate TypeScript database types from the resulting schema.
10. Configure the Vercel project with the new Supabase URL and publishable key.
11. Configure Auth redirect/site URLs for the Vercel production and preview domains.
12. Smoke-test signup, verification, approval, facility browsing, shared availability, booking, conflict handling, cancellation, profile update, admin authorization and PWA behavior.
13. Promote the validated V2 deployment to production.

## Launch gates

V2 does not go live until all of these are true:

1. A new student can register and receive exactly one profile.
2. Duplicate Student IDs are rejected.
3. An unapproved account cannot read shared facility availability.
4. An approved student can read active facilities and availability.
5. Occupied slots expose only the intended peer display name.
6. Students cannot alter `role`, `status`, or another user's booking.
7. Two users racing for the same facility/time produce exactly one successful booking.
8. User-level booking rules are enforced by the database/RPC, not only the UI.
9. Cancellation cutoff is authoritative and admin override is deliberate.
10. Completed lifecycle is derived from timestamps without cron cleanup jobs.
11. Admin-only mutations reject students.
12. Home / Pitch / My Bookings / Profile / Admin smoke flows pass.
13. No live availability or booking mutation is served from stale PWA cache.
14. Supabase security advisors contain no unresolved launch-blocking findings.
15. Vercel production uses only the new V2 Supabase credentials.

## Rollback

There is no legacy production database to roll back to.

Before real V2 traffic, the clean project can be recreated from the V2 contract if necessary. After real users begin registering, database changes become forward-only and application rollback means deploying a known-good V2 application version against the same database rather than resetting user data.
