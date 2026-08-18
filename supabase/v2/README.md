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
22. `022_guest_support_ip_gate.sql`

No partial stack is a supported application target.

## Supabase Auth configuration

Database correctness is not enough. Before registration is enabled:

- Enable Email + Password authentication and **require email confirmation**.
- Production Site URL: `https://uneem.site`.
- Allow `https://uneem.site/**` and `https://www.uneem.site/**` redirects.
- For preview validation, add the exact Vercel preview origin being tested instead of a broad wildcard.
- Keep Supabase confirmation/recovery templates on the normal `{{ .ConfirmationURL }}` flow. The application supplies `/verify-email` and `/reset-password` destinations.

Required browser-safe Vercel variables:

```env
VITE_SUPABASE_URL=https://<fresh-v2-project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
VITE_APP_URL=https://uneem.site
```

`VITE_SUPABASE_ANON_KEY` remains a compatibility fallback. Production/preview must never silently use a dummy Supabase client.

### Guest Help server environment

Layer 022 moves **new anonymous Help-thread creation** out of the browser and behind `/api/support/guest`. Required server-only variables:

```env
SUPABASE_URL=https://<fresh-v2-project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<fresh-v2-service-role-key>
SUPPORT_IP_HASH_SECRET=<at-least-32-random-bytes>
```

Never expose the service-role key or IP-hash secret through `VITE_*` variables. On Vercel, `x-forwarded-for` is overwritten by the platform rather than trusted from the caller. The endpoint HMAC-SHA256 hashes that network identity before PostgreSQL sees it; UNEEM does not persist raw client IP addresses. Missing server configuration or a missing trusted forwarded IP fails closed.

## Authentication lifecycle

Supabase Auth owns credentials and email-link sessions; PostgreSQL owns application capabilities.

- Academic signup may omit Student ID. A confirmed `@usmba.ac.ma` mailbox proves university affiliation and can unlock sports access.
- Personal-email signup requires a Student ID claim but remains blocked from normal sports access until private student-card verification is approved.
- `auth.users.email_confirmed_at` is part of authorization. `profile.status='approved'` alone is insufficient.
- `get_my_session_context()` is the preferred app bootstrap read. `get_my_account_state()` remains the narrow remediation read.
- Recovery is a temporary capability. `/reset-password` requires a real Supabase recovery session; a normal signed-in session is insufficient.
- Successful recovery clears recovery state and signs out so the user signs in again with the new password.
- First-admin bootstrap additionally requires a confirmed Supabase email and remains database-owner-only.

Layer 021 owns the final confirmation-aware app/admin/sports/verification/bootstrap boundary.

## Identity and access

Affiliation proof and Student ID ownership are separate properties.

- Academic students may use sports after academic-email confirmation without Student ID verification.
- Personal-email students require Student ID claim + private card evidence + approval.
- Student ID is private, nullable for academic signup, authoritative only when `identity_status='verified'`, and globally unique only for verified identities.
- Public sports identity is full name + case-insensitive unique username.
- Verification retries stay on the same Auth account. Duplicate-identity conflicts use generic Help/recovery paths without exposing another account.
- Operational suspension is separate from identity remediation. Direct authenticated `profiles UPDATE` remains closed; self edits use `update_my_profile()`, identity decisions use verification RPCs, and Suspend/Restore uses audited `admin_set_user_access()`.

## Booking and matches

- One student reserves the full facility for its configured duration.
- One active/upcoming scheduled facility booking globally per student.
- Booking attempts are serialized per user; facility overlap, frequency, window, alignment and cancellation cutoff are PostgreSQL-authoritative.
- Facility timezone is explicit; default `Africa/Casablanca`.
- Lifecycle is derived from timestamps; no completion cron.
- Shared availability may expose peer display name only. Another student's booking UUID, Student ID and email stay private.
- A match extends one existing booking and never creates another reservation.
- Open-match capacity/join races are serialized in PostgreSQL; organizer + reserved friends + joined users cannot exceed facility capacity.
- Roster/discovery expose public name/username only.
- Booking cancellation closes the linked match.

