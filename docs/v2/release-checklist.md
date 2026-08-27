# UNEEM V2 release checklist

This checklist is the public-launch gate for the current V2 release candidate. A green build alone is not sufficient.

## 1. Source and repository hygiene

- [x] UNEEM is the active product identity in app/PWA assets.
- [x] Canonical V2 database source exists under `supabase/v2/`.
- [x] Deployable `supabase/migrations/` contains the active V2 migration stack through layer 025.
- [x] Legacy V1 booking cron/job and Edge Function runtime is removed from the release tree.
- [x] Guest Help uses the single V2 `guest-support` Supabase Edge Function; no service-role credential is required in Vercel.
- [x] Legacy `/admin/manage-users` implementation is removed; the compatibility route only redirects to `/admin/users`.
- [x] Release-hygiene guard runs in the production build path.
- [x] Legacy UI mock mode is hard-disabled and cannot be enabled from runtime environment variables.

## 2. Database and authorization

Production/free target: Supabase `unem-booking` (`hudjpcrjoryyhpphonsp`).

- [x] Empty V1 tables were removed before V2 installation; no real users/data were present.
- [x] V2 layers 001–024 applied successfully to the selected free project.
- [x] Layer 025 revoked unnecessary anonymous support/timeline reads and added current-advisor FK indexes.
- [x] All application tables have RLS enabled.
- [x] Current Performance Advisor has no ERROR/WARN findings; traffic-free unused-index INFO is expected.
- [x] Adapted production-path security contract passed using the real Auth signup trigger path.
- [x] Integrated booking -> open match -> join -> support privilege smoke passed and rolled back.
- [x] Server guest-creation RPC is service-role-only.
- [x] Capability-token guest read/reply RPCs remain intentionally anonymous.
- [x] Type generation succeeds against the selected project.
- [x] Historical full V2 contract/race stack passed on the earlier canonical V2 validation project; any future behavioral schema change must rerun affected contracts here.

## 3. Supabase Auth production configuration

Live Auth settings verified through GoTrue `/settings` on the selected free project:

- [x] Email provider enabled.
- [x] Signup enabled.
- [x] Anonymous sign-in disabled.
- [x] Email confirmation required (`mailer_autoconfirm=false`).
- [ ] Production Site URL is the intended canonical UNEEM origin.
- [ ] Exact production `/verify-email` redirect URL is allowed.
- [ ] Exact production `/reset-password` redirect URL is allowed.
- [ ] Confirmation template uses the supported Supabase confirmation callback flow.
- [ ] Recovery template returns to `/reset-password`.
- [x] No service-role or database-owner credential is present in browser/VITE variables.

The connected Supabase tooling does not expose Auth dashboard redirect/template mutation, so the unchecked settings above require dashboard verification.

## 4. Production auth email

- [ ] Real signup confirmation reaches a student-controlled address.
- [ ] Real password-recovery email reaches a student-controlled address.
- [ ] Confirmation and recovery links resolve to the intended UNEEM origin and routes.
- [ ] If launch volume exceeds the free/default mailer envelope, configure a UNEEM-controlled SMTP sender instead of weakening confirmation.

## 5. Browser launch smoke

Run `frontend/tests/e2e/public-launch-smoke.spec.ts` against the exact release deployment.

- [ ] Desktop Chrome suite passes.
- [ ] Pixel 5/mobile suite passes.
- [ ] English/LTR suite passes.
- [ ] Arabic/RTL suite passes.
- [ ] Dark-theme restoration passes.
- [ ] No horizontal document overflow.
- [ ] No uncaught page errors.
- [ ] Manifest/favicon/install assets are reachable.
- [ ] Direct reset-password visit fails closed without recovery authority.
- [ ] Malformed verification token remains on safe error path.
- [ ] Real browser guest Help create/resume/reply passes through the deployed Supabase Edge Function.

## 6. Authenticated end-to-end flows

- [ ] Academic signup -> confirmation -> login -> sports access.
- [ ] Academic signup without Student ID works.
- [ ] Personal signup -> confirmation -> card submission -> admin approval -> sports access.
- [ ] Personal confirmation alone does not grant sports access.
- [ ] Login/session restoration routes by authoritative account state.
- [ ] Forgot password -> recovery -> new password -> forced re-login.
- [ ] Expired/reused/forged recovery states fail closed.
- [ ] Signed-in password change requires current password.
- [ ] Booking create/cancel flow works against the selected free project.
- [ ] Open match create/join/leave/roster/capacity flow works.
- [ ] Authenticated Help thread flow works.
- [ ] Admin booking/facility/user/verification/support/announcement flows work.
- [ ] Suspension/restoration and identity-remediation paths remain distinct.

## 7. Deployment and release

- [x] Production browser client is explicitly pinned to the selected free Supabase URL + browser-safe publishable key.
- [x] Canonical `Vercel – uneem` check is green on the free-project release head.
- [x] Legacy `Vercel – booking` remains non-authoritative.
- [ ] Consolidate this branch into the release PR against `dev`.
- [ ] Promote `dev` and verify the final production deployment.
- [ ] Create the first real user, then bootstrap exactly one first admin through the database-owner-only bootstrap function.
- [ ] Create real facilities through the admin UI; do not seed guessed production facilities.

## Stop conditions

Do not call email/auth flows production-complete when Site URL/redirect/template configuration is unknown. Do not expose service-role, SMTP, or database-owner credentials to browser code or Git. Any real authorization/database regression remains release-blocking.
