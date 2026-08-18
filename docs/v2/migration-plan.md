# UNEEM V2 Fresh Deployment Plan

Status: accepted reset strategy

UNEEM V2 targets a **new, clean Supabase project**. Previous V1 Auth users, profiles, bookings and migration history are not deployment inputs. Students register again only after the complete V2 contract is installed and validated.

## Non-negotiable rules

- Never replay historical `supabase/migrations/` into V2.
- Never reconstruct legacy Auth users, password hashes, profiles or booking history.
- Stay on $0 infrastructure; no paid Supabase branch/add-on or email-provider upgrade is required for validation.
- Apply the complete reviewed `supabase/v2` stack before accepting real registration or application traffic.
- Once real V2 users exist, schema changes become forward-only; normal deployment never resets user data.

## Identity and Auth deployment contract

- Academic email confirmation proves university affiliation, **not ownership of a typed Student ID**.
- Academic signup may omit Student ID and receives sports access only after the academic email is actually confirmed.
- Every new application profile starts `pending`; accidental Supabase auto-confirm must fail closed rather than silently grant sports access.
- Personal-email signup requires a Student ID claim, confirmed email and private student-card review before sports access.
- Student ID is private and authoritative only after verification; only verified IDs are globally unique.
- Public username is separate from Student ID and is case-insensitively unique.
- Verification/remediation stays on the same account. No physical/in-person verification workflow exists.
- Access suspension is separate from identity verification and must not overwrite identity-remediation state.
- Supabase Auth owns credentials, email confirmation and recovery sessions. PostgreSQL independently requires a confirmed Auth email for sports/admin capabilities.
- A profile accidentally marked `approved` while `auth.users.email_confirmed_at` is null must still fail closed.
- Password recovery may update a credential only from a real Supabase `PASSWORD_RECOVERY` event/session; a normal signed-in session or user-editable URL marker is not a reset grant.
- Signed-in password changes require `current_password` in the Supabase credential update.

## Source of truth

The deployable contract is documented in `supabase/v2/README.md`:

- `schema.sql`
- layers `002` through `021`
- booking/security/identity/support/match/admin/backend-read/user-moderation/first-admin/auth-lifecycle contract suites

The frontend must target the resulting final schema, never an intermediate layer.

## Supabase Auth configuration

Before enabling registration:

1. enable Email + Password authentication;
2. require email confirmation;
3. set production Site URL to `https://uneem.site`;
4. allow production redirects for `https://uneem.site/**` and `https://www.uneem.site/**`;
5. add the exact Vercel preview/branch origin used during validation;
6. keep confirmation and recovery templates on the normal Supabase `{{ .ConfirmationURL }}` flow;
7. configure **custom SMTP** with a UNEEM-controlled authenticated sending domain;
8. disable click/open tracking for Auth mail so confirmation/recovery URLs are not rewritten;
9. verify signup confirmation returns to `/verify-email`;
10. verify password recovery returns to `/reset-password` and produces the Supabase recovery event/session used by the app.

Supabase's built-in sender is development-only and is not a UNEEM launch transport. The connected Resend Free account currently cannot add `auth.uneem.site` because its domain allowance is already consumed by another verified domain; do not pay, delete that domain, or send UNEEM mail from the unrelated domain to bypass the limit. Brevo Free is the current zero-cost fallback candidate for transactional SMTP, but its account/domain/DNS/SMTP setup is still an external operational gate.

Never place SMTP secrets, Supabase service-role keys, or other credentials in browser/Vite environment variables.

## Deployment sequence

1. Confirm the target is the intended fresh **Free** V2 Supabase project and contains no V1 production data.
2. Apply `schema.sql` then layers `002` → `020` with fail-fast execution.
3. Run the pre-021 transactional domain contract suites documented in `supabase/v2/README.md`.
4. Apply `021_auth_lifecycle_contract.sql`.
5. Run `tests/auth_lifecycle_contract.sql`.
6. Run Supabase security/performance advisors and resolve launch-blocking findings.
7. Generate TypeScript DB types from the final hosted schema and compare them with frontend API contracts.
8. Configure Supabase Auth provider, confirmation, Site URL, redirect allow-list and email templates.
9. Configure and verify custom SMTP + sending-domain DNS; send real confirmation and recovery messages to non-team addresses.
10. Configure Vercel with the **fresh V2** project URL plus browser-safe publishable key.
11. Create the selected owner Auth account, confirm its email, then run `private.bootstrap_first_admin(<profile_uuid>)` once from trusted database-owner/Supabase SQL context. A personal-email candidate must already have verified identity; a confirmed academic candidate does not require Student ID verification.
12. Verify exactly one approved admin and one private bootstrap-log row exist.
13. Seed only reviewed facility configuration; never copy stale V1 operational rows.
14. Smoke-test signup/login/confirmation/recovery plus both identity paths and all core RPC workflows on preview.
15. Perform responsive/rendered review and runtime-log review.
16. Promote only after every launch gate passes.

## Required Auth smoke flows

