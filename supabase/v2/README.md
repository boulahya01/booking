# Supabase V2

This directory is the **clean database source of truth** for UNEEM V2. The historical `supabase/migrations/` tree is V1 reference only and must never initialize the fresh V2 project.

## Initialization order

Apply the complete stack before enabling real registration or application traffic:

1. `schema.sql`
2. `002_security_contract.sql`
3. `003_onboarding_booking_rules.sql`
4. `004_availability_window.sql`
5. `005_identity_verification_state.sql`
6. `006_identity_verification_storage.sql`
7. `007_support_threads.sql`
8. `008_support_admin_ops.sql`
9. `009_support_reports_abuse_controls.sql`
10. `010_support_report_admin_context.sql`
11. `011_guest_support_optional_contact.sql`
12. `012_support_rate_limit_scope.sql`
13. `013_public_username_identity.sql`
14. `014_open_match_core.sql`
15. `015_open_match_reads.sql`
16. `016_match_lifecycle_integrity.sql`
17. `017_admin_operations.sql`
18. `018_backend_read_contract.sql`
19. `tests/booking_contract.sql`
20. `tests/security_contract.sql`
21. `tests/identity_contract.sql`
22. `tests/support_contract.sql`
23. `tests/match_contract.sql`
24. `tests/admin_operations_contract.sql`
25. `tests/backend_read_contract.sql`

Every contract suite is transactional and rolls back its fixtures. A hosted V2 project is not launch-ready until the full ordered stack is applied, all suites pass, Supabase security/performance advisors are reviewed, and generated database types match the resulting schema.

## Identity and access

Affiliation proof and Student ID ownership are separate security properties.

- A confirmed `@usmba.ac.ma` mailbox is the fast university-affiliation path.
- Academic-email students may use sports after email confirmation even when Student ID ownership is not yet verified.
- Personal-email students provide a Student ID claim plus private student-card evidence and remain restricted until approval.
- Student ID is nullable for academic signup and is authoritative only when `identity_status='verified'`.
- Only verified Student IDs are globally unique. Unverified claims may collide until review resolves ownership.
- Username is the case-insensitive unique **public** handle; Student ID and email remain private identity data.
- Verification retries stay on the same Auth account. Duplicate-identity conflicts route to safe recovery/Help rather than exposing who owns the identity.
- `get_my_session_context()` is the preferred application bootstrap payload; `get_my_account_state()` remains the narrow account-state contract used by verification/remediation flows.
- Student-card evidence is private, image-only, size-limited and user-scoped. Admin access is only through the verification workflow.

The baseline schema and layer 005 already implement the academic/personal split. Layer 013 adds the final username requirement to signup. **Do not expose signup while only a partial stack is installed.**

## Booking and facilities

- No persistent slot rows and no completion cron. Lifecycle is derived from timestamps.
- Facility timezone is explicit; default is `Africa/Casablanca`.
- A student may hold only one scheduled booking whose `ends_at` is still in the future.
- Booking attempts are serialized per user, and facility overlap is protected by a PostgreSQL exclusion constraint.
- Facility booking frequency, slot duration, booking window and cancellation cutoff are database-authoritative.
- Availability intentionally exposes the peer display name but never peer Student ID/email or another user's booking UUID.
- Student booking/cancellation writes use narrow RPCs; direct booking writes remain closed.
- Admin booking cancellation and facility changes use audited RPCs. Facilities are archived rather than destructively deleted.

### Authoritative booking reads

Layer 018 moves application lifecycle/read assembly into PostgreSQL:

- `list_my_bookings()` — caller-scoped history with server-derived lifecycle and narrow facility fields.
- `get_next_booking()` — one authoritative upcoming/in-progress reservation.
- `get_pitch_availability()` — current shared schedule; only own `booking_id` is returned.

The browser must not reconstruct lifecycle as a competing source of truth.

## Matches

Matches extend one existing booking and never create another facility reservation.

