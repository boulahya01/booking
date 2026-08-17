# Supabase V2

This directory is the **clean database source of truth** for UNEEM V2. The previous Supabase database and `supabase/migrations/` are historical V1 material and must never be replayed into the fresh V2 project.

## Initialization order

Apply only these files, in order:

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
18. `tests/booking_contract.sql`
19. `tests/security_contract.sql`
20. `tests/identity_contract.sql`
21. `tests/support_contract.sql`
22. `tests/match_contract.sql`
23. `tests/admin_operations_contract.sql`

Every contract test rolls back its fixtures. A hosted V2 project must start empty, receive only the layers above, pass all contract tests plus Supabase security/performance advisors, and only then be connected to production-facing configuration.

## Identity and access

- Confirmed `@usmba.ac.ma` email is the fast university-membership proof.
- Academic-email students may use normal sports flows after email confirmation while Student ID verification remains required but non-blocking unless another restriction exists.
- Personal-email students stay restricted from normal booking/match access until manual student-card verification succeeds.
- Username is the public case-insensitive unique handle. Student ID remains private verified identity.
- Unverified Student ID claims do not reserve an ID globally; only verified identity is unique.
- Verification retries stay on the same Auth account and preserve attempt history.
- Structured rejection reasons drive remediation; duplicate identity routes to safe Help/recovery without enumeration.
- `get_my_account_state()` is the authoritative routing/access payload.
- Student-card evidence is private, image-only, size-limited, user-scoped and admin-readable only through the verification workflow.

### Recoverable verification

- `student_id_incorrect` — correct Student ID and replace evidence as needed.
- `student_card_unreadable` — replace the card image.
- `name_mismatch` — correct permitted name data and resubmit evidence.
- `not_a_student_card` — replace with valid student-card evidence.
- `student_card_expired` — provide current evidence or use Help.
- `duplicate_student_identity` — no self-service ownership bypass; use secure Help/recovery.

## Help, reports and abuse controls

- Authenticated support and appeals are account-owned conversations.
- Guest support uses an unguessable capability token; only its SHA-256 digest is stored.
- Guest contact email stays optional for account-recovery cases.
- Direct support-table writes are closed; narrow RPCs own writes.
- New threads and replies have separate database throttles so an active conversation remains usable.
- Reports are authenticated-only and require structured target + reason context; self-reporting is rejected.
- Admin support actions are authorized and written to `admin_audit_log`.
- Anonymous guest creation still needs an IP-aware zero-cost server/edge gate before public launch; the database burst ceiling is not a substitute.

## Booking and facility rules

- No persistent slot rows and no completion cron; lifecycle is derived from timestamps.
- Bookings store `starts_at` / `ends_at`, reject same-facility overlap and serialize user booking rules.
- Booking frequency, slot duration, booking window and cancellation cutoff are facility configuration.
- Student booking/cancellation mutations use narrow authoritative RPCs; direct booking writes are closed.
- Admin booking reads use `admin_list_bookings()`; email is read from `auth.users` inside the admin-only security-definer boundary.
- Admin cancellation requires a structured operational reason and writes actor + previous/new state to `admin_audit_log`.
- Authenticated clients can read facilities but cannot insert/update/delete them directly.
- Facility create/update uses `admin_save_pitch()` and is audited.
- Facility removal is non-destructive: `admin_archive_pitch()` sets inactive and preserves booking/match history. Reactivation is an audited facility update.

See `docs/v2/admin-operations-contract.md` for the focused operations contract.

## Match rules

Matches extend an existing booking and never create another facility reservation.

- One booking has at most one match; booking owner is organizer and counts as one player.
- Reserved/offline friends consume capacity without UNEEM participant rows.
- Public spots = capacity - organizer - reserved spots - joined students.
- Eligible students join first-come-first-served; join capacity is serialized by locking the match row.
- Direct match table reads/writes stay closed; narrow RPCs own discovery, roster and mutation rules.
- Once public students join, the match cannot return to private and reserved count cannot increase enough to displace them.
- An empty organizer-owned match may be reopened without creating a second booking or match.
- Cancelling the authoritative booking closes the linked match while preserving participant history.
- Discovery exposes public sports identity only (`full_name`, `username`), never Student ID, email or verification evidence.

See `docs/v2/open-match-contract.md` for the focused match contract.

## Layer map

- `schema.sql` — clean baseline, base RLS and booking contract.
- `002_security_contract.sql` — approval boundary and safe self-profile mutation.
- `003_onboarding_booking_rules.sql` — original onboarding/booking guardrails; identity rules are superseded by layer 005.
- `004_availability_window.sql` — one-call facility availability window.
- `005_identity_verification_state.sql` — academic/personal access split and verification state machine.
- `006_identity_verification_storage.sql` — private evidence storage and narrow admin review queue.
- `007_support_threads.sql` — student/guest support threads.
- `008_support_admin_ops.sql` — audited admin support operations and shared `admin_audit_log`.
- `009_support_reports_abuse_controls.sql` — structured reports + abuse throttles.
- `010_support_report_admin_context.sql` — narrow report context for admins.
- `011_guest_support_optional_contact.sql` — no-auth support without requiring email.
- `012_support_rate_limit_scope.sql` — separate creation/reply throttle scopes.
- `013_public_username_identity.sql` — public username identity contract.
- `014_open_match_core.sql` — authoritative match mutation contract.
- `015_open_match_reads.sql` — Open Matches, roster, My Matches and admin read models.
- `016_match_lifecycle_integrity.sql` — reopen and booking→match cancellation integrity.
- `017_admin_operations.sql` — audited booking/facility admin RPCs and direct facility-write closure.
- `tests/*.sql` — transactional booking, security, identity, support, match and admin-operation contracts.

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
  supabase/v2/tests/booking_contract.sql \
  supabase/v2/tests/security_contract.sql \
  supabase/v2/tests/identity_contract.sql \
  supabase/v2/tests/support_contract.sql \
  supabase/v2/tests/match_contract.sql \
  supabase/v2/tests/admin_operations_contract.sql
do
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$file" || exit 1
done
```

Keep infrastructure at $0: validate against the confirmed fresh V2 project/database and do not create paid Supabase development branches.