### Academic signup and confirmation
- register with `@usmba.ac.ma` and no Student ID
- signup creates exactly one **pending** profile
- before confirmation: normal sign-in fails and sports/admin DB capabilities remain unavailable
- confirmation link is actually delivered to a non-team mailbox and returns to `/verify-email`
- confirmation restores one authoritative session/profile/account payload
- profile transitions to approved academic access
- login routes directly to the correct destination without `/home` flicker

### Personal signup and verification
- register with personal email + Student ID claim
- confirmation email is actually delivered
- confirm email
- sports remains blocked after confirmation
- upload private student-card evidence
- admin approval/rejection uses structured remediation
- approval makes verified Student ID authoritative and unlocks sports on the same account
- duplicate verified identity cannot be claimed by another account

### Login and session restore
- invalid credentials use safe generic handling
- unconfirmed correct account is routed to confirmation/resend flow
- approved student routes to `/home`
- pending/suspended student routes to `/pending-approval`
- admin routes to `/admin`
- page refresh restores session + account state from the authoritative session RPC
- if Supabase sign-in succeeds but account-context restoration fails, the local Auth session is closed instead of leaving a hidden partial login
- logout clears local recovery capability and current Supabase session

### Forgot password / recovery
- forgot-password success response does not enumerate whether an email exists
- real SMTP/rate/config errors are shown as retry-safe errors rather than falsely claiming delivery
- valid recovery email is actually delivered and returns to `/reset-password`
- reset form opens only for a Supabase `PASSWORD_RECOVERY` grant
- user-editable `?type=recovery` or hash markers never create recovery authority
- normal authenticated session cannot use `/reset-password` as a password-change shortcut
- expired/invalid/reused recovery links fail safely and offer a fresh request
- password update succeeds with normal password policy
- recovery URL material is removed from the address bar after session resolution
- recovery capability is cleared and session is signed out after success
- old password no longer signs in; new password does

### Signed-in password change
- user must enter current password
- wrong current password fails without changing credential
- current-password verification occurs in the same Supabase credential mutation, avoiding an extra sign-in/session event
- new-password rules remain enforced
- successful change keeps current session usable and attempts to revoke other sessions

## Required product/backend smoke flows

### Booking
- facilities/availability use facility timezone
- peer occupied slot exposes only intended public display information
- peer booking UUID / Student ID / email never leak
- one active/upcoming booking globally per student
- frequency/window/alignment/cutoff rules are DB-authoritative
- same-slot race produces one winner
- unconfirmed or suspended accounts cannot create bookings
- user cancellation closes a linked match

### Matches
- booking owner opens a match without creating another booking
- capacity arithmetic is correct
- concurrent joins cannot exceed capacity
- organizer cannot displace joined users through reserved spots or return populated public match to private
- unconfirmed/restricted accounts cannot use match reads/mutations
- roster/discovery expose public name/username only

### Help / reports
- guest support works without Auth using a capability token
- authenticated support/appeal is account-owned
- structured reports require target + reason
- students cannot read another student's conversation
- admin inbox/replies/status actions are authorized/audited

### Admin / moderation
- non-admin calls reject
- unconfirmed `role='admin'` profile still fails the DB admin predicate
- booking cancellation requires structured reason + audit
- facility create/update/archive is RPC-only + audited
- direct authenticated facility/profile writes are denied
- user directory search/filter/pagination is server-side
- suspend/restore is structured and audited
- routine moderation cannot approve pending identity or alter admin identities

### First admin
- browser/authenticated/service-role API contexts cannot execute `private.bootstrap_first_admin()`
- unconfirmed bootstrap target is rejected
- confirmed personal-email target with unverified identity is rejected
- confirmed academic target, or confirmed+verified personal target, can be bootstrapped exactly once by trusted DB owner
- second bootstrap fails
- private log records the transition

## Launch gates

UNEEM does not go live until all are true:

1. Fresh V2 stack through layer 021 applies without error.
2. Every documented SQL suite passes in its validation phase.
3. Auth lifecycle contract passes, including unconfirmed-profile drift and fail-closed auto-confirm behavior.
4. Supabase Auth confirmation, Site URL and redirect configuration are verified.
5. Custom SMTP with a UNEEM-controlled authenticated sender is configured and real confirmation/reset delivery succeeds.
6. Security/RLS negative tests pass.
7. Booking/match concurrency invariants are validated on the final hosted schema.
8. Supabase advisors have no unresolved launch blockers.
9. Generated hosted DB types match the application contract.
10. Canonical `Vercel – uneem` exact-head preview builds successfully with only fresh V2 credentials.
11. Academic signup/confirmation/login passes end-to-end.
12. Personal signup/confirmation/card-review/access passes end-to-end.
13. Forgot-password/recovery/reset/forced-relogin passes end-to-end.
14. Signed-in current-password change passes.
15. Core booking/match/help/admin/moderation/bootstrap smoke tests pass.
16. Real UNEEM logo/PWA icon assets and responsive EN/AR/RTL review are complete.

## Rollback

Before real V2 traffic, the fresh project may be recreated from the reviewed V2 stack if necessary.

After real users begin registering, rollback means deploying a known-good V2 application version against the same database and using forward corrective migrations. Never reset live V2 user data.
