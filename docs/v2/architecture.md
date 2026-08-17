# UNEEM V2 Architecture

Status: accepted V2 foundation

UNEEM V2 is a clean rebuild on a fresh Supabase project. Historical V1 users, booking rows and migration history are design evidence only, not deployment input.

## Core architecture

- **Frontend/PWA:** SvelteKit web app, mobile-first Android-style product UI.
- **Auth:** Supabase Auth. The final target is verified cookie-backed SSR; current browser-session restoration remains explicit technical debt until the SSR package/runtime path is validated.
- **Authorization and invariants:** PostgreSQL + RLS + narrow security-definer RPCs. UI visibility is never the authority boundary.
- **Hosting:** Vercel for the web application, Supabase Free for Auth/Postgres/Storage/Realtime-compatible needs.
- **Cost rule:** launch/validation remains $0; no paid validation branch or add-on is assumed.

## Identity model

Affiliation proof and Student ID ownership are deliberately separate.

### Academic path

A confirmed `@usmba.ac.ma` mailbox proves university affiliation. It does **not** prove that any Student ID typed by that user belongs to them.

- academic signup may omit Student ID
- confirmed academic email may grant normal sports access
- Student ID verification is a separate identity action

### Personal-email fallback

Students without the academic mailbox may use:

- personal/contact email
- Student ID claim
- private student-card evidence
- manual administrator review

Sports access remains restricted until verification succeeds.

### Public vs private identity

Public sports identity:
- full name
- unique case-insensitive `@username`
- avatar later when the asset/storage contract is added

Private identity:
- account email
- Student ID
- verification state/reason
- student-card evidence

Only a **verified** Student ID is authoritative and globally unique. Unverified claims do not reserve the ID. Duplicate ownership conflicts route to recovery/Help rather than exposing who owns the identity.

## Session/access boundary

`get_my_session_context()` is the preferred application bootstrap read. It returns the current user's profile fields plus the authoritative access/identity routing state in one DB operation.

`get_my_account_state()` remains a narrow identity/remediation contract where only account-state fields are needed.

Protected route decisions use the authoritative account payload. Database RLS/RPC authorization remains the security boundary even if client route guards fail.

## Booking model

A booking reserves the **full facility** for the configured slot duration.

`bookings` stores:
- owner
- facility
- `starts_at` / `ends_at`
- scheduled/cancelled state
- cancellation actor/time

Lifecycle (`upcoming`, `in_progress`, `completed`, `cancelled`) is derived from timestamps/status. No completion cron exists.

### Booking invariants

- one active/upcoming scheduled booking globally per student
- per-user booking attempts are transactionally serialized
- same-facility overlap is rejected atomically by an exclusion constraint
- facility timezone controls local opening/slot alignment
- booking window, frequency and cancellation cutoff are DB-authoritative
- direct student booking writes are closed; RPCs own creation/cancellation

Availability intentionally exposes who booked an occupied slot, but only the minimum peer display field. Another user's booking UUID, Student ID and email are not exposed.

### Booking read boundary

- `get_pitch_availability()` — one-call schedule/read model
- `list_my_bookings()` — owner-scoped history with server-derived lifecycle
- `get_next_booking()` — next active reservation

The browser does not maintain a competing lifecycle implementation.

## Open matches

A match is a social layer on top of one existing booking. It never creates another facility booking.

- booking owner is organizer and counts as one player
- private booking: organizer brings players independently; UNEEM accounts are not required
- open match: eligible UNEEM students join first-come-first-served
- reserved/offline friends are declared by the organizer and consume capacity
- spots = facility capacity - organizer - reserved - joined
- join capacity is serialized in PostgreSQL
- organizer cannot remove arbitrary joined players or switch a populated match back to private
- booking cancellation closes the linked match
- roster/discovery expose only public name/username

## Support and reports

One Help/Reports domain serves signed-out users, students and admins.

- authenticated support/appeal is account-owned
- guest support uses an unguessable capability token; only its digest is stored
- structured reports require target + reason context
- generic support cannot create an unstructured report
- direct table mutations are closed; RPCs own writes
- creation and reply throttles are separate
- admin replies/status transitions are authorized and audited where defined

Layer 018 provides caller-scoped support summary/detail reads to avoid browser-side multi-query aggregation.

## Admin boundary

Admin is a separate operational workspace:

- Bookings
- Facilities
- Users
- Verification
- Help & Reports
- Announcements
- Settings as the next configuration surface

High-risk operations are narrow and audited:

- booking cancellation with structured reason
- facility create/update/archive
- identity review decisions
- support moderation/status actions

`admin_list_users()` keeps directory search/filter/pagination in PostgreSQL instead of transferring the entire profile table to the browser.

The first administrator is bootstrapped explicitly after account creation. There is no public become-admin path.

## Performance contract

- avoid client request waterfalls
- combine closely related authorization/bootstrap reads
- push lifecycle and narrow aggregation into Postgres read models
- keep existing content visible during refresh
- mutations update affected local UI rather than forcing full reloads
- do not cache live availability or mutation responses as stale PWA data
- measure production performance rather than inferring it from small row counts

## Security contract

- RLS remains enabled on user-facing tables
- students cannot self-promote role/status or mutate another student's booking
- protected identity fields are not permissively self-writable
- security-definer functions have explicit search paths and minimal execute grants
- internal helpers are not public RPCs
- verification evidence stays private
- admin authorization is checked in PostgreSQL
- fresh V2 starts only from `supabase/v2`, never the historical migration directory

## Deployment contract

1. confirm the intended fresh Free Supabase target
2. apply `schema.sql` + layers `002` → `018`
3. run every transactional V2 contract suite
4. run Supabase security/performance advisors
5. generate hosted TypeScript DB types
6. seed reviewed facilities/configuration only
7. bootstrap first admin explicitly
8. configure Auth URLs + Vercel V2 credentials
9. smoke-test academic/personal auth, booking, matches, Help/Reports and admin
10. promote only after the hard gates pass

See `supabase/v2/README.md` for the exact ordered stack and `docs/v2/migration-plan.md` for launch gates.
