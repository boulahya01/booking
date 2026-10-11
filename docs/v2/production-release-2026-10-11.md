# UNEEM production release — 2026-10-11

This release contains the approved monogram launcher icons, original torch in About, simpler Home and open-match screens, booking cooldown explanations, organizer management refinements, and the audited authentication/loading runtime changes.

## Validation completed before publication

- Production build and release hygiene passed; Svelte reported zero errors and warnings.
- All 114 desktop Chromium/Pixel 5 browser tests passed after dependency updates, including Arabic, auth routing, loading/error states, booking cooldown users joining open matches, and owner cancellation protections. Backend mutations used intercepted fictional fixtures.
- `npm audit --omit=dev` reports zero findings. The lockfile now resolves Svelte 5.57.2, devalue 5.9.4, DOMPurify 3.4.16 and ws 8.22.0. SvelteKit 2.70.3, Vite 8.3.4, PostCSS and archive/build utilities were also updated within their existing major versions. The nested svelte-i18n esbuild and SvelteKit cookie dependencies use tested overrides.
- The full audit including development tools retains seven affected package entries (five high, two moderate): Tailwind 3's braces/glob/watch dependency chain and its PostCSS selector parser. These paths process repository-controlled patterns/CSS at build time, are not application imports, and no matching package files appear in the 264-file generated Vercel function artifact. This is a scoped applicability review, not a claim that the advisories are fixed. Migrating Tailwind across a major version during publication is deferred to a separately tested toolchain update.
- The complete repository migration stack through layer 063 applied successfully in isolated local PostgreSQL 18 with minimal Auth/Storage interfaces. The match contract, concurrent join-first/cancel-second case, concurrent cancel-first/join-second case, and function rollback/reapply all passed using fictional records. These tests validate PostgreSQL behavior; they are not a hosted Auth/Storage end-to-end certification.
- The owner-cancellation guard was applied to production after those checks. Read-only verification confirms the guard exists, anonymous execution remains denied and authenticated execution remains allowed. Only the function/permissions changed; no live records were reset, reseeded or used as test fixtures.
- The prior production function was saved as an operational rollback outside versioned source. Frontend rollback should use the previous ready deployment; reverting the database guard is a separate deliberate operation.

## Follow-up work

The original [speed audit](speed-audit-2026-10-11.md) remains a baseline measurement from before these dependency updates. Mobile match-details performance, the lossless About torch's bandwidth, reservation foreign-key indexes and provider leaked-password protection remain improvement/review items. They are not claimed fixed by this release.

No real signup/recovery emails, live user fixture mutations or real-device installation tests were performed during publication. Recovery testing remains stopped at the user's request.

## Published and verified

- PR 115 merged into `dev`. Published source commit: `5cbc820b7ada124e341e678baf77d737358ebc14`; its source tree exactly matches the tested release branch.
- GitHub CI passed the fresh lockfile installation, release hygiene, type checks, production build and browser regressions. The canonical UNEEM Vercel check passed. The legacy unrelated booking-project check remains non-authoritative.
- Vercel's production deployment reached READY and assigned [the canonical website](https://www.uneem.site/) to that commit.
- All 52 live public smoke checks passed in English/Arabic on desktop Chromium and Pixel 5. Registration conflict coverage used intercepted fictional responses, and malformed-token tests fail before contacting Auth. No real signup/recovery mutation was performed.
- Published PWA, maskable and Apple PNGs and the lossless original torch match the candidate byte-for-byte. Favicon/monogram SVGs match after line-ending normalization; parsed manifest content matches. All eight asset requests returned HTTP 200.
- A separate fresh-browser check of landing, login, privacy, terms and launch recorded zero page errors, overflow and production mutation attempts. Anonymous launch correctly resolves to login.
- Real-device PWA installation, OS icon refresh and authenticated hosted mutation flows remain separate checks. Baseline speed improvements and the scoped build-tool dependency follow-ups above are not claimed complete.

## Follow-up: hosted authentication configuration

The initial public smoke checks did not assert that the real provider settings request succeeded. A subsequent live login inspection found that the hosting browser configuration still referenced an unreachable former backend. The login silently removed Google sign-in when that request failed, so a successful page render did not prove Auth connectivity. The deployment configuration was corrected to the active backend and its public browser key, and the same application source was rebuilt. A fresh live read then confirmed HTTP 200, Google enabled, the visible Google button and no connection errors. No account was created or signed in during that check.

The follow-up patch distinguishes unavailable settings from a confirmed disabled provider, keeps a retryable Google action during a connection failure, and adds an explicit read-only production Auth test plus a hosting build gate. This corrects the earlier validation gap; it does not claim a completed Google account round trip.
