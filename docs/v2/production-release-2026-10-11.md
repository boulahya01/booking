# UNEEM production release — 2026-10-11

This release contains the approved monogram launcher icons, original torch in About, simpler Home and open-match screens, booking cooldown explanations, organizer management refinements, and the audited authentication/loading runtime changes.

## Validation completed before publication

- Production build and release hygiene passed; Svelte reported zero errors and warnings.
- All 114 desktop Chromium/Pixel 5 browser tests passed after dependency updates, including Arabic, auth routing, loading/error states, booking cooldown users joining open matches, and owner cancellation protections. Backend mutations used intercepted fictional fixtures.
- `npm audit --omit=dev` reports zero findings. The lockfile now resolves Svelte 5.57.2, devalue 5.9.4, DOMPurify 3.4.16 and ws 8.22.0. The nested svelte-i18n esbuild dependency uses a compatible tested override rather than npm's proposed major downgrade.
- The complete repository migration stack through layer 063 applied successfully in isolated local PostgreSQL 18 with minimal Auth/Storage interfaces. The match contract, concurrent join-first/cancel-second case, concurrent cancel-first/join-second case, and function rollback/reapply all passed using fictional records. These tests validate PostgreSQL behavior; they are not a hosted Auth/Storage end-to-end certification.
- The owner-cancellation guard was applied to production after those checks. Read-only verification confirms the guard exists, anonymous execution remains denied and authenticated execution remains allowed. Only the function/permissions changed; no live records were reset, reseeded or used as test fixtures.
- The prior production function was saved as an operational rollback outside versioned source. Frontend rollback should use the previous ready deployment; reverting the database guard is a separate deliberate operation.

## Follow-up work

The original [speed audit](speed-audit-2026-10-11.md) remains a baseline measurement from before these dependency updates. Mobile match-details performance, the lossless About torch's bandwidth, reservation foreign-key indexes and provider leaked-password protection remain improvement/review items. They are not claimed fixed by this release.

No real signup/recovery emails, live user fixture mutations or real-device installation tests were performed during publication. Recovery testing remains stopped at the user's request. Live publication and read-only smoke results will be recorded after deployment completes.
