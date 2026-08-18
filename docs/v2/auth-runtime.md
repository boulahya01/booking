# UNEEM V2 Supabase Auth Runtime Contract

This document is operational configuration for the fresh V2 Supabase project. The application code assumes these settings; launch validation must verify them directly in the target project.

## Required Auth behavior

- Email/password provider enabled.
- Confirm Email enabled.
- Anonymous sign-ins disabled.
- New-user signup enabled only when launch registration is intentionally open.
- Application auth flow uses Supabase PKCE.
- Academic-email confirmation proves affiliation only; it does not verify Student ID ownership.
- Personal-email accounts remain restricted by the PostgreSQL identity/access contract until student-card verification is approved.

## Site URL and redirect allow-list

Production Site URL:

`https://uneem.site`

Allowed redirect origins/paths must include the exact deployed origins used for:

- `https://uneem.site/verify-email`
- `https://uneem.site/reset-password`
- the canonical Vercel preview origin used for pre-production smoke testing
- `http://localhost:5173/verify-email` and `http://localhost:5173/reset-password` for local development only

Do not use wildcard production redirects broader than necessary.

## Confirmation email template

The confirmation flow must return to UNEEM with a token hash or PKCE code that the application can exchange for a real session.

Preferred Confirm signup link:

`{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email`

The application also accepts Supabase PKCE `code` callbacks and legacy URL-session fragments during migration, but token-hash/PKCE is the target contract.

The signup request supplies `emailRedirectTo=/verify-email?email=...`, preserving a non-sensitive email hint for resend/sign-in UX.

## Password recovery template

`resetPasswordForEmail()` sends the user to `/reset-password` through the configured application origin.

The reset page does not trust route access alone. It must complete a Supabase recovery flow and obtain a real recovery session before enabling password update. Direct visits or expired/invalid links are rejected and routed back to request a fresh link.

After a successful password update, the temporary local recovery session is signed out and the user signs in again with the new password.

## Runtime environment

Required Vercel variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` preferred; legacy `VITE_SUPABASE_ANON_KEY` is accepted only as a compatibility fallback
- `VITE_APP_URL=https://uneem.site` for production

Never expose service-role or database-owner credentials to Vite/browser environment variables.

## Launch smoke tests

Academic path:
1. Sign up with a new `@usmba.ac.ma` address and no Student ID.
2. Confirm the email from the received link.
3. Verify a Supabase session is created and `get_my_session_context()` resolves exactly one profile.
4. Verify academic confirmation grants sports access according to the DB contract.
5. Sign out and sign in with the password.

Personal path:
1. Sign up with personal email + Student ID claim.
2. Confirm email.
3. Verify the account remains restricted from sports.
4. Submit student-card verification and approve through the admin workflow.
5. Verify the same Auth account becomes eligible without creating a duplicate user.

Recovery:
1. Request reset for an existing account.
2. Verify response remains non-enumerating.
3. Open the recovery email link and confirm `/reset-password` accepts it only after session exchange.
4. Change password and verify the recovery session is closed.
5. Verify old password fails and new password succeeds.
6. Verify an expired/reused recovery link is rejected.

Negative tests:
- direct `/reset-password` visit without recovery session cannot change password
- malformed/expired confirmation link cannot create a usable session
- wrong email/password and nonexistent account converge on safe login messaging
- recovery request does not reveal whether an email exists
- rate-limited resend/recovery requests return a retry message without account enumeration

## Hosted verification gate

Before merge/production, verify in the actual fresh Supabase project:

- Auth provider/configuration matches this document
- redirect allow-list is exact
- email templates generate the expected callback shape
- Auth logs show successful signup confirmation and password recovery
- PostgreSQL trigger/profile state matches the Auth confirmation event
- no duplicate profile is created for retries
- security/performance advisors are reviewed after the full V2 schema is applied