## Help and reports

- Help remains reachable for signed-out and restricted users.
- Authenticated support/appeals are account-owned conversations.
- Reports require structured target + reason; generic support cannot create unstructured reports.
- Guest conversations use a high-entropy capability token; only its digest is stored.
- Direct support table writes remain closed; narrow RPCs own mutations.
- Admin support actions are authorized and audited.

Layer 022 closes the remaining anonymous-creation abuse gap:

- browsers cannot execute the legacy guest-thread creation RPC;
- only `service_role` can execute `create_guest_support_thread_server(...)`;
- `/api/support/guest` supplies a trusted HMAC-hashed network identity;
- same-network attempts are transactionally serialized with an advisory lock;
- max 3 new guest threads per 10 minutes and 8 per hour per hashed network identity;
- existing optional-contact and global database burst limits remain defense-in-depth;
- existing capability-token guest reads/replies are unchanged, so recovery conversations remain usable after creation.

## Admin boundary

Admin authorization is enforced in PostgreSQL, not by route visibility.

- bookings: `admin_list_bookings()` + audited `admin_cancel_booking()`;
- facilities: audited `admin_save_pitch()` + `admin_archive_pitch()`;
- users: server-side `admin_list_users()` + audited `admin_set_user_access()`;
- verification: private evidence queue/review RPCs;
- support: inbox/context/reply/status RPCs;
- matches: admin read model.

Layer 020 provides `private.bootstrap_first_admin(uuid)` for exactly one database-owner-controlled zero-admin → one-admin transition. Never expose or reuse it as a routine promotion path.

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
- `022` — trusted server-only guest Help creation + HMAC IP throttling.

## Contract tests

Committed transactional suites:

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
- `tests/guest_support_ip_gate_contract.sql`

The older domain fixtures predate confirmation-aware layer 021 and use profile-only fixtures. Until those fixtures are converted to matching `auth.users`, validate on the fresh target in phases:

1. apply `schema.sql` + layers `002` → `020`;
2. run pre-021 domain suites;
3. apply `021_auth_lifecycle_contract.sql` and run `tests/auth_lifecycle_contract.sql`;
4. apply `022_guest_support_ip_gate.sql` and run `tests/guest_support_ip_gate_contract.sql`;
5. use real Supabase Auth accounts to smoke confirmation-aware booking, matches, identity, admin and guest Help on the final schema.

Do not weaken production authorization merely to make older profile-only fixtures pass.

## Hosted launch validation

UNEEM is not launch-ready until directly verified on the intended fresh Free Supabase project:

1. complete clean stack through layer 022 applied;
2. every transactional suite passes in its documented phase;
3. Auth confirmation, Site URL and redirect allow-list verified;
4. academic signup → confirmation → login → sports access passes;
5. personal signup → confirmation → card submission → admin review → access passes;
6. booking/private/open-match flows pass including race/RLS negatives;
7. Help/appeal/report/admin flows pass, including direct legacy guest creation denial, trusted server creation, IP throttling, and capability-token resume/reply;
8. moderation Suspend → explanation → appeal → audited Restore passes without corrupting identity state;
9. first-admin bootstrap passes once from trusted SQL/owner context and is inaccessible to application roles;
10. Supabase security/performance advisors reviewed and generated TypeScript DB types match the hosted schema;
11. exact-head canonical `Vercel – uneem` build/runtime plus responsive EN/AR/RTL/mobile/desktop smoke passes;
12. Vercel uses only the fresh V2 project and has the three required server-only guest Help variables;
13. real UNEEM logo/PWA icon is packaged; no placeholder brand asset is promoted.

Keep infrastructure at $0. Do not create paid Supabase branches/add-ons for validation.
