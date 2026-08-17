# Booking V2 UI/UX Refinement Contract

Status: accepted implementation contract

This document keeps the V2 interface work explicit while the fresh Supabase backend is connected. Backend correctness is not considered a complete V2 release unless the student and admin experiences also satisfy this contract.

## Principles

- Reduce decisions per screen.
- Keep the current page visible during refreshes; avoid full-screen loading after the shell is known.
- Every async surface has loading, success, empty and recoverable-error states.
- Do not expose Supabase, SQL, RPC, UUID or HTTP implementation details to users.
- Mobile is the primary interaction target; desktop expands the layout rather than changing the mental model.
- Touch targets should be comfortable and consistent.
- English and Arabic must remain visually equivalent, including RTL spacing and icon direction.

## Student navigation

Primary student navigation stays small:

1. Home
2. My Bookings
3. Notifications
4. Profile

Admin navigation is visually and structurally separated from the student experience.

## Home

Home should answer three questions immediately:

1. Do I already have an upcoming booking?
2. What facilities can I book?
3. Is there anything important I need to know?

Order:

- compact header / greeting
- next-booking card when one exists
- important announcement(s)
- facility section

Do not show large decorative UI before the user's actionable content.

Facility cards should prioritize:

- facility name
- sport/type
- location
- opening hours when useful
- one obvious action: view times / book

Avoid duplicate metadata, excessive badges and unnecessary secondary actions.

## Facility / availability

Mental model:

`facility -> date -> time -> confirm -> booked`

The availability screen must make slot state identifiable without reading fine print.

### Slot states

Available:
- strongest booking affordance
- clear time
- one primary Book action

Booked by me:
- visually distinct from both available and occupied
- explicit "Your booking" state
- cancellation action only when the booking is cancellable

Occupied by another student:
- clearly unavailable
- show only the student's display name as required by the product
- never expose another student's booking ID or private profile fields
- no misleading clickable treatment

### Refresh behavior

- one availability RPC per refresh
- keep existing slots visible while background refresh runs
- do not blank the screen for interval/visibility refreshes
- after successful booking/cancellation, update immediately and reconcile with one refresh
- when a slot is taken during confirmation, keep the user on the same facility/date and explain that the time was just booked

## Booking confirmation

The modal/sheet should be short:

- facility
- date
- start/end time
- Confirm booking
- Cancel

No technical metadata and no redundant policy text.

Success should close the confirmation UI, update the affected slot and show a concise success toast. The PWA install suggestion may become eligible after this successful action, but should never block the booking flow.

## My Bookings

Use two user-facing concepts:

- Upcoming
- History

History contains completed and cancelled bookings. In-progress bookings remain visible as current/upcoming operational bookings.

Each booking card should show:

- facility
- date
- time range
- lifecycle state
- location when useful
- cancellation only when allowed

Cancellation should update the card/list locally instead of reloading the whole page.

## Auth / onboarding

V2 should not force users to understand internal Auth concepts.

- registration accepts university email, Student ID, full name and password
- university email requirement is clear before submit
- preserve valid entered email when moving between register, login and password recovery
- avoid account-enumeration preflight calls
- verification screen clearly explains the next action
- pending/approved/suspended states have dedicated human explanations
- returning users should not bounce through login while a persisted session restores
- auth errors always offer the next useful action when possible

## Profile

- Student ID is identity and read-only after registration
- email is read-only in profile
- full name is the only normal self-service profile field
- password change remains a separate security action
- role/status are informational, never editable by students

## Notifications / announcements

- announcements are useful content, not decorative banners
- unread count reflects the actual active undismissed set
- dismissing one item must not show an empty state while others remain
- failures are recoverable with Retry
- announcements remain readable in both EN/AR layouts

## Loading and error behavior

Initial unknown content may use skeletons.

Background refresh should:

- preserve existing content
- avoid layout jumps
- use subtle progress only when needed

Recoverable errors should contain:

- what failed in human language
- a Retry/action where useful
- preserved navigation/form context

Empty is not an error. Network/database failure is not an empty state.

## Mobile refinement

Audit every primary screen for:

- minimum comfortable touch target around interactive controls
- no cramped edge padding
- no horizontal overflow
- bottom navigation clearance
- modal/sheet keyboard behavior
- safe-area spacing for installable PWA use
- readable time-slot typography
- consistent card radius/border/shadow system

## Arabic / RTL

- verify start/end spacing rather than hardcoded left/right spacing
- reverse directional navigation icons where appropriate
- ensure numerals/time remain readable
- test cards, tabs, toasts, modal actions and bottom navigation in RTL

## PWA install UX

- never show an aggressive first-visit install prompt
- capture browser install eligibility
- only surface the custom install card after meaningful engagement such as a successful booking
- "Not now" suppresses the custom prompt for 30 days
- installed/standalone sessions never see the install card
- live availability and booking mutations are never served from stale cache

## Admin UX

Admin remains a separate workspace with these first sections:

- Bookings
- Facilities
- Users
- Announcements
- Settings

Admin refinement goals:

- compact operational tables/cards instead of oversized student-style surfaces
- clear filters/search
- no duplicated `/admin/users` and `/admin/manage-users` concepts in the final navigation
- safe confirmation for destructive actions
- explicit status/permission feedback
- pagination or bounded result sets before real scale

## Release UX gates

V2 is not ready for production until:

1. signup -> verification -> approved access is understandable on mobile
2. Home has no auth/loading bounce
3. facility availability has clear Available / Yours / Occupied states
4. booking and cancellation complete without full-page reloads
5. My Bookings accurately separates upcoming and history
6. errors are human and recoverable
7. Arabic/RTL primary flows pass visual review
8. mobile layout has no overflow or navigation collisions
9. contextual PWA install behavior is validated in a supporting browser
10. admin core screens pass a separate usability/refinement review
