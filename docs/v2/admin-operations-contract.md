# UNEEM V2 admin operations contract

Admin booking and facility changes are launch-sensitive operations. They must be authorized, recoverable where possible, and auditable; the browser is not an authority boundary.

## Database layer

Apply `supabase/v2/017_admin_operations.sql` after layer `016_match_lifecycle_integrity.sql`, then run `supabase/v2/tests/admin_operations_contract.sql` with the other V2 contract suites.

## Bookings

- Admin booking reads use `admin_list_bookings()` instead of the legacy client join that expected an email column on `profiles`.
- The RPC is admin-only and reads account email from `auth.users` inside a security-definer boundary.
- Search is intentionally narrow: student display name, verified/claimed Student ID, account email and facility name.
- Lifecycle (`upcoming`, `in_progress`, `completed`, `cancelled`) is derived from authoritative booking timestamps/status.
- Admin cancellation uses `admin_cancel_booking()` with a required structured operational reason.
- Cancellation records actor, reason, previous state and new state in `admin_audit_log`.
- Layer 016 remains authoritative for linked-match cancellation, so an admin booking cancellation also closes the attached match without a second client mutation.

## Facilities

- Authenticated clients keep read access to facilities but lose direct insert/update/delete privileges.
- Create/update uses `admin_save_pitch()` and records the full previous/new facility configuration in the audit log.
- Destructive delete is replaced by `admin_archive_pitch()`. Historical bookings/matches keep their facility relation while inactive facilities disappear from normal new-booking discovery.
- The admin editor exposes the existing V2 operational contract: location, sport, capacity, opening hours, slot duration, booking window, booking frequency, cancellation cutoff, active state and display order.
- Reactivation is an audited normal facility update (`is_active = true`).

## UI contract

Bookings and Facilities use the shared UNEEM Android-first design language with higher information density appropriate for operations. Both surfaces preserve useful content during refresh, use explicit empty/error states, avoid browser-native confirmation dialogs, and update local state after successful mutations instead of full-list reloads.

## Validation gate

This layer is not merge evidence by itself. Before merge, execute V2 layers 001-017 on the confirmed fresh V2 Supabase project and run all contract suites, including `admin_operations_contract.sql`. Verify admin authorization, direct facility-write denial, audit rows, booking-to-match cancellation behavior, and Vercel exact-head build/runtime evidence.
