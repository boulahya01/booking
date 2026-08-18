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
19. `019_user_access_moderation.sql`
20. `020_first_admin_bootstrap.sql`
21. `021_auth_lifecycle_contract.sql`

No partial stack is a supported application target.

## Supabase Auth configuration

Database correctness is not enough: configure Supabase Auth before enabling registration.

### Provider and confirmation

- Enable Email + Password authentication.
- **Require email confirmation.** Do not enable automatic email confirmation for launch.
- Production Site URL: `https://uneem.site`.
- Add `https://uneem.site/**` and `https://www.uneem.site/**` to the allowed redirect URLs.
- For preview validation, add the exact Vercel branch/preview origin being tested. Prefer an exact preview origin rather than a broad wildcard.
- Keep the signup confirmation and password-recovery templates on Supabase's normal `{{ .ConfirmationURL }}` flow. The application supplies the final `emailRedirectTo` / `redirectTo` destination.

The application sends signup/resend confirmation back to `/verify-email` and password recovery back to `/reset-password`. `/reset-password` accepts a password update only after Supabase establishes a real `PASSWORD_RECOVERY` session; a normal signed-in session is not a recovery grant.

### Browser environment

Required in Vercel production/preview environments:

```env
VITE_SUPABASE_URL=https://<fresh-v2-project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
VITE_APP_URL=https://uneem.site
```

`VITE_SUPABASE_ANON_KEY` remains a legacy compatibility fallback. The production build intentionally fails when the URL/key are missing; UNEEM must never silently run against a dummy Supabase client.

Never expose a secret/service-role key in `VITE_*` variables or browser code.

## Authentication lifecycle contract

Supabase Auth owns credentials and email-link sessions. PostgreSQL owns application capabilities.

- Signup writes user metadata only for profile bootstrap fields; protected authorization never trusts editable user metadata after signup.
- Academic signup may omit Student ID. Confirmed `@usmba.ac.ma` email proves affiliation and can unlock sports access.
- Personal-email signup requires a Student ID claim, but sports access stays blocked until student-card verification is approved.
- `auth.users.email_confirmed_at` is part of authorization. An `approved` profile with an unconfirmed credential still cannot browse protected sports state, create bookings/matches, submit student-card verification, perform admin actions, or become the first admin.
- `get_my_session_context()` is the preferred session bootstrap read; `get_my_account_state()` is the narrow remediation/account-status read.
- Normal login restores the authoritative session payload and routes by role/access state instead of assuming `/home`.
- Password recovery is a temporary capability. The browser records only the recovery user's ID + expiry in tab-local `sessionStorage`; it never stores recovery/access tokens itself.
- After a successful recovery password update, the recovery capability is cleared and Supabase sessions are signed out so the user signs in again with the new password.
- Logout clears the local recovery capability before ending the current Supabase session.

Layer 021 makes confirmation fail-closed in PostgreSQL through confirmation-aware app/admin/match predicates plus booking/identity-submission guards.

## Identity and access

Affiliation proof and Student ID ownership are separate security properties.

- A confirmed `@usmba.ac.ma` mailbox is the fast university-affiliation path.
- Academic-email students may use sports after email confirmation even when Student ID ownership is not verified.
- Personal-email students provide a Student ID claim plus private student-card evidence and remain restricted until approval.
- Student ID is nullable for academic signup and authoritative only when `identity_status='verified'`.
- Only verified Student IDs are globally unique. Unverified claims may collide until review resolves ownership.
- Username is the case-insensitive unique **public** handle; Student ID and email remain private identity data.
- Verification retries stay on the same Auth account. Duplicate-identity conflicts route to safe recovery/Help rather than exposing another account.
- Student-card evidence is private, image-only, size-limited and user-scoped.
- Access suspension is separate from identity remediation. Suspension must not erase verification rejection/conflict state.

## Booking and matches

- No persistent slot rows and no completion cron; lifecycle is derived from timestamps.
- Facility timezone is explicit; default `Africa/Casablanca`.
- One scheduled booking whose `ends_at` is still in the future globally per student.
- Booking attempts are serialized per user; facility overlap is protected by PostgreSQL exclusion constraints.
- Booking frequency, slot duration, window and cancellation cutoff are database-authoritative.
- Shared availability may expose peer display name, never peer Student ID/email or another student's booking UUID.
- Student booking/cancellation writes use RPCs; direct writes stay closed.
- A match extends one booking and never creates another reservation.
- Match capacity/join is first-come-first-served and serialized in PostgreSQL.
- Roster/discovery expose public name/username only.
- Cancelling the authoritative booking closes its linked match.

