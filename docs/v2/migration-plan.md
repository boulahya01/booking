# UNEEM V2 Fresh Deployment Plan

Status: accepted reset strategy

UNEEM V2 targets a **new, clean Supabase project**. The previous database/Auth/users/history are not migration inputs. Students register again after the complete V2 contract is installed and validated.

## Non-negotiable rules

- Never replay historical `supabase/migrations/` into V2.
- Never reconstruct legacy Auth users, password hashes, profiles or booking history.
- Stay on $0 infrastructure; no paid Supabase branch/add-on is required for validation.
- Apply the complete reviewed `supabase/v2` stack before accepting real registration or application traffic.
- Once real V2 users exist, schema changes become forward-only and user data is never reset as routine deployment work.

## Identity deployment contract

- Academic email verification proves university affiliation, **not ownership of a typed Student ID**.
- Academic signup may omit Student ID and receives the sports fast path after academic-email confirmation.
- Personal-email signup requires a Student ID claim and private student-card review before sports access.
- Student ID is private and authoritative only after verification; only verified IDs are globally unique.
- Public username is separate from Student ID and is case-insensitively unique.
- Verification/remediation stays on the same account. A future academic email should be linked to the existing identity rather than used to create a duplicate account.
- No physical/in-person verification workflow is part of V2.
- Access suspension is separate from identity verification. Routine moderation must never overwrite identity-remediation state or turn a pending personal-email account into an approved one.

## Source of truth

The deployable contract is the ordered stack documented in `supabase/v2/README.md`:

- `schema.sql`
- layers `002` through `020`
- booking/security/identity/support/match/admin/backend-read/user-moderation/first-admin transactional contract suites

The application must be configured against the resulting schema, not against an intermediate layer.

## Deployment sequence

1. Confirm the target Supabase project is the intended fresh **Free** V2 project and contains no V1 production data.
2. Apply `schema.sql` then layers `002` → `020` in order with fail-fast execution.
3. Run all V2 transactional contract suites.
4. Run Supabase security and performance advisors and resolve launch-blocking findings.
5. Generate TypeScript database types from the resulting hosted schema and compare them with the frontend API boundary.
6. Configure Auth site/redirect URLs for UNEEM production and preview domains.
7. Seed only reviewed facility configuration; do not copy stale V1 operational rows.
8. Create the selected owner Auth account, verify it manually, then run `private.bootstrap_first_admin(<profile_uuid>)` once from the trusted database-owner/Supabase SQL context. Never expose this function through an API key or browser.
9. Verify bootstrap created exactly one approved admin and one private bootstrap-log row.
10. Configure Vercel with the fresh Supabase URL and publishable key.
11. Smoke-test both identity paths and all core RPC workflows on preview.
12. Perform responsive/rendered UI review and runtime log review.
13. Promote only after all launch gates pass.

## Required smoke flows

### Academic identity
- register with `@usmba.ac.ma` without requiring Student ID
- confirm email
- exactly one profile exists
- sports access becomes available
- optional later Student ID verification does not change the meaning of academic affiliation

### Personal identity
- register with personal email + Student ID claim
- sports access remains blocked
- upload private student-card evidence
- admin review approves/rejects with structured remediation reason
- verified ID becomes authoritative only on approval
- duplicate verified identity cannot be claimed by another account

### Booking
- active facilities/availability load in the facility timezone
- peer occupied slot exposes only intended public display information
- availability exposes booking UUID only for the current user's own booking
- one active/upcoming booking globally per student
- frequency/window/alignment/cutoff rules are database authoritative
- same-slot race produces one winner
- lifecycle is derived from timestamps
- user cancellation closes a linked match through the booking lifecycle contract

### Matches
- booking owner opens a match without creating another booking
- organizer/reserved/joined capacity arithmetic is correct
- concurrent joins cannot exceed capacity
- organizer cannot make a populated public match private or displace public participants via reserved spots
- participant can leave according to the current match lifecycle rule
- roster/discovery expose public name/username only

### Help / reports
- guest support works without Auth using a capability token
- authenticated support/appeal is account-owned
- structured reports require target + reason and reject self-report where applicable
- students cannot read another student's conversation
- admin inbox/replies/status changes are authorized and audited where defined

### Admin / moderation
- non-admin RPC calls reject
- booking cancellation requires a structured reason and audit row
- facility create/update/archive is RPC-only and audited
- direct authenticated facility writes are denied
- direct authenticated profile writes are denied, including for admin browser sessions
- user directory search/status pagination is server-side and admin-only
- approved student can be suspended only with a structured audited reason
- verified suspended personal-email student can be restored through the moderation RPC
- unverified personal-email student cannot be restored into sports access
- pending identity cannot be approved through routine moderation
- admin identities cannot be modified by the routine student moderation RPC
- identity-remediation reason survives suspend/restore separately from access restriction reason

### First admin
- authenticated and service-role API contexts cannot execute `private.bootstrap_first_admin()`
- trusted database owner can bootstrap the selected existing profile once
- resulting profile is `role='admin'` and `status='approved'`
- second bootstrap attempt fails
- private bootstrap log records the one transition

## Launch gates

UNEEM does not go live until all are true:

1. Fresh V2 stack through layer 020 applies without error.
2. Every committed V2 SQL contract suite passes on the confirmed fresh target or equivalent disposable runtime.
3. Security/RLS negative tests pass, including direct profile-write and bootstrap-execute denial.
4. Booking and match concurrency invariants are validated.
5. Supabase advisors have no unresolved launch-blocking findings.
6. Generated hosted DB types match the application contract.
7. Vercel preview uses only the new V2 credentials and builds successfully.
8. Academic and personal verification flows both pass end-to-end.
9. Core booking/match/help/admin/moderation/bootstrap smoke tests pass.
10. The real UNEEM logo/PWA icon assets and responsive product review are complete before production promotion.

## Rollback

Before real V2 traffic, the fresh project can be recreated from the reviewed V2 stack if necessary.

After real users begin registering, rollback means deploying a known-good V2 application version against the same database and using forward corrective migrations. Do not reset live V2 user data.
