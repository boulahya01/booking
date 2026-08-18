# UNEEM V2 Architecture

Status: accepted V2 foundation

UNEEM V2 is a clean rebuild on a fresh Supabase project. Historical V1 users, booking rows and migration history are design evidence only, not deployment input.

## Core architecture

- **Frontend/PWA:** SvelteKit web app, mobile-first Android-style product UI.
- **Credentials:** Supabase Auth email/password, confirmation and recovery.
- **Application authorization:** PostgreSQL + RLS + narrow security-definer RPCs. UI visibility is never the authority boundary.
- **Session bootstrap:** one authoritative `get_my_session_context()` read after Supabase establishes the user session.
- **Hosting:** Vercel + Supabase Free.
- **Cost rule:** launch/validation remains $0.

Verified cookie-backed SSR remains future auth infrastructure work. Until it is intentionally implemented and runtime-tested, the browser restores Supabase Auth state and PostgreSQL remains the authorization boundary.

## Authentication lifecycle

Supabase Auth and the application database own different parts of identity:

- Supabase Auth owns password credentials, email confirmation, recovery links and refresh/access sessions.
- PostgreSQL owns sports eligibility, identity-review state, moderation, admin authorization and business invariants.
- `auth.users.email_confirmed_at` is checked by PostgreSQL capability predicates. A profile marked approved is not sufficient when its credential is unconfirmed.

### Signup and confirmation

- signup sends explicit `emailRedirectTo` to `/verify-email`
- confirmation is required for launch
- confirmation/resend use the same redirect contract
- `/verify-email` supports the normal Supabase confirmation redirect and restores the authoritative session/account payload after confirmation
- academic confirmation can unlock sports immediately
- personal confirmation does not bypass student-card verification

### Login and session restore

- sign-in uses Supabase password verification
- email-not-confirmed is a distinct recoverable state
- after sign-in, `get_my_session_context()` provides profile + role/access state in one DB read
- students route by `can_use_sports`; admins route to the admin workspace
- page refresh restores the same authoritative session context rather than rebuilding access from unrelated client queries

### Password recovery

- forgot-password sends an explicit redirect to `/reset-password`
- recovery UI is usable only after Supabase creates a real `PASSWORD_RECOVERY` session
- a normal signed-in session is not treated as a recovery grant
- the browser stores only a temporary user-id/expiry recovery marker in tab-local `sessionStorage`; application code never persists recovery/access tokens itself
- while recovery is active, navigation is restricted to the reset/help/logout path
- after password update, recovery state is cleared and Supabase sessions are signed out so the user signs in again

### Signed-in password changes

A normal account password change requires both the existing authenticated session and the current password. UNEEM verifies the current credential through Supabase before updating the password and then attempts to revoke other sessions.

## Identity model

Affiliation proof and Student ID ownership are separate.

### Academic path

A confirmed `@usmba.ac.ma` mailbox proves university affiliation. It does **not** prove ownership of any typed Student ID.

- academic signup may omit Student ID
- confirmed academic email may grant normal sports access
- Student ID verification remains a separate identity action

### Personal-email fallback

Students without the academic mailbox use:

- personal/contact email
- Student ID claim
- private student-card evidence
- manual administrator review

Email confirmation is required, but sports access stays restricted until identity approval.

### Public vs private identity

Public sports identity:
- full name
- unique case-insensitive `@username`
- avatar later when the asset/storage contract exists

Private identity:
- account email
- Student ID
- verification state/reason
- student-card evidence

Only a **verified** Student ID is authoritative and globally unique. Unverified claims do not reserve the ID. Duplicate conflicts route to safe recovery/Help without exposing another account.

### Access moderation is not identity verification

- verification owns Student ID/card approval and remediation reasons
- moderation may suspend/restore an already eligible student
- suspension uses separate `access_restriction_reason`
- moderation never turns a pending personal identity into an approved one
- admin identities are outside routine student moderation

