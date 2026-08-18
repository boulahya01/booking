# UNEEM

UNEEM is a mobile-first university sports booking and community PWA for Université Sidi Mohamed Ben Abdellah (USMBA).

Students can discover facilities, reserve a whole facility slot, join open matches, manage their sports activity, and contact Help. Administrators manage facilities, bookings, student access, identity verification, support/reports, and announcements.

## Release status

UNEEM V2 is in release-candidate validation. The database/RLS contract stack through layer 024 has been applied to the fresh hosted Supabase project and the committed contract/race suites have been validated. Public launch still requires production Auth configuration/email delivery and the final browser end-to-end smoke gate.

Do not treat a successful frontend build as proof that hosted Auth or email delivery is production-ready.

## Architecture

- **Frontend:** SvelteKit 2 / Svelte 5 / TypeScript / Tailwind CSS
- **Backend:** Supabase Auth + PostgreSQL + Storage
- **Authorization:** PostgreSQL RLS and narrow RPC contracts
- **Hosting:** Vercel
- **Tests:** SQL contract suites + multi-session concurrency harness + Playwright launch smoke
- **Languages:** English and Arabic with RTL support

The canonical database source is `supabase/v2/`. The deployable Supabase migration history in `supabase/migrations/` mirrors the already-applied hosted V2 migration versions. Historical V1 migrations, cron workers, and Edge Functions are not part of the release runtime.

## Product invariants

- A confirmed `@usmba.ac.ma` email proves university affiliation; it does not prove Student ID ownership.
- Academic-email students may use sports after real email confirmation without a Student ID.
- Personal-email students require Student ID/card review before sports access.
- Student ID and email are private identity data; public identity is full name + username.
- One student may have only one active/upcoming facility booking globally.
- One booking reserves the whole facility. Match participation never creates another booking.
- Open-match joining is first-come-first-served and database-serialized.
- Booking, match, moderation, verification, support, and admin authority lives in PostgreSQL/RPC contracts, not UI state.

See `docs/v2/architecture.md` and `supabase/v2/README.md` for the detailed contracts.

## Local development

Requirements:

- Node.js 22
- npm
- Supabase CLI when working on database contracts

Install and run:

```bash
npm install
cd frontend
npm ci
npm run dev
```

Or from the repository root:

```bash
npm run dev
```

## Environment

Browser-safe variables:

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
VITE_APP_URL=http://localhost:5173
```

Server-only variables used by the guest Help boundary:

```env
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
SUPPORT_IP_HASH_SECRET=...
```

Never place service-role credentials or other secrets in `VITE_*` variables. See `frontend/.env.example`.

## Database

The authoritative V2 source order is:

1. `supabase/v2/schema.sql`
2. layers `002` through `024` in numeric order

For normal Supabase CLI migration operations, use the matching timestamped files under `supabase/migrations/`. Do not add V1 migrations or booking-completion cron/job infrastructure back into that directory.

The current database lifecycle derives booking state from timestamps; there is no booking-completion cron.

## Validation

Frontend checks:

```bash
npm run check
npm run build
npm run release:hygiene
```

Playwright public launch smoke:

```bash
cd frontend
npm run test:e2e
```

For an exact Vercel preview:

```powershell
$env:PLAYWRIGHT_BASE_URL = "https://<exact-preview>.vercel.app"
$env:PLAYWRIGHT_VERCEL_SHARE_URL = "https://<exact-preview>.vercel.app/?_vercel_share=<temporary-token>"
npm run test:e2e
```

Do not commit preview-share tokens.

Database contract suites live in `supabase/v2/tests/`. The multi-session race gate is `supabase/v2/tests/concurrency_contract.ps1`.

## Release gate

Before public launch, all items in `docs/v2/release-checklist.md` must be satisfied. In particular:

- exact release-head frontend build/checks
- production Supabase Auth Site URL + redirect/template configuration
- real confirmation and recovery email delivery through a UNEEM-controlled sender
- academic and personal identity flows end-to-end
- booking/match/Help/admin/moderation/recovery browser smokes
- no unresolved security or database-advisor launch blockers

## Repository policy

- `dev` is the integration/release target.
- Keep release changes small and reviewable; do not rewrite public history or force-push.
- Never weaken an authorization invariant merely to make a test pass.
- Never commit tokens, service-role keys, SMTP credentials, private student-card evidence, or user data.
- Historical V1 code remains available in Git history and must not be reintroduced into the active release tree.

## License

MIT — see [LICENSE](LICENSE).