- Organizer is the booking owner and counts as one player.
- Reserved/offline friends consume capacity without UNEEM participant rows.
- Public spots = facility capacity - organizer - reserved spots - joined students.
- Join is first-come-first-served and serialized by locking the match row.
- Direct match table reads/writes are closed; RPCs own discovery, roster and mutations.
- A match with public participants cannot be silently made private or have reserved spots increased so joined users are displaced.
- Cancelling the authoritative booking closes the linked match.
- Discovery/roster expose public sports identity only (`full_name`, `username`).

## Help and reports

- Authenticated support/appeals are account-owned conversations.
- Reports use the structured report RPC with target + reason; generic support cannot create an unstructured report.
- Guest support uses a high-entropy capability token; only its SHA-256 digest is stored.
- Guest contact email is optional.
- Direct support writes are closed; narrow RPCs own mutations.
- Thread creation and reply throttles are separate.
- Admin support actions are authorized and audited.
- Public guest creation still needs an IP-aware zero-cost server/edge gate before launch; database burst throttling is defense-in-depth, not a complete anti-abuse boundary.

### Authoritative support reads

Layer 018 adds:

- `list_my_support_threads()` — one row per own conversation plus latest message, avoiding browser-side multi-query aggregation.
- `get_my_support_thread()` — caller-owned conversation detail only.

## Admin backend boundary

Admin authorization is enforced in PostgreSQL, not by UI visibility.

- `admin_list_bookings()` + `admin_cancel_booking()`
- `admin_save_pitch()` + `admin_archive_pitch()`
- `admin_list_users()` — server-side search/status/pagination over narrow profile fields.
- verification queue/review RPCs
- support inbox/context/reply/status RPCs
- admin match read model

Sensitive or destructive operations are audited where defined by their domain contract.

## Layer map

- `schema.sql` — clean baseline, base RLS, academic/personal identity-compatible profile creation, booking/facility/announcement primitives.
- `002_security_contract.sql` — approved-app boundary and safe self-profile mutation.
- `003_onboarding_booking_rules.sql` — **booking-only** serialization and one-active reservation invariant; it does not define identity onboarding.
- `004_availability_window.sql` — application one-call availability window.
- `005_identity_verification_state.sql` — verification state machine and academic/personal access split.
- `006_identity_verification_storage.sql` — private evidence storage and admin review queue.
- `007`–`012` — Help/report conversations, admin operations and abuse throttles.
- `013_public_username_identity.sql` — final public username/signup contract.
- `014`–`016` — open-match mutation/read/lifecycle integrity.
- `017_admin_operations.sql` — audited booking/facility administration and direct facility-write closure.
- `018_backend_read_contract.sql` — authoritative session, bookings, support, verification-attempt and admin-user read models.
- `tests/*.sql` — transactional domain/security contracts.

## Zero-cost validation

```bash
for file in \
  supabase/v2/schema.sql \
  supabase/v2/002_security_contract.sql \
  supabase/v2/003_onboarding_booking_rules.sql \
  supabase/v2/004_availability_window.sql \
  supabase/v2/005_identity_verification_state.sql \
  supabase/v2/006_identity_verification_storage.sql \
  supabase/v2/007_support_threads.sql \
  supabase/v2/008_support_admin_ops.sql \
  supabase/v2/009_support_reports_abuse_controls.sql \
  supabase/v2/010_support_report_admin_context.sql \
  supabase/v2/011_guest_support_optional_contact.sql \
  supabase/v2/012_support_rate_limit_scope.sql \
  supabase/v2/013_public_username_identity.sql \
  supabase/v2/014_open_match_core.sql \
  supabase/v2/015_open_match_reads.sql \
  supabase/v2/016_match_lifecycle_integrity.sql \
  supabase/v2/017_admin_operations.sql \
  supabase/v2/018_backend_read_contract.sql \
  supabase/v2/tests/booking_contract.sql \
  supabase/v2/tests/security_contract.sql \
  supabase/v2/tests/identity_contract.sql \
  supabase/v2/tests/support_contract.sql \
  supabase/v2/tests/match_contract.sql \
  supabase/v2/tests/admin_operations_contract.sql \
  supabase/v2/tests/backend_read_contract.sql
do
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$file" || exit 1
done
```

Use the confirmed fresh Free Supabase project or a free local Postgres runtime. Do not create paid Supabase branches/resources for validation.
