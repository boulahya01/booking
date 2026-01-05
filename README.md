
# Booking (Project)

A concise, public-facing README for the Booking application. This repository contains:

- A web frontend ([`frontend/`](frontend/)) built with Vite + React/TypeScript.
- Serverless functions and database migrations under [`supabase/`](supabase/).
- Utility scripts and tests in the project root.

---

## Quick Start

1. Clone the repo:

```bash
git clone https://github.com/<your-org-or-user>/booking.git
cd booking
```

2. Install root deps and frontend deps (choose your package manager):

```bash
npm install
cd frontend
npm install
```

3. Run frontend locally:

```bash
npm run dev
```

4. Use the `supabase/` folder for running migrations and local functions. Keep secrets in `.env.local` (gitignored).

---

## Required Environment Variables (examples)

Place sensitive values in `.env.local` (DO NOT commit):

```env
# Frontend / public
VITE_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
VITE_PUBLIC_SUPABASE_ANON_KEY=REPLACE_WITH_ANON_KEY

# Server / admin (service role) - keep secret
SUPABASE_SERVICE_ROLE_KEY=REPLACE_WITH_SERVICE_ROLE_KEY
POSTGRES_URL=postgres://user:password@host:port/database
CRON_SECRET=REPLACE_WITH_SECURE_RANDOM
```

Refer to `.env.example` and `.env.cron.example` for template variables.

---

## Project Structure

Top-level layout (important folders):

```
booking/
├─ frontend/                # React + Vite app
├─ supabase/                # Functions, migrations, local config
├─ api/                     # Additional API utilities
├─ docs/                    # Optional docs (kept minimal)
├─ test_*.js                # Local test helpers
├─ verify-security.sh       # Pre-push security checks
└─ README.md                # This file
```

---

## Useful Commands

- Install dependencies: `npm install`
- Run frontend: `cd frontend && npm run dev`
- Run tests / checks: `node test_booking_jobs_trigger.js` (ensure env set)
- Verify security before push: `bash verify-security.sh`

---

## Notes for Contributors

- Do not commit `.env*` files or secrets. They are ignored by git.
- Keep commits small and descriptive. Use one commit per logical change.
- If you need to add documentation, prefer small targeted files or `docs/`.

---

_If you'd like badges, examples, or a short demo screenshot added here, tell me what to include and I will update the README._