## Help and reports

- Authenticated support/appeals are account-owned conversations.
- Reports require structured target + reason; generic support cannot create an unstructured report.
- Guest support uses a high-entropy capability token; only its digest is stored.
- Direct support writes stay closed; narrow RPCs own mutations.
- Admin support actions are authorized and audited.
- Public guest creation still needs an IP-aware zero-cost server/edge abuse gate before launch.

## Admin boundary

Admin authorization is enforced in PostgreSQL, not by UI visibility.

- `admin_list_bookings()` + `admin_cancel_booking()`
- `admin_save_pitch()` + `admin_archive_pitch()`
- `admin_list_users()` + audited `admin_set_user_access()`
- verification queue/review RPCs
- support inbox/reply/status RPCs
- admin match read model

Layer 019 closes direct authenticated profile updates and separates access moderation from identity review.

Layer 020 provides `private.bootstrap_first_admin(uuid)` for exactly one database-owner-controlled zero-admin → one-admin transition. Layer 021 additionally requires that bootstrap target's Supabase email be confirmed. Never expose this function through browser/server API keys or reuse it as a routine promotion path.

## Layer map

- `schema.sql` — clean baseline and booking/facility/announcement primitives.
- `002` — app-access boundary and safe self-profile mutation.
- `003` — booking serialization / one-active invariant.
- `004` — one-call availability.
- `005`–`006` — identity verification state + private evidence storage.
- `007`–`012` — Help/reports/admin support/abuse controls.
- `013` — public username + final signup metadata contract.
- `014`–`016` — open-match mutation/read/lifecycle integrity.
- `017` — audited booking/facility admin operations.
- `018` — authoritative session/bookings/support/verification/admin-user reads.
- `019` — audited student access moderation + direct profile-write closure.
- `020` — private one-time first-admin bootstrap.
- `021` — Supabase email-confirmation authority across app/admin/sports/verification/bootstrap.

## Contract tests

Committed suites:

- `tests/booking_contract.sql`
- `tests/security_contract.sql`
- `tests/identity_contract.sql`
- `tests/support_contract.sql`
- `tests/match_contract.sql`
- `tests/admin_operations_contract.sql`
- `tests/backend_read_contract.sql`
- `tests/user_moderation_contract.sql`
- `tests/first_admin_bootstrap_contract.sql`
- `tests/auth_lifecycle_contract.sql`

All test files are transactional and roll back fixtures.

The older domain suites use profile-only fixtures and were authored against layers through 020. Until those fixtures are converted to create matching `auth.users` rows, validate in two phases on a disposable/fresh target:

1. apply `schema.sql` + layers `002` → `020`;
2. run the pre-021 domain suites;
3. apply `021_auth_lifecycle_contract.sql`;
4. run `tests/auth_lifecycle_contract.sql`;
5. with real Supabase Auth accounts, re-smoke confirmation-aware booking, match, identity and admin flows on the final 021 schema.

Do **not** weaken layer 021 merely to make profile-only fixtures pass. Converting all older fixtures to explicit Auth users is follow-up test-harness cleanup, not a production authorization change.

## Hosted launch validation

A hosted V2 project is not launch-ready until all of the following are directly verified:

1. the complete schema through layer 021 is installed on the intended fresh Free project;
2. all SQL suites above pass in their documented validation phase;
3. Supabase email/password confirmation, Site URL and redirect allow-list are configured;
4. academic signup → confirmation → login → sports access passes end-to-end;
5. personal signup → confirmation → card submission → admin review → access passes end-to-end;
6. unconfirmed users cannot sign in normally or exercise sports/admin capabilities through edge/recovery sessions;
7. forgot-password → recovery email → `/reset-password` → password update → forced re-login passes;
8. expired/reused/non-recovery reset links fail safely;
9. booking/match concurrency and RLS negative tests pass on the final hosted schema;
10. Supabase security/performance advisors have no unresolved launch blockers;
11. generated hosted TypeScript database types match the application contract;
12. Vercel preview uses only the fresh V2 project URL + browser-safe publishable key.

Keep infrastructure at $0. Do not create a paid Supabase branch/add-on for validation.
