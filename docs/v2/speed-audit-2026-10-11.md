# UNEEM speed and release audit — 2026-10-11

The local production candidate passes its build and 114 browser regressions. It is not ready for release approval: dependency advisories need resolution or documented applicability review, and the new owner-cancellation database guard has not been deployed or exercised in an isolated database.

## Method and scope

- Built with the repository lockfile installation already present; release hygiene passed and Svelte reported zero errors and warnings.
- Ran all 114 Playwright tests against the production preview: desktop Chromium and Pixel 5, English/Arabic, loading/error paths, auth boundaries, management, capacity UI, cancellation, and booking cooldown versus joining. All passed in 1.6 minutes. Backend responses were intercepted with fictional fixtures.
- Measured nine representative routes: three cold samples each on Pixel 5 at 4x CPU slowdown, 1.6 Mbps download and 150ms network latency; one unthrottled desktop sample each. HTTP cache disabled, service workers blocked, fictional backend intercepted. Measurements ran after regression tests to avoid competing browser load.
- Collected LCP, first paint, layout shifts, long tasks, transferred resource bytes, overflow and uncaught errors using Chrome through repository Playwright tooling. The Chrome DevTools MCP was unavailable. This is not a Lighthouse score, field INP, production query benchmark or concurrent-user load test.
- Production checks used public GET requests and read-only database metadata/advisors. No live accounts, bookings, participants, emails or schema were modified. Recovery work remains stopped as requested; the user's live recovery confirmation is recorded as user-reported evidence.

## Cold-load results

| Screen | Mobile median LCP, 3 samples | Largest observed layout-shift sum | Desktop LCP, 1 sample |
| --- | ---: | ---: | ---: |
| Landing | 2.34s | 0 | 0.248s |
| Login | 2.05s | 0 | 0.164s |
| Home | 2.46s | 0.052 | 0.176s |
| Matches | 2.43s | 0 | 0.180s |
| My Sports | 2.25s | 0 | 0.164s |
| Menu | 1.99s | 0 | 0.200s |
| Facility times | 2.34s | 0 | 0.196s |
| Match details | 2.63s | 0 | 0.212s |
| Organizer management | 2.62s | 0 | 0.220s |

All 36 samples rendered a heading, had no horizontal document overflow, no uncaught page errors and no unhandled fixture endpoints. Individual mobile samples varied: My Sports reached 2.596s and organizer management reached 2.996s. Home has little margin under the LCP target and still has a small cold-load shift; its delayed empty-booking regression specifically passes with less than one pixel of facility movement.

Opening the organizer's Add player form on a warm local page at 4x CPU slowdown took 267ms, 115ms and 127ms (median 127ms), measured from the Playwright action to the visible input. This includes automation overhead and measures one UI response, not INP.

