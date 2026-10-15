# UNEEM UX improvement plan

Date: 2026-10-15
Status: core frontend implementation completed locally on `fix/speed-enhance-for-this-version`.
Match messaging remains the separate feature release described in phase 5.

## Approved typography decision

The user selected Qehwa's font pairing and typography direction for UNEEM:
Outfit Variable for English/Latin and Tajawal for Arabic. This choice is settled;
do not retain Geist/Noto Sans Arabic as competing design options.

Use regular text throughout, medium weight for controls and selected navigation,
and selective heading emphasis. Avoid bold text across entire cards, lists,
menus, forms, or dashboards. Establish hierarchy with size, spacing, and color
before increasing weight. Apply the same rules to public, authenticated, and
admin screens. The selected fonts and restrained weights are implemented; mobile and desktop fixture verification is in progress.

## Goal and evidence

Make it easier for a student to find a place to play, join a match, return to
their next activity, manage their account, and get help. Use Qehwa's navigation
and visual consistency as references while keeping UNEEM's identity and rules.

Evidence: the user's current Qehwa screenshots of the header, dock, account
tabs, dashboard, and login, the supplied phone app-switcher comparison, plus
current source in both repositories. The app-switcher cards have different
crops/scales, so do not infer exact CSS dimensions from them. Do not copy the
unrelated personal content visible around the app cards into design artifacts.
Browser control is unavailable in this session. UNEEM's full rendered flows, measured task
completion, physical-device behavior, and live messaging delivery still need
verification. Source findings below are not a completed live visual audit.

## Comparison and decisions

| Journey | Qehwa reference | UNEEM source today | Proposed improvement |
| --- | --- | --- | --- |
| Find something to play | Play groups casual games, tournaments, and map | Home shows facilities and open matches; Matches repeats the open-match component | Group Facilities and Open matches beneath Play, with a visible switch |
| Navigate the product | Four task destinations and clear active states | Home, Matches, My Sports, Menu | Use meaningful destinations; make Account explicit |
| Return to an activity | Account dashboard introduces the next game | Home has a next-booking card; My Sports has separate joined matches, upcoming bookings, and history | Give My activity one chronological upcoming list and a separate history view |
| Manage account | Related pages share account navigation; settings separates profile, sign-in, and appearance | Menu combines identity, preferences, support, install/update controls, admin access, and branding; Profile combines details and security | Account overview with Profile, Verification, and Settings navigation |
| Sign in | Provider actions, email divider, fields, recovery, one submit action | Google/email, labels, recovery, password visibility, validation, and shared AuthShell already exist | Refine spacing, hierarchy, responsive layout, and state behavior using existing components |
| Have a conversation | Dedicated messages page supports direct and meetup conversations | Help implements authenticated/guest support conversations; no student match-chat page found | Improve support discoverability now; design participant match chat as a separate feature |

Qehwa is not automatically the better implementation in every area. Its app
shell also blocks on auth, discovery hooks refetch on mount, and its supplied
login screenshot shows the title beneath the header at that scroll position.
Keep UNEEM's request caching, focused data projections, and useful form behavior.

## Recommended information architecture

Initial release:

- Play: Facilities / Open matches.
- My activity: Upcoming / History.
- Account: Profile / Verification / Settings, with a clear Help & support link.

Add Messages as the fourth primary destination when the conversation experience
is complete. Until then, use three useful primary destinations rather than an
empty inbox. This is a deliberate change from UNEEM's current four destinations.
Validate discovery of Open matches before removing its dedicated dock entry.

Destination responsibilities:

- Play answers "What can I book or join?" Facilities and Open matches retain
  distinct views. Do not show both full lists repeatedly on the same screen.
- My activity answers "Where do I need to be next?" Combine owned bookings and
  joined matches in time order, with a short Booked / Hosting / Joined label.
  Deduplicate an owned booking that also appears as a match. Derive status and
  timezone from existing APIs. History must distinguish completed/cancelled
  bookings and any available past participation without inventing missing data.
- Account answers "How do I manage my identity and preferences?" Show verification
  status and its next action without letting a status badge dominate the screen.
- Messages, once implemented, answers "Who am I talking to about this game?"
  Keep Support and match conversations explicitly identified. Notifications
  remain distinct from messages. On compact screens place Notifications with its
  unread count inside the header menu; show a dedicated bell only where the
  header has enough room. An accessible unread indicator on the menu trigger
  keeps notifications discoverable without adding a fourth utility control.

