# UNEEM V2 release checklist

This checklist is the public-launch gate for the current V2 release candidate. A green build alone is not sufficient.

## Current audit checkpoint - 2026-10-11

UNEEM already has live users. The production system must remain protected while validating this uncommitted update. See [speed and release audit](speed-audit-2026-10-11.md) for methods, results and limitations. Earlier checked items below are historical evidence, not current production approval.

- [x] Production build, release hygiene and Svelte checks pass with zero errors/warnings.
- [x] All 114 production-preview browser regressions pass on desktop Chromium and Pixel 5 with fictional intercepted backend responses, including English/Arabic and cooldown users joining open matches.
- [x] Cold-load speed measured on nine representative routes: Home mobile median LCP 2.46s, match details 2.63s, organizer management 2.62s. No overflow or uncaught errors in the 36 samples.
- [x] Public live landing and database metadata/advisors checked read-only. No production test accounts, bookings, emails or schema changes were made.
- [x] Live-user protection is recorded in `AGENTS.md`.
- [x] Dependency findings resolved with targeted compatible updates; production dependency audit is now zero and all 114 browser regressions pass again.
- [ ] Improve mobile match-details/management cold-load performance and give Home more margin.
- [x] Migration `20261011002159`, match contract, both cancellation/join race orders, and rollback/reapply passed in isolated PostgreSQL. The user authorized production release; the owner cancellation guard was applied and verified read-only.
- [ ] Review the two missing reservation foreign-key indexes and leaked-password protection configuration; review advisor permission warnings against intended access controls.
- [x] Release commit `5cbc820b7ada124e341e678baf77d737358ebc14` is live on the canonical domain. All 52 public desktop/mobile English/Arabic smoke checks pass; published icon/torch binaries and normalized manifest/SVG content match the candidate.
- [ ] Verify PWA install/update and OS icon replacement on a real mobile device; authenticated hosted mutation flows remain separately scoped checks.

The user reports recovery works on the live website and requested stopping recovery testing. Do not repeat email/account mutations as part of this audit. Other unchecked historical auth and authenticated release gates below remain unverified unless separately evidenced.

## Local candidate checkpoint - 2026-10-10

This checkpoint covers the uncommitted local candidate. Earlier checked database items below record historical validation and do not establish a fresh end-to-end pass for this candidate.

- [x] Canonical npm lockfile installation, production build, and Svelte checks pass.
- [x] Full production-build regression suite: 96 passing tests across desktop Chrome and Pixel 5, including English/Arabic, auth boundaries, and notification rollback.
- [x] Home retains a stable booking-card height when loading resolves to no booking; both viewport regression tests pass.
- [x] Approved monogram 01 is installed in PWA, maskable, Apple touch, favicon, and launch assets. Asset hashes match the approved exports.
- [x] Original torch and calligraphy are preserved in the Menu About placement. Lossless WebP conversion preserves every RGBA pixel; desktop/mobile checks show no overflow or page errors.
- [x] Browser Supabase configuration comes from deployment or ignored local environment files. Versioned examples use placeholders; CI uses fictional backend configuration.
- [x] Cold-load mobile lab: median landing LCP 2.18s and Home LCP 2.14s across three samples each; launch LCP 2.18s. Home CLS is zero in all three samples (previously about 0.111).
- [x] After database restoration, live signup and recovery requests returned HTTP 200 through the app and displayed the expected email-check screen. Public Auth settings require confirmation, enable email/Google, and disable anonymous sign-in. These responses do not prove inbox delivery or callback completion.
- [ ] Verify the exact hosted candidate, real email receipt, callback routing, and authenticated production flows before public release.

Performance measurements use a local production preview, mocked backend, disabled HTTP cache and service workers, Pixel 5 viewport, 4x CPU slowdown, 1.6 Mbps download, and 150ms latency. They do not establish real database latency, load capacity, or field INP. The selected hosted database was found inactive during live auth testing; restoration was requested and Auth became responsive for the successful retry. Inbox delivery and callback completion remain pending.

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

Production target: the Supabase project selected in the deployment environment. Keep its reference and browser key in the provider or ignored local environment files.

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

The connected Supabase tooling does not expose Auth dashboard redirect/template mutation. Those five unchecked Auth dashboard items are the remaining manual configuration handoff; they are not silently assumed complete.

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

- [x] Browser configuration is read from environment variables; source and example files contain no project reference or actual key.
- [ ] Confirm `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in both preview and production before building the release candidate.
- [x] Canonical `Vercel – uneem` check is green on the free-project release head.
- [x] Legacy `Vercel – booking` remains non-authoritative.
- [x] V2 release branch is being consolidated into the final PR against `dev`.
- [ ] Promote `dev` and verify the final production deployment.
- [x] Create the first real user, then bootstrap exactly one first admin through the database-owner-only bootstrap function.
- [ ] Create real facilities through the admin UI; do not seed guessed production facilities.

## Stop conditions

Do not call email/auth flows production-complete when Site URL/redirect/template configuration is unknown. Do not expose service-role, SMTP, or database-owner credentials to browser code or Git. Any real authorization/database regression remains release-blocking.