The reference good thresholds are LCP at most 2.5s, INP at most 200ms and CLS at most 0.1 at the 75th percentile of real visits. Our medians and short-window layout-shift sums are lab observations, not a field Core Web Vitals pass. See [Web Vitals guidance](https://web.dev/articles/vitals).

## Payload and background work

- The largest emitted JavaScript chunk is 186,806 bytes raw / 48,309 bytes gzip. Routes load separate chunks. Arabic translations load on demand and the primary Latin font is preloaded; fonts are self-hosted.
- Observed cold-page resource transfers are approximately 182–209 KiB on the primary routes. Menu reaches about 729 KiB because Chrome fetches the 537 KiB lossless torch near the viewport despite native lazy loading. It is not Menu's LCP bottleneck, but it is the clearest bandwidth reduction opportunity. Preserve the approved original and its calligraphy when changing when it loads.
- Booking details and roster requests are already parallel. Profile-scoped browser caches deduplicate ordinary requests and are cleared when identity changes; SSR does not share those cached values.
- Home matches refresh every 30 seconds only when visible and online; facility slots refresh every two minutes while visible; support refreshes every 3.5 seconds only with a visible active thread. Admin support refreshes every six seconds while visible. Timers are cleaned up on unmount. Support polling merits capacity measurement in an isolated environment as usage grows.

## Read-only production findings

- The configured legacy origin redirects once to `https://www.uneem.site/`, which returns HTTP 200. Three redirect-following HTTP samples took 0.55–1.46s overall, with a 0.63s median. These are machine/network-specific HTTP observations, not page-render timings.
- Three fresh unauthenticated Pixel 5 browser contexts on the actual public landing page, without CPU/network emulation, measured LCP 1.456s, 0.584s and 0.596s (median 0.596s). All returned HTTP 200 with zero observed layout shifts, overflow or uncaught errors. This public route sample does not measure signed-in live database latency or field experience.
- Local and live manifest/favicon/PWA/maskable/Apple assets all returned HTTP 200. All six live responses differ byte-for-byte from the current candidate; the new icon/manifest candidate is not verified as deployed. Installation and cached-icon replacement still need device verification.
- Public responses include HTTPS HSTS, CSP and `X-Content-Type-Options: nosniff`. CSP still allows inline scripts/styles; this audit does not certify the full security posture.
- All public database tables have RLS enabled. The booking timeline view uses security-invoker mode. Sampled admin cancellation, user listing and support listing RPCs enforce `private.is_admin()` and are not anonymously executable.
- The deployed join RPC does not reference booking frequency. Together with the passing browser cooldown/join regression, this supports the intended rule: a booking cooldown blocks creating a booking, not joining an open match. No live join was created for testing.
- The deployed owner cancellation RPC does **not** contain `match_has_public_players`. The prepared migration `20261011002159` remains a release gate: browser checks alone cannot eliminate a concurrent join/cancel race.
- Performance advisors report two missing foreign-key indexes on `match_reservations.created_by` and `match_reservations.profile_id`, plus 20 unused-index notices. Review workload/query plans in isolation before adding indexes; do not delete unused indexes based only on these counters.
- Security advisors report five RLS-without-policy notices, ten authenticated GraphQL-discovery warnings, two anonymous capability-token RPC warnings, 48 authenticated SECURITY DEFINER RPC warnings, and disabled leaked-password protection. The RPC architecture and capability-token guest endpoints are intentional in source. These metadata warnings are not proof of unauthorized access; role/policy applicability still needs review. Review leaked-password protection availability/configuration in the provider.

## Dependency audit

`npm audit --omit=dev` reports six affected packages: two high, four moderate, zero critical. Package totals include a transitive advisory inherited by `svelte-i18n`; they are not six independently demonstrated app vulnerabilities.

| Installed package/path | Reported severity | Review |
| --- | --- | --- |
| `devalue@5.7.1`, through SvelteKit/Svelte | High | Update to a patched compatible version. No application source use of Node Buffer or `hydratable` was found in this spot check; that does not establish complete reachability analysis. |
| `ws@8.20.0`, through Supabase Realtime | High | Review Node/server use and update the compatible transitive dependency. Browsers use native WebSocket; this is not evidence of a browser-side exploit. |
| `dompurify@3.4.1` | Moderate | Update and verify input sanitization. Current application calls use string input without IN_PLACE mode, hooks or custom elements; several listed conditions do not match these calls. |
| `svelte@5.55.5` | Moderate | Update to a compatible patched release and rerun build/regressions. |
| `esbuild@0.19.12` through `svelte-i18n@4.0.1` | Moderate | Advisory concerns the esbuild development server. Review packaging/tool use; npm's proposed major downgrade is not an appropriate automatic fix. |
| `svelte-i18n@4.0.1` | Moderate, inherited | Same nested esbuild finding; retain intended Svelte compatibility while resolving it. |

Primary advisories: [devalue shared-memory serialization](https://github.com/advisories/GHSA-j22f-vq7h-c4qm), [ws memory exhaustion](https://github.com/advisories/GHSA-96hv-2xvq-fx4p), [Svelte promise serialization](https://github.com/advisories/GHSA-f3cj-j4f6-wq85). No dependency changes or automatic force fixes were made during this audit.

## Source hygiene and next gates

- Release-hygiene checks and `git diff --check` passed. A text scan of 75 changed/untracked paths found no credential/project-reference patterns or unexplained personal email candidates. Three fictional academic contract accounts use the configured institution domain and were reviewed as test identities. Pattern scanning cannot certify every name, image or arbitrary identifier.
- `AGENTS.md` now explicitly records real live users and protects production records, auth flows and exports. Existing local edits were preserved.
- First resolve the dependency findings with targeted compatible updates and repeat the affected checks. Then validate cancellation/participation races against fictional fixtures in an isolated database, prepare rollback and request production deployment separately.
- Optimize the mobile match-details/management cold load and give Home more margin. Measure after changes; do not infer improvement from bundle edits alone.
- Finally verify the exact deployed candidate, approved icons and PWA update/install behavior on a real mobile device, and complete the remaining authenticated release gates without using production as a disposable test database.

Raw sanitized measurements and test/build logs are retained outside the repository in the task's release-prep artifacts. No production deployment, migration application or commit was performed.