Keep existing facility, match, booking, invite, and recovery links working.
Switching sections must not discard a booking draft or lose a user's return path.

## Loading, booking feedback, and slot ownership

User requirement: browsing should stay responsive; critical actions must receive
real server confirmation; personal bookings must be recognizable without reading
a username. Treat this as a priority alongside the shared visual foundation.

Current source findings:

- `AvailabilitySlot` and `getPitchAvailability` already expose `booked_by_me`,
  but `SlotCard.svelte` does not use it. All occupied slots share the same base
  treatment and fall back to Booked/Open plus the booker's name.
- `BookingModal.svelte` already awaits `createBooking` before its success toast.
  It discards the returned booking, closes, and requests a background refresh.
  This leaves an opportunity to render the confirmed owned slot immediately.
- `createBooking` wraps the action in global loading while the modal also shows
  button loading. These are duplicate progress surfaces for one local task.
- The pitch page keeps populated slots visible during refresh, which is useful.
  Its availability and personal booking reads run in parallel, but the combined
  `Promise.all` delays their combined assignment until both finish. The facility
  metadata is also read separately rather than through the shared facility cache.
- Repository SQL defines server-side access, booking-rule, and overlap checks.
  This is source evidence, not confirmation of the currently deployed schema.

Loading policy:

| Situation | Intended behavior |
| --- | --- |
| First visit, no data | Show page structure immediately; use a placeholder only for the section without data |
| Return to a screen | Render safe current-user cached content promptly; refresh without replacing it with skeletons |
| Same-user session refresh | Keep the shell mounted; background work does not interrupt browsing |
| Account identity change/sign-out | Clear private data; never display another account's cached content |
| Book/join/cancel/send | One progress indicator beside the affected action, with duplicate submission prevented |
| Explicit full-page authentication transition | Give clear progress while establishing the session; preserve the return destination |
| Slow/failing background refresh | Keep the last view with a small stale/retry indication where freshness matters; do not pretend offline availability is current |

The spinner itself is not necessarily the source of network delay. Remove
redundant requests, unnecessary sequencing, and screen replacement as well as
excessive visible progress. Backend permission/rule checks remain mandatory for
each mutation; they do not require a separate blocking frontend check on every
navigation or card render. Reconcile refreshed permissions and keep unconfirmed
actions disabled where necessary.

Booking interaction:

1. Open the selected slot's confirmation promptly using the displayed snapshot.
   Availability is provisional until submission succeeds.
2. On confirmation, show Booking… / جارٍ الحجز… in the same button with a subtle
   animation; lock duplicate submissions for this action. Avoid a second global
   progress bar and do not add an artificial minimum wait.
3. Submit the authoritative booking operation. Keep availability/rule validation
   and creation together on the server; a client check followed by an insert does
   not protect against someone booking simultaneously.
4. Only after a valid confirmed result, update that slot using the returned
   booking identity/time and known current-user ownership. Show a short check
   confirmation and Your booking, then reconcile relevant caches in the background.
5. On a definite slot conflict, explain that the time was just booked and refresh
   its state without showing success. Keep the surrounding times and position.
6. On timeout/disconnection, the write may have succeeded. Reconcile the user's
   bookings and slot state before presenting a retry that could duplicate a write.
   If status cannot be resolved, say confirmation is unavailable and provide a
   Check booking action. Do not claim failure or success without evidence.

Use actual action progress rather than a made-up sequence of Checking/Reserving
stages when the backend only exposes one request. Respect reduced motion and
announce the result accessibly. Immediate visual feedback is appropriate;
optimistic booking ownership before confirmation is not.

Slot presentation:

| State | Visible identity and action |
| --- | --- |
| Available and eligible | Neutral card; clear Book action |
| Available but restricted by a booking rule | Explain the applicable rule once; retain the appropriate Book later/Verify behavior |
| Owned by current user | Subtle brand tint or accent edge, check/calendar icon, Your booking / حجزك, and View your booking |
| Joined by current user | Distinct participation icon, You're playing / أنت مشارك, and View match; show only when confirmed membership data exists |
| Booked by another person, open | Open match / مباراة مفتوحة plus spots left; route to match details and the existing join action |
| Booked by another person, closed/full | Muted Booked / محجوز or Full / مكتمل state; no booking action; keep detail access where currently permitted |
| Submission pending | Keep the selected card stable and show local progress; do not mark it as owned yet |

