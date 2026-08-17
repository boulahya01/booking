# Booking V2 Architecture

Status: accepted foundation for V2 implementation

## Goals

V2 is a clean rebuild of the booking system on a fresh Supabase project. Legacy users and booking history are no longer migration requirements; students register again.

The application should feel immediate on a normal mobile connection, remain understandable to first-time users, and keep booking rules authoritative in PostgreSQL rather than duplicated across UI code and background jobs.

The old V1 production audit remains design evidence only: it tells us which architecture mistakes not to recreate.

## Product contract

### Student experience

- Students authenticate with the least confusing flow possible. V2 should avoid forcing users to understand unnecessary backend/account terminology.
- Authentication errors preserve entered context and offer the next useful action without exposing whether an account exists.
- New users register into the V2 Auth system and receive exactly one profile.
- Approved students can browse facilities and upcoming bookable times.
- Students can see occupied slots and the name of the student who booked them. This is intentional product behavior.
- Students can create one valid active/upcoming booking at a time, subject to facility booking-frequency rules.
- Students can view their upcoming booking and V2 booking history.
- Students can cancel only while the configured cancellation rule allows it; the default cutoff is one hour before start.
- Booking conflicts must be rejected atomically by the database even if two users submit at the same time.
- The UI never exposes database, Supabase, SQL, RPC, UUID, or HTTP implementation errors to end users.

### Admin experience

V2 uses a separate admin workspace rather than mixing admin actions into primary student navigation.

Initial sections:

- Bookings
- Facilities
- Users
- Announcements
- Settings

Admins can manage facility hours, booking frequency, activation/order, bookings, user access, announcements and platform settings. The first administrator is bootstrapped explicitly through a privileged operation; there is no public self-promotion path.

## Performance contract

V2 performance is an architecture requirement, not a later optimization pass.

- Critical route data is loaded on the server where practical.
- Initial pages do not depend on chains of client-side `onMount` requests.
- Independent database reads are parallelized.
- Availability requires one database operation rather than an Edge Function plus multiple database calls.
- Booking creation requires one authoritative transaction/RPC from the application.
- Existing content remains visible during background refreshes; a full-page skeleton is reserved for genuinely unknown initial content.
- Mutations update the affected UI locally instead of reloading complete lists.
- Repeated navigation reuses/prefetches safe assets and route data where appropriate.
- Production performance is measured rather than inferred from database size alone.

## UX state contract

Every async operation has four explicit states:

1. loading
2. success
3. empty
4. recoverable error

Errors shown to users contain a human explanation, the action they can take next, and preserved form/navigation context where possible.

Examples:

- A booking conflict says the time was just taken and keeps the user on the same facility/date.
- A frequency-limit error states when the user can book again.
- A cancellation-limit error explains that the booking is too close to its start time.
- An offline error distinguishes cached/read-only content from actions that require a connection.

## Authentication boundary

The final V2 target is verified cookie-backed Supabase SSR so server layouts can resolve the user/profile before protected route data is loaded.

The current foundation branch deliberately does **not** treat cookie-name presence as authentication. Until the SSR dependency upgrade is regenerated and runtime-tested, the browser session is restored first, `(app)` routes are not mounted while auth is unresolved, client navigation handles account-state routing, and database RLS remains the authorization boundary.

This interim state is explicit technical debt, not the final V2 auth architecture.

## PWA direction

V2 is installable as a Progressive Web App.

The service worker may cache the application shell and safe static assets. Booking availability and booking creation must always use current server/database state and must not trust stale cached availability.

Install UI is contextual and non-blocking rather than shown as an aggressive first-visit prompt.

## V2 data model

### profiles

- `id` uuid -> `auth.users.id`
- `student_id` text unique
- `full_name` text
- `role` (`student`, `admin` initially)
- `status`
- timestamps

Self-service profile editing uses narrow operations. Students may update safe display fields such as `full_name`; protected identity/access fields (`student_id`, `role`, `status`) are never writable through a permissive own-row policy.

### pitches

- `id`
- `name`
- `location`
- `sport_type`
- `capacity`
- `timezone`
- `open_time`
- `close_time`
- `slot_duration_minutes`
- `booking_window_hours`
- `booking_frequency_enabled`
- `booking_frequency_days`
- `cancellation_cutoff_minutes`
- `is_active`
- `sort_order`
- timestamps

The institution timezone is explicit. Facility opening hours are local business times, not implicitly UTC.

### bookings

- `id`
- `user_id`
- `pitch_id`
- `starts_at`
- `ends_at`
- `status`
- `cancelled_at`
- `cancelled_by`
- `created_at`

V2 does not use the V1 `slots` / `slot_id` hybrid or `booking_jobs` lifecycle model.

Completed/history rows are retained and lifecycle is derived from timestamps rather than synchronized by cleanup jobs.

### announcements

- `id`
- localized title/body
- `published_at`
- `expires_at`
- `created_by`
- timestamps

### announcement_dismissals

- `user_id`
- `announcement_id`
- `dismissed_at`

## Booking API boundary

Public application operations are intentionally small:

- `get_pitch_availability(...)`
- `create_booking(...)`
- `cancel_booking(...)`
- `update_my_profile(...)`

Internal trigger/helper functions must not be accidentally exposed as public RPC endpoints.

Availability can return booked-user display information because peer booking visibility is an explicit product requirement. It returns only the minimum profile fields needed for that UI, and shared facility availability is restricted to approved accounts.

## Security model

- RLS remains the database security boundary.
- Approved students may read booking information required for the shared facility schedule, including the booked student's display name.
- Pending/suspended accounts cannot query the shared facility schedule.
- Students may not arbitrarily modify another user's booking or protected profile fields.
- Self-profile updates cannot permit role/status escalation.
- Admin authorization is enforced server/database-side, not by hiding UI controls.
- `SECURITY DEFINER` functions use minimal grants and a fixed `search_path`.
- Trigger-only/internal functions are not executable as public API functions.
- The fresh V2 project starts from the V2 schema only; historical V1 migration files are never replayed.

## Historical V1 findings used as design evidence

The 2026-08-17 V1 audit found profile/Auth drift, duplicate RLS generations, migration-history drift, stale active bookings, Edge Function availability orchestration and unnecessary request waterfalls.

These findings explain the V2 architecture but are **not migration inputs**. V2 starts with zero users and zero booking history, then accumulates only clean V2 data.

## Deployment rule

V2 uses a fresh Supabase project.

The deployment process is:

1. create an empty $0-compatible Supabase project
2. apply only the reviewed V2 schema/security layers
3. run database contract tests and Supabase advisors
4. configure intentional facility/platform data
5. bootstrap the first administrator explicitly
6. connect Vercel to the new V2 project credentials
7. run student/admin smoke tests
8. promote the validated deployment to production

Once real V2 users exist, schema changes become forward-only migrations and user data is never reset as part of normal deployment.