## Application access boundary

`private.has_app_access()` requires both an approved profile and confirmed Auth email.

`private.require_sports_access()` protects match reads/mutations through that same predicate.

`private.is_admin()` requires admin role + approved status + confirmed Auth email.

Layer 021 adds booking-insert and identity-submission guards so recovery sessions or accidental Auth configuration cannot bypass confirmation requirements.

`get_my_account_state()` remains the narrow remediation/status contract; `get_my_session_context()` is the preferred app bootstrap contract.

## Booking model

A booking reserves the **full facility** for the configured slot duration.

- one active/upcoming scheduled booking globally per student
- per-user booking attempts are transactionally serialized
- same-facility overlap is rejected atomically
- facility timezone controls opening/slot alignment
- booking window, frequency and cancellation cutoff are DB-authoritative
- direct student booking writes are closed; RPCs own creation/cancellation
- lifecycle is derived from timestamps; no completion cron

Availability may expose the peer display name, but never another user's booking UUID, Student ID or email.

Authoritative reads:
- `get_pitch_availability()`
- `list_my_bookings()`
- `get_next_booking()`

## Open matches

A match is a social layer on one existing booking and never creates another facility reservation.

- booking owner is organizer and counts as one player
- private booking uses organizer-supplied players
- open match is first-come-first-served for eligible UNEEM students
- reserved/offline friends consume capacity
- spots = capacity - organizer - reserved - joined
- join capacity is serialized in PostgreSQL
- organizer cannot displace joined users or return a populated public match to private
- booking cancellation closes the linked match
- roster/discovery expose public name/username only

## Support and reports

One Help/Reports domain serves guests, students and admins.

- authenticated support/appeal is account-owned
- guest support uses an unguessable capability token; only its digest is stored
- reports require structured target + reason
- direct support writes stay closed; RPCs own mutations
- admin replies/status actions are authorized/audited

Layer 018 provides caller-scoped support summary/detail reads to avoid browser-side aggregation.

## Admin boundary

Operational workspace:
- Bookings
- Facilities
- Users
- Verification
- Help & Reports
- Announcements

High-impact operations are narrow and audited:
- booking cancellation
- facility create/update/archive
- student Suspend/Restore
- identity review
- support moderation/status

Layer 019 closes direct authenticated profile updates. Layer 020 provides a one-time database-owner-only first-admin bootstrap. Layer 021 additionally refuses an unconfirmed bootstrap target and makes the normal admin predicate confirmation-aware.

## Security contract

- RLS remains enabled on user-facing tables
- browser route guards are UX only
- email confirmation is enforced in DB capability predicates, not trusted from frontend state
- students cannot self-promote role/status or mutate another student's booking
- protected identity/access fields are not directly writable
- security-definer functions have fixed search paths and minimal execute grants
- verification evidence stays private
- routine moderation cannot modify admin identities
- first-admin bootstrap is not executable by application/API roles
- recovery sessions cannot exercise sports/admin capabilities before confirmation
- fresh V2 starts only from `supabase/v2`

## Performance contract

- avoid request waterfalls and duplicate session/profile reads
- combine bootstrap authorization state in one RPC
- push lifecycle/narrow aggregation into Postgres
- keep useful content visible during refresh
- update affected local state after safe mutations
- do not cache live availability/mutations as stale PWA truth

## Deployment contract

1. confirm fresh Free Supabase target
2. apply `schema.sql` + layers `002` → `021`
3. execute documented SQL validation phases
4. configure Auth confirmation/Site URL/redirects/templates
5. run advisors + generate hosted DB types
6. configure Vercel with fresh V2 URL + publishable key
7. confirm selected owner email and bootstrap first admin once
8. smoke academic/personal signup, confirmation, login, recovery/reset, signed-in password change, booking, matches, Help/Reports and admin
9. promote only after hard gates pass

See `supabase/v2/README.md` and `docs/v2/migration-plan.md` for exact launch gates.