Ownership and openness are independent: an owned open match still leads with
Your booking and may also show an Open badge. Never infer friendship from a
booker's username, and do not use username comparison to determine ownership.
The current availability type lacks participation flags; use confirmed existing
membership data or a reviewed API change before adding You're playing.

Use text + icon + treatment, not color alone. Other people's bookings still need
readable contrast. Keep names secondary and follow the approved restrained font
weights. Stable keys based on facility/time prevent a slot from remounting solely
because an available time acquired a booking ID.

Acceptance checks use fictional isolated fixtures: owned/other/open/full/joined
states; delayed success; two competing bookings with one winner; double clicks;
definite rejection; lost-response reconciliation; cache/account isolation; and
reduced-motion/Arabic layouts. Never run mutation or concurrency tests against
production. Check the affected card changes after confirmation without waiting
for an unrelated read, while background refresh preserves the visible grid.

## Delivery sequence

### 1. Establish the header and typography direction

Prepare mobile references for Play, My activity, Account, and Login using the
user's Qehwa screenshots as structural references. Implement the approved Qehwa-inspired direction, keeping UNEEM's existing brand and
English/Arabic support. The approved Outfit/Tajawal pairing is fixed across
these layout refinements. Reuse the design tokens and product voice while
applying Qehwa's typography direction consistently.

The first slice is the shared header + typography foundation. Apply it to the
reference screens before changing navigation structure or adding features.

Header proposal:

- Brand/logo at the start; language selector, sun/moon control, and menu trigger
  aligned at the end. Use the same Lucide icon family and a consistent stroke.
- Aim for a 60-64px header excluding safe-area insets, small 18-20px utility
  glyphs inside at least 44px interactive targets, and one subtle bottom divider.
  Treat dimensions as preview targets and verify at narrow widths.
- Language uses EN / العربية, with a small explicit choice menu. UNEEM currently
  supports English and Arabic; do not add French solely to match Qehwa.
- Theme changes immediately between light and dark from the header. Keep the
  System setting in Account settings; indicate the effective theme and label
  the button with the action it will perform. Preserve the choice on reload and
  keep browser/PWA theme color in sync, including startup.
- The menu groups Account, My activity, Notifications, and Help & support. Keep
  admin tools role-specific and sign-out visually secondary. Close on route
  selection, outside interaction, and Escape; restore focus to the trigger.
- Keep the header's geometry stable during loading and preference changes. Use
  restrained color/opacity feedback around 140-180ms and reduced-motion support;
  avoid animating layout or adding blur effects that hurt scrolling.
- Login uses the same brand, language, and theme treatment with fewer navigation
  controls; recovery screens retain a clear back action. Check content offsets
  so a sticky header never covers a heading.

Typography findings and implementation requirements:

- Qehwa's current source uses Outfit Variable for Latin and Tajawal for Arabic.
  UNEEM uses Geist for Latin and Noto Sans Arabic for Arabic, all locally bundled.
  These settings explain a real family difference; appearance is also affected
  by weight, line spacing, card density, and the screenshot scale.
- Use Outfit Variable for English/Latin and Tajawal for Arabic throughout UNEEM.
  Verify actual Arabic UI labels and mixed numbers as layout checks, not as
  another font-selection step. Keep local fallbacks for delivery failures.
- Starting scale for task screens: page titles 28-32px, section titles 20-22px,
  body and form inputs 16px, secondary copy 14px, and dock labels 12px. Marketing
  heroes use their own responsive scale rather than enlarging every app heading.
- Default to 400 for body, descriptions, fields, and list content. Use 500 for
  buttons, selected navigation, labels that need emphasis, and most headings.
  Outfit may use 550-600 selectively for major headings; avoid 700-900 as default
  UI weights. Tajawal uses real bundled 400/500 weights for regular and medium
  text; do not request unavailable intermediate weights or synthesize bold.
  Reserve a real 700 Arabic face only for an explicitly justified exception.
  Keep body line height near 1.5-1.6 and allow Arabic its own spacing; do not apply
  Latin negative tracking to Arabic.
- Audit existing `font-bold`, `font-extrabold`, `font-semibold`, and explicit
  weight overrides when implementing. Replace them according to text role;
  avoid blanket CSS overrides that break intentional hierarchy or icon fonts.
- Avoid arbitrary uppercase facility names. A more readable hierarchy must work
  with realistic long names, times, status labels, and empty states.
