Starter instructions: SvelteKit + Skeleton + security-first

Quick setup (run in this folder):

```bash
# 1) scaffold SvelteKit app interactively (choose TypeScript + Skeleton-targeted options)
npm create svelte@latest .

# 2) install dependencies
npm install

# 3) add Skeleton UI & Tailwind (example)
npm install -D @skeletonlabs/skeleton tailwindcss postcss autoprefixer
npx tailwindcss init -p

# 4) run dev server
npm run dev -- --open
```

Security-first checklist (do these immediately after scaffolding):
- Add `.env.local` to store secrets locally and DO NOT commit it.
- Run an audit and remove any committed secrets (see repository root `.env.example`).
- Install `zod`, `dompurify`, `isomorphic-dompurify` for validation/sanitization.
- Add CSP and security headers via adapter or hosting config (Vercel headers or server middleware).

Notes:
- I created `TODO.md` in this folder with the full action list. Reply with which immediate action you'd like me to run next and I'll proceed (scaffold project, add validation to edge functions, or redact secrets).