- save all last edits in memory, and remember always to search on the best practices for UI UX

## UI/UX Overhaul - Completed 2026-04-25

### Design System: Modern, App-Proven (Not Claude Marketing)

The app uses a clean, professional color palette proven for functional booking apps (like Airbnb, Booking.com, Stripe). NOT the Claude marketing palette (terracotta + parchment) which is unsuitable for functional app UI.

### Color Palette

**Light Mode:**
- Primary/Brand: #2563eb (Trustworthy Blue)
- Primary Hover: #1d4ed8
- Primary Light: #dbeafe
- Page Background: #f8f9fb (Clean warm-white)
- Card Surface: #ffffff (Pure white)
- Surface Raised: #ffffff (with shadow)
- Surface Level 1: #f1f3f7 (Subtle fill)
- Surface Level 2: #e8ebf0 (Prominent fill)
- Text: #111827 (Deep, highly readable)
- Text Secondary: #4b5563 (Medium, readable)
- Text Muted: #9ca3af (Light, for captions)
- Text Inverse: #ffffff
- Borders: #e5e7eb (Subtle, clean)
- Danger: #dc2626 (Clear error red)
- Success: #059669 (Professional green)
- Warning: #d97706 (Warm amber)
- Info/Focus: #2563eb (Blue, same as primary)

**Dark Mode (Claude warm dark palette):**
- Primary: #d97757 (Coral Accent)
- Primary Hover: #e08a6a
- Primary Light: rgba(217, 119, 87, 0.15)
- Page Background: #141413 (Deep Dark - warm near-black)
- Card Surface: #1e1e1c (slightly raised dark)
- Surface Raised: #262624
- Surface Level 1: #30302e (Dark Surface)
- Surface Level 2: #3d3d3a (Dark Warm)
- Text: #faf9f5 (Ivory - bright warm)
- Text Secondary: #b0aea5 (Warm Silver)
- Text Muted: #87867f (Stone Gray)
- Borders: #30302e (Dark Surface)
- Success: #7ab87e | Warning: #d4963a | Danger: #d45e5e | Info: #5eb0f0

### Shadow System (Modern Layered Drops)
- shadow-xs/sm/md/lg/xl: Layered subtle drop shadows, not ring-only
- shadow-primary: Blue glow 0 4px 14px rgba(37, 99, 235, 0.25)

### Border Radius (Generous, Approachable)
- 6px (sm): badges, chips
- 8px (md): buttons, standard containers
- 12px (lg): inputs, primary buttons, cards
- 16px (xl): featured containers
- 24px (2xl): tag-like elements
- 32px (3xl): hero containers

### Typography
- **Sans-serif (body/UI):** 'Inter', system fonts
- **Serif (headings):** 'Source Serif 4', Georgia fallback
- **Loaded from Google Fonts:** Inter (400,500,600,700), Source Serif 4 (400,500,600), El Messiri (Arabic)
- **Heading rule:** ALL h1/h2 titles use `font-serif font-medium` (weight 500, NOT bold)
- **Card titles, badges, labels, UI elements:** Keep `font-sans font-semibold/bold`
- Body line-height: 1.60
- Heading line-height: 1.25 (tight)

### Typography Reference - All Headings in the App