- Keep local font delivery and a small font payload. Verify font-loading layout
  shifts, Arabic coverage, fallback behavior, and readable inputs after the font
  choice; the visual preference alone is not evidence of better performance.

Use a compact header, consistent page gutters, one clear primary action per
task, restrained borders, and a stable dock. Reserve stronger accent color for
actions and selected states. Grouped navigation needs a clear active state and
must remain usable in Arabic, with long labels, and on narrow screens.

Check the shortest routes for these tasks with fictional data:

1. Find a facility and select an available slot.
2. Find an open match and open its join details.
3. Find the next activity and open its details.
4. Find verification status and the required next action.
5. Find sign-in recovery and support.

### 2. Implement navigation and account organization

Primary files: `frontend/src/lib/components/TopBar.svelte`,
`frontend/src/lib/components/BottomNav.svelte`,
`frontend/src/routes/(app)/+layout.svelte`, and
`frontend/src/routes/(app)/menu/+page.svelte`.

- Consolidate desktop/mobile destination definitions and active-state mapping.
- Reuse the header utility controls and typography established in the first slice
  across public, authenticated, and account screens where appropriate.
- Introduce Play's Facilities / Open matches navigation using the current routes
  and components. Preserve `/matches` as a working direct destination.
- Rename the visible Menu destination to Account; add related navigation across
  Profile, Verification, and Settings. Keep existing URLs or provide compatible
  redirects when a route changes.
- Keep support obvious. Place install/update and admin tools below everyday
  account tasks. Preserve access restrictions and the public support path.
- Preserve navigation during same-user background updates. Account-sensitive
  actions still wait for confirmed permission state.

Acceptance: every main task has a clearly named entry; back navigation and
direct links work; active states are correct; no sticky element covers headings,
controls, or the last list item.

### 3. Improve activity and booking/join flows

Primary files: `frontend/src/routes/(app)/home/+page.svelte`,
`frontend/src/routes/(app)/bookings/+page.svelte`,
`frontend/src/lib/components/NextBookingCard.svelte`,
`frontend/src/lib/components/HomeMatches.svelte`, and existing detail routes.

- My activity leads with the nearest booking or joined match, followed by the
  rest of Upcoming. Move historical content to History.
- Reuse a consistent activity row/card: time, facility, participation status,
  and one direct action. Avoid repeated summaries above a user's next task.
- Keep open matches a simple list of time, facility, spots, and Join/View.
  Keep the approved no-search/no-filter pattern for that list.
- Keep booking creation, public joining, and managing an owned match distinct.
  Preserve first-come participation, reservations for friends, and joined-player
  protections. Do not introduce organizer approval to join.
- Cover empty, failed, unavailable, full, joined, reserved, and cancelled states
  with a clear next action where one exists.

Acceptance: upcoming items appear once in time order; a student can distinguish
booking ownership from joining; Join/View goes to the correct existing detail;
returning preserves the relevant list position where practical.

### 4. Refine login and shared interaction states

Primary files: `frontend/src/lib/components/AuthShell.svelte`,
`frontend/src/lib/components/SocialSignIn.svelte`,
`frontend/src/routes/(auth)/login/+page.svelte`, and shared controls/styles.

- Keep existing Google/email behavior, recovery, and field semantics.
- Align provider buttons, fields, submit controls, and secondary links to the
  same width and spacing rhythm. Avoid adding new providers solely for parity.
- Keep install promotion subordinate to signing in; check short screens and
  the keyboard before choosing its placement.
- Use the existing cache to show safe current-user content promptly on return;
  background refresh should not replace an already usable screen.
- Keep loading, success, error, disabled, focus, and pressed states consistent.
  Preserve the current draft and data when a request fails.

Acceptance: headings remain readable when scrolling; recovery and submit stay
reachable with the keyboard; loading does not shift the whole form; email
confirmation and OAuth return paths keep their existing behavior.

### 5. Add messaging in a separate feature release

Current foundation: `frontend/src/routes/help/+page.svelte` and
`frontend/src/lib/supportApi.ts`. Reuse support behavior rather than replacing
existing conversations. Qehwa's messages page is a product reference, not a
database schema to copy into UNEEM.

Recommended first new conversation: chat attached to an existing match, entered
from that match's details. Defer unrestricted direct messages.

Resolve before implementation:

- Who can read/send: organizer and eligible participants; define treatment of
  reserved guests, leaving, suspension, completion, and cancellation explicitly.
