
# Booking System

A concise, public-facing README for the Booking application. This repository contains:

- A web frontend ([`frontend/`](frontend/)) built with Vite + React/TypeScript.
- Serverless functions and database migrations under [`supabase/`](supabase/).
- Utility scripts and tests in the project root.

---

<div align="center">

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)

</div>

## Quick Start

1. Clone the repo:

```bash
git clone https://github.com/boulahya01/booking.git
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
# ⚙️ Booking — Pitch Booking System

This repository contains the Booking application: a system to manage bookings for pitches (sports facilities). It includes a web frontend, serverless functions, database migrations, background jobs, and utilities for local development and deployment.

Key capabilities:
- Create and manage bookings
- List available slots and opening hours
- Background processing of booking jobs and completions
- Role-based access via Supabase and RLS (Row Level Security)

---

## ⚙️ Technology Stack
- Frontend: Vite, React, TypeScript
- Backend / Auth: Supabase (Postgres, RLS, Functions)
- Serverless functions: Supabase functions (Deno) and Node utilities
- Database migrations: SQL files in `migrations/`
- CI / deployment helpers: `vercel.json`, `deploy_function.sh`

---

## Quick Start (developer)
1. Clone the repository:

```bash
git clone https://github.com/boulahya01/booking.git
cd booking
```

2. Install dependencies (root + frontend):

```bash
npm install
cd frontend
npm install
```

3. Run frontend locally:

```bash
cd frontend
npm run dev
```

4. Database & functions:
- Use the `supabase/` folder for local functions and configuration. Migrations live in `migrations/`.
- Apply migrations and manage the database with your Supabase CLI or preferred workflow (this repo includes SQL migration files).

5. Keep secrets local:
- Add sensitive variables to `.env.local` (this file is gitignored). See `.env.example` and `.env.cron.example` for templates.

---

## Environment variables (examples)
Store real values only in `.env.local`:

```env
# Frontend (public)
VITE_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
VITE_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY

# Server / admin (keep secret)
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
POSTGRES_URL=postgres://user:password@host:port/database
CRON_SECRET=secure-random-value
```

---

## 📁 Project layout

Top-level folders to know:

```
frontend/      # React + Vite app
supabase/      # Supabase functions, config, and local dev files
functions/     # Serverless functions used by the app
migrations/    # SQL migrations
api/           # API helpers and cron scripts
```

---

## Useful scripts & checks
- Install deps: `npm install`
- Run frontend: `cd frontend && npm run dev`
- Verify security (pre-push): `bash verify-security.sh`
- Run local tests / helpers: `node test_booking_jobs_trigger.js` (ensure env set)

---

## Security notes
- Never commit `.env.local` or any file containing secrets.
- `verify-security.sh` is provided to help detect accidental secrets in staged changes.
- If any credential is exposed publicly, rotate the key immediately (Supabase, Postgres, third-party APIs).

---

## Contributing
- Keep changes small and focused.
- Document feature choices in small files in `docs/` if needed.

---




