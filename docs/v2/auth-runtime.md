# UNEEM V2 Supabase Auth Runtime Contract

This document is the operational Auth contract for the fresh V2 Supabase project. Non-secret settings and the two launch email templates are versioned in this repository. Hosted launch validation must still verify the applied project state and real email delivery directly.

## Required Auth behavior

- Email/password provider enabled.
- Confirm Email enabled.
- Anonymous sign-ins disabled.
- SMS signup disabled for launch.
- New-user signup enabled only while launch registration is intentionally open.
- Application auth flow uses Supabase PKCE.
- Academic-email confirmation proves affiliation only; it does not verify Student ID ownership.
- Personal-email accounts remain restricted by the PostgreSQL identity/access contract until student-card verification is approved.

## Configuration as code

`supabase/config.toml` is the reviewable source for non-secret Auth configuration. It defines the production Site URL, redirect allow-list, confirmation requirement, email request frequency, email template files, and email-only signup surface.

From a linked checkout of the exact release branch, apply the reviewed configuration with:

```bash
supabase config push --project-ref bjofwkuazyvguqankcnl
```

A successful command is evidence that the CLI accepted and pushed the local configuration; it is not by itself evidence that confirmation/recovery delivery works. Verify the hosted Auth settings and execute the email flows after every material Auth configuration change.

SMTP host/user/password are secrets and must not be committed to `config.toml`. Configure the production sender through Supabase Auth using the provider credentials kept outside Git.

## Site URL and redirect allow-list

Production Site URL:

`https://uneem.site`

Allowed redirects are intentionally narrow:

- `https://uneem.site/verify-email`
- `https://uneem.site/reset-password`
- `https://*-marwaneboulahya-5125s-projects.vercel.app/**` for canonical Vercel preview validation
- `http://localhost:5173/verify-email` for local development
- `http://localhost:5173/reset-password` for local development

Do not replace the production entries with a broad domain wildcard.

The application sends an exact `/verify-email` provider redirect. The signup page separately preserves the non-sensitive email hint in its own navigation, so the provider allow-list does not need a dynamic `?email=...` redirect.

## Confirmation email template

Canonical source:

`supabase/templates/confirmation.html`

The confirmation email sends the token hash directly to the exact UNEEM callback:

```text
{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email
```

`/verify-email` calls Supabase `verifyOtp()` and then restores the authoritative `get_my_session_context()` payload before presenting success. A malformed, expired, or wrong-flow token must not create a usable application session.

The client also accepts a Supabase PKCE `code` callback and legacy URL-session fragments for compatibility, but token-hash/PKCE is the target contract.

## Password recovery template

Canonical source:

`supabase/templates/recovery.html`

The recovery email deliberately uses Supabase's generated `{{ .ConfirmationURL }}`. `resetPasswordForEmail()` supplies the exact `/reset-password` redirect, and only a genuine `PASSWORD_RECOVERY` Auth event may create local recovery continuity.

The reset page does not trust route access, query markers, hash markers, or sessionStorage alone. Before password mutation it requires a real Supabase session and verifies signed JWT claims for the matching user with a `recovery` authentication-method reference. After a successful password update the recovery state is cleared and the session is closed so the user signs in again.

## Runtime environment

Required Vercel variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` preferred; legacy `VITE_SUPABASE_ANON_KEY` is accepted only as a compatibility fallback
- `VITE_APP_URL=https://uneem.site` for production

Never expose service-role, secret-key, database-owner, SMTP, or Management API credentials to Vite/browser environment variables.

## Production email transport

The built-in Supabase sender is development-only and is not the UNEEM launch transport. Before launch configure a UNEEM-controlled custom SMTP sender, verify its domain authentication, disable provider link tracking/rewriting, and test delivery to real non-team addresses.

Target sender identity remains:

`UNEEM <no-reply@auth.uneem.site>`

If the final provider requires a different verified sender during setup, do not silently change the product contract; record and review the exact sender used for launch testing.

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
3. Open the recovery email link and confirm `/reset-password` accepts it only after a genuine recovery session is established.
4. Change password and verify the recovery session is closed.
5. Verify old password fails and new password succeeds.
6. Verify an expired/reused recovery link is rejected.

Negative tests:
- direct `/reset-password` visit without recovery authority cannot change password
- malformed/expired confirmation link cannot create a usable session
- wrong email/password and nonexistent account converge on safe login messaging
- recovery request does not reveal whether an email exists
- rate-limited resend/recovery requests return retry-safe messaging without account enumeration

## Hosted verification gate

Before merge/production, verify in the actual fresh Supabase project:

- Auth provider/configuration matches `supabase/config.toml`
- production Site URL and redirect allow-list are exact
- hosted confirmation/recovery templates match the committed files
- real confirmation and recovery messages arrive through the configured production sender
- Auth logs show successful signup confirmation and password recovery
- PostgreSQL trigger/profile state matches the Auth confirmation event
- retries do not create duplicate profiles
- the full public and authenticated E2E launch suite passes on the exact release head