#### Page Titles (h1) - font-serif font-medium
1. `src/routes/(app)/home/+page.svelte:53` - Home title
2. `src/routes/(app)/bookings/+page.svelte:116` - Bookings title
3. `src/routes/(app)/pitch/[id]/+page.svelte:137` - Pitch name
4. `src/routes/(app)/profile/+page.svelte:167` - User full name
5. `src/routes/(app)/admin/users/+page.svelte:121` - Admin users title
6. `src/routes/(app)/admin/pitches/+page.svelte:126` - Admin pitches title
7. `src/routes/(app)/admin/manage-users/+page.svelte:106` - Admin manage users title
8. `src/routes/(app)/pending-approval/+page.svelte:70` - Pending title
9. `src/routes/(app)/pending-approval/+page.svelte:103` - Registration Rejected
10. `src/routes/(auth)/login/+page.svelte:93` - Login title
11. `src/routes/(auth)/register/+page.svelte:68` - Register title
12. `src/routes/(auth)/forgot-password/+page.svelte:61` - Email sent title
13. `src/routes/(auth)/forgot-password/+page.svelte:82` - Forgot password title
14. `src/routes/(auth)/reset-password/+page.svelte:74` - Reset password title
15. `src/routes/(auth)/verify-email/+page.svelte:71` - Verify email waiting
16. `src/routes/(auth)/verify-email/+page.svelte:90` - Verify email verifying
17. `src/routes/(auth)/verify-email/+page.svelte:95` - Verify email success
18. `src/routes/(auth)/verify-email/+page.svelte:100` - Verify email error

#### Section Titles (h2) - font-serif font-medium
1. `src/routes/(app)/home/+page.svelte:83` - Available pitches
2. `src/routes/(app)/pitch/[id]/+page.svelte:159` - Slots title
3. `src/routes/(app)/profile/+page.svelte:187` - Personal info
4. `src/routes/(app)/profile/+page.svelte:255` - Change password
5. `src/routes/(app)/admin/pitches/+page.svelte:139` - Edit/Create pitch form

#### Modal Titles (h2) - font-serif font-medium
1. `src/lib/components/Modal.svelte:51` - Generic modal title prop
2. `src/lib/components/BookingModal.svelte:68` - Confirm booking title

#### Card/Item Titles (h3) - font-sans font-semibold (UI elements)
1. `src/routes/(app)/bookings/+page.svelte:172` - Booking pitch name
2. `src/routes/(app)/admin/users/+page.svelte:138` - User name
3. `src/routes/(app)/admin/pitches/+page.svelte:172` - Pitch name
4. `src/routes/(app)/admin/manage-users/+page.svelte:123` - User name
5. `src/lib/components/NextBookingCard.svelte:81` - Booking pitch name
6. `src/lib/components/PitchCard.svelte:17` - Pitch name

#### Date Group Headers - font-sans
1. `src/routes/(app)/pitch/[id]/+page.svelte:194` - Date header (Today/Tomorrow)

### Design rules to follow:
- NEVER use hard-coded Tailwind gray colors (text-gray-XXX, bg-gray-XXX, border-gray-XXX)
- ALWAYS use design token classes: text-text, text-text-secondary, text-text-muted, bg-surface, bg-surface-level-1, bg-surface-level-2, border-border
- Focus rings use blue (info or primary token) - clear, accessible
- Both light and dark mode handled via CSS variables - no dark: prefixes needed for color classes
- Surface hierarchy: bg < bg-surface < bg-surface-raised < bg-surface-level-1 < bg-surface-level-2
- For semantic backgrounds: bg-success-light, bg-danger-light, bg-warning-light, bg-info-light, bg-primary-light
- For semantic text: text-success, text-danger, text-warning, text-info, text-primary

## Cleanup - 2026-04-25

### Removed unnecessary elements:
- Search bar removed from home page (simpler UX for small pitch lists)
- Deleted dead components: NeonButton.svelte, NeonCard.svelte, NeonTextField.svelte
- Removed unused Icon imports from: admin/manage-users, admin/pitches, admin/users
- Removed console.warn/error from production: +layout.svelte (4), pitch/[id] (2), NextBookingCard (1)
- Removed invalid on:submit directive from Button.svelte
- Removed unused on:change/on:input event forwarding from TextField.svelte
- Removed sanitizeInput import from home page (no longer needed after search removal)
- save this , and next time u found it tell me , because i think there is another ways to bypass that allowed origin ,
- test incomplete , remember this , end tell me when u found read it again !
- test failds because we still dont upodate supabase functions
- last tests
