# UNEEM V2 database

This directory is the canonical database/authorization source for UNEEM V2. The normal Supabase CLI migration history in `../migrations/` must contain the equivalent timestamped V2 files only; historical V1 migrations are not a supported initialization path.

## Ordered source of truth

Apply the full stack in this exact order:

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
19. `019_user_access_moderation.sql`
20. `020_first_admin_bootstrap.sql`
21. `021_auth_lifecycle_contract.sql`
22. `022_hosted_lint_repairs.sql`
23. `023_guest_support_ip_gate.sql`
24. `024_advisor_hardening.sql`

No partial stack is a supported application target.

## Hosted state

The fresh hosted V2 Supabase project has consumed all 24 layers. Validation evidence established during the release-candidate work includes:

- auth lifecycle contract: PASS
- guest support IP gate contract: PASS
- advisor hardening contract: PASS
- booking contract: PASS
- corrected security, identity, support, match, admin operations, backend read, moderation and first-admin suites: operator-confirmed PASS
- multi-session concurrency/race gate: PASS
- post-layer-024 full-schema lint: `No schema errors found`
- Performance Advisor: 0 errors / 0 warnings

Do not infer future PASS state after a production-schema change. Any later schema/RLS/RPC change must rerun the affected contract gates.

## Authentication authority

Supabase Auth owns credentials and email-link sessions. PostgreSQL owns application capabilities.

- Every application profile starts `pending`.
- `auth.users.email_confirmed_at` is an authorization prerequisite.
- A confirmed `@usmba.ac.ma` mailbox proves university affiliation and may unlock sports access.
- Academic signup may omit Student ID.
- Personal-email signup requires a Student ID claim and private student-card review before sports access.
- A normal signed-in session is never password-recovery authority.
- Only the real Supabase `PASSWORD_RECOVERY` flow may create recovery continuity.
- Browser-visible metadata never overrides PostgreSQL authorization state.

Production runtime requirements are documented in `../../docs/v2/auth-runtime.md`.

## Identity and privacy

- Student ID is private and untrusted until `identity_status='verified'`.
- Only verified Student IDs are globally unique.
- Public identity is full name + normalized username.
- Student email, Student ID and card evidence must never appear in peer/public read models.
- Student-card evidence is private, image-only and user-scoped.
- Access suspension and identity remediation remain separate state machines.

## Booking and match invariants

- Booking lifecycle is derived from timestamps. There is no completion cron/job queue in V2.
- One scheduled booking with `ends_at > now()` globally per student.
- Booking attempts are advisory-lock serialized per student.
- Facility overlap is protected by PostgreSQL exclusion constraints.
- Facility timezone/window/frequency/alignment/cancellation rules are database-authoritative.
- A match extends one booking; joining a match creates no booking.
- Open-match joins are first-come-first-served and serialized.
- Reserved/offline friends consume capacity.
- Cancelling the authoritative booking closes the linked match.

## Help and reports

- Authenticated support conversations are caller-owned.
- Reports use structured target + reason context.
- Guest support creation goes through the same-origin server boundary, which HMAC-hashes client IP identity before invoking the service-role-only RPC.
- Raw client IP is never persisted.
- Guest resume/reply uses a high-entropy capability token; only its digest is stored.
- Layer 024 keeps only the intentional anonymous capability RPCs available to anon callers.

Server-only Help variables:

```env
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
SUPPORT_IP_HASH_SECRET=...
```

Never expose them through `VITE_*`.

## Admin boundary

Admin authorization is enforced in PostgreSQL, not by UI visibility.

Key narrow contracts include:

- booking list/cancel RPCs
- facility save/archive RPCs
- user directory + audited suspend/restore RPCs
- verification review RPCs
- support inbox/reply/status RPCs
- match/admin read models

Layer 019 revokes direct authenticated profile updates. Layer 020 exposes the one-time first-admin bootstrap only to the database-owner path. Layer 021 requires confirmed email for the bootstrap target and verified Student ID ownership for personal-email candidates.

## Contract tests

Committed suites in `tests/`:

- `booking_contract.sql`
- `security_contract.sql`
- `identity_contract.sql`
- `support_contract.sql`
- `match_contract.sql`
- `admin_operations_contract.sql`
- `backend_read_contract.sql`
- `user_moderation_contract.sql`
- `first_admin_bootstrap_contract.sql`
- `auth_lifecycle_contract.sql`
- `guest_support_ip_gate_contract.sql`
- `advisor_hardening_contract.sql`
- `concurrency_contract.ps1`

The SQL suites use transactional fixtures and roll them back. The concurrency harness intentionally opens independent hosted sessions and cleans its fixed namespaced fixtures in `finally`.

## Release rules

Before public launch:

1. Keep the hosted schema identical to the reviewed V2 stack unless a new migration is explicitly added and revalidated.
2. Keep Supabase Email+Password confirmation enabled.
3. Set Site URL to `https://uneem.site` and use the exact approved verification/recovery redirects.
4. Configure production SMTP using a UNEEM-controlled sender identity.
5. Verify real confirmation and recovery delivery to non-team addresses.
6. Run the browser launch smoke plus authenticated academic/personal/booking/match/Help/admin/moderation/recovery flows.
7. Re-run lint/advisors whenever the hosted schema changes.
8. Keep infrastructure at $0 unless the project owner explicitly changes that constraint.

Never weaken layer 019, 021, 023 or 024 merely to make a fixture or UI flow pass.
