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
19. `019_capability_restrictions.sql`
20. `020_capability_enforcement.sql`
21. `tests/booking_contract.sql`
22. `tests/security_contract.sql`
23. `tests/identity_contract.sql`
24. `tests/support_contract.sql`
25. `tests/match_contract.sql`
26. `tests/admin_operations_contract.sql`
27. `tests/backend_read_contract.sql`
28. `tests/capability_restrictions_contract.sql`

Every contract suite is transactional and rolls back its fixtures. A hosted V2 project is not launch-ready until the full ordered stack is applied, all suites pass, Supabase security/performance advisors are reviewed, and generated database types match the resulting schema.

## Identity and access

Affiliation proof and Student ID ownership are separate security properties. Academic email is the fast university-affiliation path; personal-email students remain sports-restricted until identity approval. Student ID becomes authoritative only after verification, and verification retries stay on the same Auth account. Username is the case-insensitive unique public handle; Student ID/email/evidence remain private.

`get_my_session_context()` is the preferred application bootstrap payload. Student-card evidence is private, image-only, size-limited and user-scoped; admin access is only through the verification workflow.

## Booking and matches

Booking lifecycle, availability, frequency, slot duration/window and cancellation cutoff remain PostgreSQL-authoritative. Direct booking/match writes are closed; narrow RPCs own mutations. Matches extend one booking and never create another reservation. Organizer + reserved friends + joined users must fit facility capacity, join remains serialized, and cancelling the booking closes its match.

## Recoverable moderation

Layers 019-020 separate behavioral moderation from identity verification and global account state.

- restrictions are capability-specific: `sports`, `matches`, or `support`
- every restriction has a structured reason and optional expiry
- users can read only their own safe capability/reason/expiry state through `get_my_capability_state()`
- admins list restriction history and restrict/lift capabilities only through audited RPCs
- direct restriction-table writes are closed
- sports restrictions block the shared sports capability; match-only restrictions preserve booking access while blocking Open Match mutations
- identity verification state is not rewritten as a side effect of behavioral moderation
- lifting requires a structured reason such as approved appeal/review completion/admin correction

The frontend must map these safe reason codes to clear user explanations, expiry where present, and Help/appeal recovery. A moderation sanction must never be removable through profile editing.

## Help and reports

Authenticated support/appeals are account-owned conversations. Reports use structured target/reason context. Guest support uses a high-entropy capability token and stores only its digest. Direct writes are closed and thread/reply throttles are separate. Public guest creation still needs an IP-aware zero-cost server/edge gate before launch.

## Admin backend boundary

Admin authorization is enforced in PostgreSQL, not by UI visibility. Booking/facility operations, identity review, support moderation, user directory reads, match administration and capability restrictions use narrow admin RPCs. Sensitive actions append structured audit history.

## Layer map

- `schema.sql` — clean baseline and core primitives.
- `002`–`006` — security + identity verification/private evidence.
- `007`–`012` — Help/reports/admin support + abuse throttles.
- `013` — public username identity.
- `014`–`016` — Open Match mutation/read/lifecycle integrity.
- `017` — audited booking/facility administration.
- `018` — authoritative session/bookings/support/verification/admin-user reads.
- `019` — capability-specific restriction history + audited admin restrict/lift operations.
- `020` — authoritative sports/match capability enforcement bridge.
- `tests/*.sql` — transactional domain/security contracts.

## Zero-cost validation

Run every SQL file above in order with `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f <file>` against the confirmed fresh Free Supabase project or a free local Postgres runtime. Do not create paid Supabase branches/resources for validation.