- How conversation identity, history, unread position, and reply notifications
  work across sessions and devices.
- Whether support threads can be presented in the same inbox without changing
  guest access or exposing another user's conversation.
- Pagination, reconnect, failed-send retry, duplicate-send prevention, draft
  preservation, moderation/reporting, and retention.

Then implement conversation list + thread view, responsive back navigation,
accessible composer, honest delivery states, and server-enforced membership
checks. Only add the dock destination when those flows work end to end.

Validate schema/policies and send/reconnect/concurrency behavior using fictional
fixtures in an isolated database. Prepare an additive migration and rollback
plan before requesting production deployment. Do not test sends or create users
in production.

## Verification and release gates

- Compare approved mobile references with rendered screens. Check 320px, 390px,
  the supplied 586px width, and desktop; English/Arabic, light/dark, long labels,
  text zoom, keyboard, safe areas, and reduced motion.
- Check focus order/visibility, accessible names, selected navigation, contrast,
  and touch targets. Screenshots alone do not establish accessibility compliance.
- Run relevant existing navigation/auth/profile/verification/PWA/notification
  checks and meaningful regressions for changed journeys. Keep real user data
  out of screenshots, fixtures, reports, and logs.
- Measure cold startup, warm return, first and repeat navigation separately with
  the same device/network conditions and comparable data. Compare shell visible,
  content usable, and action completion. Do not infer speed from animation.
- Start with a baseline of the five tasks above. Repeat with the proposed
  navigation and verify users can find Open matches and their next activity
  without guidance before removing the current navigation.
- Public read-only checks, isolated authenticated tests, hosted sign-in tests,
  and installed-PWA/physical-device checks are separate evidence. A local build
  does not establish production readiness.

## First implementation slice

After visual direction is selected: shared header + typography, then navigation
and Account organization, followed by My activity. These address the user's latest
visual feedback and the strongest structural usability gaps using existing data.
Login refinement follows; messaging remains its own feature release. Keep each
slice reviewable and independently reversible.


## Implementation checkpoint

- [x] Created the requested branch with spaces normalized to hyphens.
- [x] Locally bundled Outfit Variable and Tajawal 400/500; removed the previous font packages.
- [x] Reduced excessive font weights across public, student, auth, and admin screens.
- [x] Shared language/theme/menu controls, task navigation, Play tabs, and Account grouping.
- [x] My activity chronological merging, owned-match deduplication, and separate History.
- [x] Cached first render for return visits; independent availability/policy reads.
- [x] Same-user auth refresh preserves mounted content; identity changes invalidate stale work.
- [x] Local action progress and confirmed ownership updates; conflict/uncertain-response handling.
- [x] Type check: zero errors and warnings.
- [x] Production build and release-hygiene checks pass.
- [x] Full isolated desktop/mobile regression run: 170 cases passed, including auth, profile, PWA, notifications, and navigation.
- [x] Final speed/UX follow-up: 42 desktop/mobile cases passed after separating booking guidance from delayed membership reads.
- [x] Additional outage/partial-response, identity-switch, booking-conflict, and uncertain-response checks passed.
- [ ] Separate match-messaging release: membership rules, schema, isolated validation, and rollout.

Production database and booking data have not been changed. Browser tests use
fictional intercepted Auth/REST responses. These checks do not establish hosted
OAuth delivery, live database concurrency, installed-PWA behavior, or production
performance.


### Local implementation evidence

The frontend now bundles Outfit Latin (32.29 kB) and Tajawal Arabic regular and
medium (about 8.94 kB each). These are emitted local assets, not a live loading
benchmark. The build completed with zero Svelte/TypeScript errors or warnings.

The final speed checks hold individual reads pending and verify that availability,
booking guidance, match membership, and activity results appear independently.
Confirmed bookings paint ownership before background refreshes finish. Same-user
account refreshes keep the current screen mounted; private cached responses from
an earlier identity cannot overwrite a newer account. Pending or uncertain writes
never display a confirmed booking without authoritative evidence.

Manual screenshot review covered Arabic dark-mode Play, Account, and header menu
at 320px, plus English activity and slot ownership fixtures. All visible identities
are fictional. Backend access, overlapping-booking protection, verification, and
joined-player fairness remain enforced through the existing server operations.
No schema migration or production deployment is part of this branch's completed
frontend release. Phase 5 match messaging remains a separate feature release.
