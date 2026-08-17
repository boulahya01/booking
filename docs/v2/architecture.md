# Booking V2 Architecture

Status: accepted foundation for V2 implementation

## Goals

V2 keeps the existing product and data while removing V1 complexity that hurts reliability, performance, and usability.

The application should feel immediate on a normal mobile connection, remain understandable to first-time users, and keep booking rules authoritative in PostgreSQL rather than duplicated across UI code and background jobs.

## Product contract

### Student experience

- Students authenticate with the least confusing flow possible. V2 should avoid forcing users to understand the difference between sign-in and sign-up before they can continue.
- Authentication errors preserve entered context and offer the next useful action without exposing whether an account exists.
- Approved students can browse facilities and upcoming bookable times.
- Students can see occupied slots and the name of the student who booked them. This is an intentional product rule.
- Students can create one valid booking for an available time subject to facility booking-frequency rules.
- Students can view their upcoming booking and booking history.
- Students can cancel only while the configured cancellation rule allows it. The current V1 rule blocks cancellation within one hour of start.
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

Admins can manage facility hours, booking frequency, activation/order, bookings, user access, and announcements.

## Performance contract

V2 performance is an architecture requirement, not a later optimization pass.

- Critical route data is loaded on the server where practical.
- Initial pages do not depend on chains of client-side `onMount` requests.
- Independent database reads are parallelized.
- Availability should require one database operation rather than an Edge Function plus multiple database calls.
- Booking creation should require one authoritative transaction/RPC from the application.
- Existing content remains visible during background refreshes; a full-page skeleton is reserved for genuinely unknown initial content.
- Mutations update the affected UI locally instead of reloading complete lists.
- Repeated navigation should reuse/prefetch safe assets and route data where appropriate.
- Production performance is measured rather than inferred from database size alone.

## UX state contract

Every async operation has four explicit states:

1. loading
2. success
3. empty
4. recoverable error

Errors shown to users contain:

- a human explanation
- the action they can take next
- preserved form/navigation context where possible

Examples:

- A booking conflict says the time was just taken and keeps the user on the same facility/date.
- A frequency-limit error states when the user can book again.
- A cancellation-limit error explains that the booking is too close to its start time.
- An offline error distinguishes cached/read-only content from actions that require a connection.

## Authentication boundary

V2's target is verified cookie-backed Supabase SSR so server layouts can resolve the user/profile before protected route data is loaded.

The current foundation branch deliberately does **not** treat cookie-name presence as authentication. Until the SSR dependency upgrade can be regenerated and runtime-tested, the browser session is restored first, `(app)` routes are not mounted while auth is unresolved, client navigation handles account-state routing, and database RLS remains the authorization boundary.

This interim state is explicit technical debt, not the final V2 auth architecture.

## PWA direction

V2 should be installable as a Progressive Web App.

The service worker may cache the application shell and safe static assets. Booking availability and booking creation must always use current server/database state and must not trust stale cached availability.

Install UI should be contextual and non-blocking rather than shown as an aggressive first-visit prompt.

## V2 data model

### profiles

- `id` uuid -> `auth.users.id`
- `student_id` text unique
- `full_name` text
- `role` (`student`, `admin` initially)
- `status`
- timestamps

Self-service profile editing must use narrow operations. Students may update safe display fields such as `full_name`; protected identity/access fields (`student_id`, `role`, `status`) are never writable through a permissive own-row policy.

### pitches

- `id`
- `name`
- `location`
- `sport_type`
- `open_time`
- `close_time`
- `slot_duration_minutes`
- `booking_window_hours`
- `booking_frequency_enabled`
- `booking_frequency_days`
- `is_active`
- `sort_order`
- timestamps

The institution timezone must be explicit. Facility opening hours are local business times, not implicitly UTC.

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

Completed/history rows are retained rather than automatically deleted.

### announcements

- `id`
- localized title/body
- `published_at`
- `expires_at`
- `created_by`

### announcement_dismissals

- `user_id`
- `announcement_id`
- `dismissed_at`

## Booking API boundary

Public application operations should be intentionally small.

Expected database APIs:

- `get_pitch_availability(...)`
- `create_booking(...)`
- `cancel_booking(...)`
- `update_my_profile(...)`

Internal trigger/helper functions must not be accidentally exposed as public RPC endpoints.

Availability can return booked-user display information because peer booking visibility is an explicit product requirement. It must return only the minimum profile fields needed for that UI, and shared facility availability is restricted to approved accounts.

## Security model

- RLS remains the database security boundary.
- Approved students may read booking information required for the shared facility schedule, including the booked student's display name.
- Pending/rejected/suspended accounts cannot query the shared facility schedule.
- Students may not arbitrarily modify another user's booking or protected profile fields.
- Self-profile updates must not permit role/status escalation.
- Admin authorization is enforced server/database-side, not by hiding UI controls.
- `SECURITY DEFINER` functions use minimal grants and a fixed `search_path`.
- Trigger-only/internal functions are not executable as public API functions.

## V1 production baseline (2026-08-17)

Read-only inspection of the connected production project found:

- 62 profiles
- 5 pitches
- 109 bookings
- 0 persistent slot rows
- 0 booking job rows
- 79 bookings still marked active although all had already ended
- 30 cancelled bookings
- 0 completed bookings
- duplicate generations of RLS policies on core tables
- production migration history records only two migrations while the repository contains many more
- the deployed availability function still performs slot generation and cleanup work in an Edge Function

The data volume is small; measured application SQL statements are generally fast. V2 therefore targets request waterfalls, schema/policy drift, lifecycle complexity, and client loading behavior rather than treating database size as the primary performance problem.

## Migration rule

Production V1 data is preserved.

V2 is not a destructive reset. The migration process must:

1. snapshot/inspect the production contract
2. create the V2 schema in a safe target environment
3. transform users/profiles, facilities, and booking history
4. validate row counts and relationships
5. validate booking constraints and RLS
6. run application smoke tests
7. cut over only after verification

Historical production migrations are not rewritten in place. Changes to an existing production database, if required, are forward-only.
