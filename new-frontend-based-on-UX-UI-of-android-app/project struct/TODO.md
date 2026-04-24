# TODO: Svelte Web Frontend Implementation (from Android UX)

This file is a condensed, actionable checklist extracted from the project plan (`plan-webFrontend.prompt.md`). The repository owner asked to prioritize frontend work first — backend and edge-function changes are deferred to the end.

## Phase 1 — Foundation Setup (start here)
- [ ] Initialize SvelteKit project in this folder
- [ ] Install Skeleton UI + Tailwind + related tooling
- [ ] Configure TypeScript strict mode and Tailwind theme
- [ ] Create `src/lib/supabaseClient.ts` and `src/lib/stores/auth.ts`
- [ ] Add CSRF token support for mutation requests (frontend integration)
- [ ] Add dependency security scanning (Dependabot) and pre-commit hooks

## Phase 2 — Authentication
- [ ] Implement auth pages: login, register, verify email, forgot/reset password
- [ ] Implement `lib/auth.ts` wrappers for Supabase / edge functions
- [ ] Store sessions securely (httpOnly cookies) and clear on logout

## Phase 3 — Layout & Navigation
- [ ] Create global layout: `+layout.svelte` with responsive bottom nav and sidebar
- [ ] Implement `TopBar`, `BottomNav`, `Sidebar`, `Toast` components

## Phase 4 — Core Pages & Booking Flow
- [ ] Home: list pitches, next booking card
- [ ] Pitch details: integrate `available-slots` edge function (call only; leave edge changes for later)
- [ ] Bookings: list, cancel, optimistic updates

## Phase 5 — Admin
- [ ] Admin user approvals: approve/reject with reason
- [ ] Admin pitch CRUD
- [ ] Admin user role management

## Phase 6 — Validation, API & Types (frontend)
- [ ] Create shared `zod` schemas (requests & responses) for frontend validation
- [ ] Build `src/lib/api.ts` wrapper with rate-limited fetch and schema validation
- [ ] Reuse types from `old-bad-frontend/src/types` where applicable

## Phase 7 — Testing & CI
- [ ] Add Vitest unit tests for validation & helpers
- [ ] Add Playwright E2E tests for auth + booking critical path
- [ ] Add CI pipeline to run tests and security scans

## Phase 8 — Deployment
- [ ] Configure Vercel environment variables (do NOT commit secrets)
- [ ] Setup build & deploy workflow
- [ ] Run security audit and finalize docs

---

## Phase 9 — Backend & Edge Functions (deferred)
> These items are intentionally moved to the end so frontend implementation can proceed first. We will address these after the initial frontend scaffold and critical flows are complete.

- [ ] Add server-side input validation for all edge functions (`zod` schemas)
- [ ] Implement server-side rate limiting for edge functions (Upstash/Redis)
- [ ] Sanitize all user inputs and user-generated HTML on the server (use `dompurify` where rendering is needed)
- [ ] Enforce CSP, HSTS, X-Frame-Options, Referrer-Policy headers (server config)
- [ ] Audit repository for committed secrets; remove, rotate keys, add pre-commit secret checks
- [ ] Standardize error responses (no internal stack traces to clients)

---

## Immediate Next Actions (pick one)
1. Initialize SvelteKit project in this folder (I can run the scaffold commands).
2. I will create a minimal frontend starter (package.json, supabase client, auth store, basic routes) — I can commit those files now.
3. Hold and proceed only after you confirm the scaffold approach.

Reply with `1`, `2`, or `3` (or multiple) to proceed.