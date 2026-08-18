# UNEEM V2 release checklist

This checklist is the public-launch gate for the current V2 release candidate. A green build alone is not sufficient.

## 1. Source and repository hygiene

- [x] UNEEM is the active product identity in app/PWA assets.
- [x] Canonical V2 database source exists under `supabase/v2/`.
- [x] Deployable `supabase/migrations/` contains only the hosted V2 migration versions.
- [x] Legacy V1 booking cron/job and Edge Function runtime is removed from the release tree.
- [x] Legacy `/admin/manage-users` implementation is removed; the compatibility route only redirects to `/admin/users`.
- [x] Release-hygiene guard runs in CI.
- [x] Legacy UI mock mode is hard-disabled and cannot be enabled from runtime environment variables.
- [ ] Review remaining old naming/dead helpers and remove only when usage is proven absent.

## 2. Database and authorization

- [x] V2 layers 001–024 applied to the fresh hosted Supabase project.
- [x] Auth lifecycle contract passed.
- [x] Guest support IP-gate contract passed.
- [x] Advisor hardening contract passed.
- [x] Booking contract passed.
- [x] Security/identity/support/match/admin/backend-read/moderation/first-admin final-schema suites passed after required fixture corrections.
- [x] Multi-session concurrency gate passed for one-active booking, same-slot exclusion and last-match-spot capacity.
- [x] Full-schema lint returned no schema errors after layer 024.
- [x] Performance Advisor reached 0 errors / 0 warnings.
- [ ] If any schema/RLS/RPC migration changes after this checkpoint, rerun every affected contract and advisor gate.

## 3. Supabase Auth production configuration

- [ ] Email + Password enabled.
- [ ] Confirm Email enabled.
- [ ] Anonymous sign-in disabled.
- [ ] Production Site URL is `https://uneem.site`.
- [ ] Exact production verification/recovery redirect URLs are allowed.
- [ ] Exact preview origin used for launch validation is allowed; no broad production wildcard.
- [ ] Confirmation template uses the supported Supabase confirmation callback flow.
- [ ] Recovery template returns to `/reset-password`.
- [ ] No service-role or database-owner credential is present in browser/VITE variables.

## 4. Production auth email

- [ ] Custom SMTP configured with a UNEEM-controlled sender/domain.
- [ ] SPF passes.
- [ ] DKIM passes.
- [ ] DMARC posture reviewed.
- [ ] Click/open tracking disabled for auth mail.
- [ ] Real signup confirmation reaches a non-team student address.
- [ ] Real password-recovery email reaches a non-team student address.
- [ ] Confirmation and recovery links resolve to the intended UNEEM origin and routes.

## 5. Browser launch smoke

Run `frontend/tests/e2e/public-launch-smoke.spec.ts` against the exact release preview.

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
- [ ] Guest Help rejects non-JSON and oversized anonymous bodies before DB execution.

## 6. Authenticated end-to-end flows

- [ ] Academic signup -> confirmation -> login -> sports access.
- [ ] Academic signup without Student ID works.
- [ ] Personal signup -> confirmation -> card submission -> admin approval -> sports access.
- [ ] Personal confirmation alone does not grant sports access.
- [ ] Login/session restoration routes by authoritative account state.
- [ ] Forgot password -> recovery -> new password -> forced re-login.
- [ ] Expired/reused/forged recovery states fail closed.
- [ ] Signed-in password change requires current password.
- [ ] Booking create/cancel flow works against hosted V2.
- [ ] Open match create/join/leave/roster/capacity flow works.
- [ ] Authenticated Help thread flow works.
- [ ] Guest Help create/resume/reply works without exposing server secrets.
- [ ] Admin booking/facility/user/verification/support/announcement flows work.
- [ ] Suspension/restoration and identity-remediation paths remain distinct.

## 7. Deployment and release

- [ ] Canonical `Vercel – uneem` check is green on the exact release head.
- [ ] No release-blocking runtime error groups appear after smoke traffic.
- [ ] GitHub PR stack is consolidated into one release PR against `dev` or merged in verified dependency order.
- [ ] Final release PR is non-draft only after all hard gates above are satisfied.
- [ ] Release merge uses normal GitHub history; no force-push/history rewrite.
- [ ] Production promotion occurs only after exact-head validation.

## Stop conditions

Do not release when any of these are true:

- production confirmation/recovery email delivery is unverified;
- Auth Site URL/redirect/template configuration is unknown;
- an authorization/database regression is unresolved;
- a release-head build/smoke has not been executed;
- service-role/SMTP/database-owner credentials are exposed to browser code or Git;
- the canonical deployment is red for a real code/runtime failure.
