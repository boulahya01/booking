**Project Overview**

This repository contains the Booking application — a small web app and serverless functions that manage pitch bookings, scheduling, and background jobs. It includes a frontend (`frontend/`) and Supabase functions/migrations (`supabase/`).

**Quick Start**

- **Install deps:**

  Run in project root (uses npm/pnpm/yarn as you prefer):

  ```bash
  npm install
  ```

- **Frontend development:**

  ```bash
  cd frontend
  npm install
  npm run dev
  ```

- **Local functions / Supabase:**

  Use the `supabase` folder for functions and migrations. Provide credentials in a local `.env.local` (gitignored).

**Environment**

- Sensitive values (API keys, DB passwords, tokens) must stay in local env files. The project ignores `.env.local` and similar files — do NOT commit secrets.

Add required variables using the provided examples `.env.example` and `.env.cron.example`.

**Running Tests & Scripts**

- Use the `test_*.js` helpers for local checks. Ensure the appropriate environment variables are set before running.

**Cleaning & Local Dev**

- To free disk space locally, you can remove `node_modules/` or frontend build outputs — these are ignored by git and are safe to reinstall with `npm install`.

**Contributing**

- Keep commits focused and describe changes. Avoid committing secrets or large build artifacts. If you add documentation, prefer concise docs in `docs/`.

**Contact**

- For questions, open an issue in this repo.

---

_README created: keep this file clear and minimal for public viewing._
