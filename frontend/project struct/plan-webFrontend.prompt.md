# Plan: Build Svelte Web Frontend from Android UX

**Status**: Planning Phase - Ready for Implementation

---

## DISCOVERY FINDINGS

### Android App Architecture
- **Navigation**: Bottom navigation with 4 main sections (Home, Bookings, Profile, Admin)
- **Design System**: Neon aesthetic (dark background + gradient borders + glass effects)
- **Layout**: Card-based, mobile-first responsive design
- **Components**: NeonButton, NeonCard, NeonTextField, NeonTopAppBar, SlotCard, etc.
- **Features**: Auth (email/student ID), pitch browsing, slot booking, profile, admin dashboard

### Old Frontend (React) - Feature Reference ONLY
- **DO USE**: Page structure, API integrations, state management patterns, form validation
- **DO NOT USE**: React/CSS styling, UI components, visual design

### Backend Architecture (Already Built)
- **Supabase Edge Functions**: available-slots, login-by-student-id, bookings, get-signed-url, process-booking-jobs
- **Database**: profiles, pitches, bookings, booking_jobs tables
- **Auth Flow**: Email/Student ID login → Approve/Reject status → Home/PendingApproval
- **Virtual Slots**: Generated real-time, no pre-creation

### Tech Stack Choice: Svelte + Skeleton
- Reference: https://www.skeleton.dev/docs/svelte/get-started/installation
- https://www.skeleton.dev/docs/svelte/get-started/installation/vite-svelte#requirements

- **Why**: Component-based, lightweight, strong forms/UI library, Tailwind built-in, TypeScript support
- **Skeleton UI**: Pre-built accessible components matching modern design standards

---

## SCOPE & DECISIONS

**What's Included**:
- ✅ Complete user authentication (email + student ID modes)
- ✅ Password reset flow (forgot/reset)
- ✅ Email verification on signup
- ✅ Home dashboard (pitches, next booking, notifications)
- ✅ Booking system (browse slots, create/cancel bookings)
- ✅ User profile (view/edit, student ID locked after approval)
- ✅ Admin dashboard (user approvals, pitch CRUD, user management)
- ✅ Notification badge system
- ✅ Internationalization (English/Arabic)
- ✅ Dark mode support (Skeleton has built-in theme system)
- ✅ Responsive mobile-first design

**What's Excluded**:
- ❌ Old React frontend code/styling
- ❌ Pre-created slots (virtual slots only)
- ❌ OTP-based auth (not used in Android)
- ❌ Verification photo upload (separate phase)
- ❌ Email subscription management

**Key Decisions**:
1. **Svelte App Kit** for routing (file-based, like Next.js)
2. **Skeleton UI** for component library (100% accessibility + dark mode)
3. **Tailwind CSS** for styling (built into Skeleton)
4. **SvelteStore** for global state (auth, notifications, theme)
5. **Mimic Android UX** visually (card-based, bottom nav mobile, responsive)
6. **Share API integrations** with React old frontend (no breaking changes)

---

## TL;DR APPROACH

1. **Setup**: Create Svelte App Kit project with Skeleton UI, Tailwind, i18n, Supabase client
2. **Layout**: Build persistent bottom nav for mobile, sidebar for desktop, shared top bar
3. **Authentication**: Implement login/register/reset flows (reuse old frontend's API calls)
4. **Core Pages**: Home, Bookings, Profile, Admin with state management
5. **Components**: Card system, slot cards, pitch cards, loading skeletons (inspired by Android)
6. **Testing**: E2E with Playwright, manual testing on mobile

---

## IMPLEMENTATION STEPS

### Phase 0: OWASP Security Setup *(Integrated throughout project)*

**CRITICAL:** Security is integrated into every phase, not a separate task. The following security measures must be implemented from day 1:

#### **Frontend Security (Client-Side)**

1. **Input Sanitization & Validation** `src/lib/validation.ts`
   - Install: `npm install dompurify isomorphic-dompurify zod`
   - Create sanitization functions:
     - `sanitizeInput(text)` - Remove HTML/script tags using DOMPurify
     - `sanitizeEmail(email)` - Validate email format regex
     - `sanitizeStudentId(id)` - Remove special chars, alphanumeric only
     - `sanitizeName(name)` - Remove tags, limit length (max 100 chars)
     - `sanitizeDescription(desc)` - Remove script/iframe tags, allow limited HTML
   - Use on ALL form inputs: names, emails, search queries, etc.
   - Validate on both frontend AND backend (never trust frontend)
   - Schema validation using `zod` for all API requests/responses
   - *Task*: Create validation library with unit tests

2. **Cross-Site Scripting (XSS) Protection**
   - ✅ Svelte auto-escapes by default (but only in templates)
   - ✅ Use `{@html ...}` ONLY for sanitized/trusted content
   - ❌ NEVER use `{@html userContent}` - always sanitize first
   - Add Content Security Policy (CSP) headers (see backend below)
   - Use `sanitize()` before rendering any user-generated content
   - Template bind values: Always escape user data in attributes
   - *Task*: Code review all `{@html}` usages, add CSP headers to `svelte.config.js`

3. **CSRF Token Implementation**
   - Install: `npm install js-cookie`
   - Generate CSRF token on login, store in cookie + memory
   - Attach token to all POST/PUT/DELETE requests in `X-CSRF-Token` header
   - Backend validates token before processing mutations
   - Token rotates on successful auth
   - *Task*: Add CSRF middleware to `src/lib/api.ts`, attach to all mutation requests

4. **Secure Data Storage**
   - Auth token: Store in `httpOnly` cookie (via Supabase, already configured)
   - Session data: Store ONLY in memory (avoid localStorage for sensitive data)
   - Never store passwords, API keys, sensitive user info locally
   - Clear all stored data on logout
   - *Task*: Audit all uses of `localStorage` and `sessionStorage`

5. **Rate Limiting (Client-Side)**
   - Install: `npm install bottleneck`
   - Implement debouncing for API calls (max 1 request per 500ms)
   - Prevent duplicate submissions: Disable button after click until response
   - Track failed login attempts: Lock form after 5 failures for 15 minutes
   - *Task*: Add rate limiting wrapper to API calls in `src/lib/api.ts`

6. **HTTPS Enforcement**
   - Force HTTPS redirect in `svelte.config.js`
   - Set `Strict-Transport-Security` header (handled by Vercel)
   - All API calls must use `https://` URLs (never `http://`)
   - *Task*: Verify all edge function URLs start with `https://`

7. **Dependency Security Scanning**
   - Add `npm audit` to pre-commit hook
   - Setup GitHub dependabot: Enable auto-PRs for vulnerabilities
   - Regularly run `npm audit fix` and test
   - Pin exact versions for critical deps: Supabase, auth libraries
   - *Task*: Setup pre-commit hook with `husky` and `npm audit`

#### **Backend Security (Edge Functions)**

8. **Backend Input Validation** `supabase/functions/*/index.ts`
   - Validate ALL incoming params and body data
   - Reject requests with invalid/missing fields immediately
   - Use Supabase SDK's built-in prepared queries (already using)
   - Validate types: String length limits, number ranges, enum values
   - Reject oversized payloads (max 1MB)
   - *Task*: Add input validation middleware to all edge functions

9. **Rate Limiting (Server-Side)**
   - Install rate limiter library in edge functions (e.g., `redis` based)
   - Limit per IP: 100 requests per minute
   - Limit per user: 50 API calls per minute
   - Limit per endpoint: login attempts (5/minute), bookings (10/minute)
   - Return 429 Too Many Requests when limit exceeded
   - *Task*: Implement rate limiting in edge functions (requires Redis setup or Upstash)

10. **SQL Injection Protection**
    - ✅ Using Supabase SDK's parameterized queries (automatic)
    - ✅ RLS policies enforced at database level
    - ✅ Never concat user input directly into SQL
    - Validate inputs before query (type + length checks)
    - *Task*: Code review edge functions for any dynamic SQL, ensure parameterized

11. **Authentication & Authorization**
    - ✅ Supabase auth handles password hashing (bcrypt)
    - ✅ JWT tokens validated on each request
    - ✅ RLS policies restrict data access by role
    - Add: User role checks on admin endpoints (double-check in code)
    - Add: Verify user ID matches auth token (prevent ID spoofing)
    - Implement: Session timeout (auto-logout after 30 min inactivity)
    - *Task*: Add role verification middleware to admin endpoints

12. **CORS Configuration** `supabase/functions/*/index.ts`
    - ❌ CURRENT: Overly permissive `"Access-Control-Allow-Origin": origin`
    - ✅ FIX: Whitelist only known origins:
      ```typescript
      const allowedOrigins = [
        'https://booking.example.com',
        'https://app.example.com',
        'http://localhost:3000' // dev only
      ]
      const origin = req.headers.get('origin')
      const isAllowed = allowedOrigins.includes(origin)
      const corsOrigin = isAllowed ? origin : allowedOrigins[0]
      ```
    - Explicitly allow only needed HTTP methods
    - Set `Access-Control-Max-Age` to 1 day
    - *Task*: Update CORS headers in all edge functions

13. **Security Headers**
    - Add to `svelte.config.js` or Vercel config:
      - `Content-Security-Policy`: Restrict script/style sources
      - `X-Content-Type-Options`: nosniff (prevent MIME sniffing)
      - `X-Frame-Options`: DENY (prevent clickjacking)
      - `Referrer-Policy`: strict-origin-when-cross-origin
      - `Permissions-Policy`: Disable unnecessary browser features
    - *Task*: Add security headers config to project

14. **Secrets Management**
    - ✅ All secrets in environment variables (not hardcoded)
    - ✅ Vercel / Supabase handle secret storage
    - Setup local `.env.local` (never commit)
    - Use `.env.example` for documentation
    - Rotate API keys quarterly
    - Setup different keys for dev/staging/production
    - *Task*: Document secrets in `.env.example`, setup env validation

#### **Database Security**

15. **Row Level Security (RLS)** *(Already implemented, audit)*
    - ✅ RLS policies exist on profiles, pitches, bookings, slots
    - Audit: Verify policies enforce intended access rules
    - Test: Non-admin users cannot access admin data
    - Test: Users cannot modify others' bookings/profile
    - Add: Policies for new tables if any added
    - *Task*: Review all RLS policies in `migrations/20251217120100_rls_policies.sql`

16. **Encryption at Rest**
    - ✅ Supabase PostgreSQL encrypts data at rest (default)
    - Verify: Database is backed up and encrypted
    - Consider: Encrypting sensitive fields (email, student ID) with `pgcrypto` if needed
    - *Task*: No action required (handled by Supabase)

#### **Monitoring & Logging**

17. **Request Logging**
    - Add logging to edge functions: Log all API calls with timestamp, user ID, endpoint, response status
    - Monitor for: Failed auth attempts, rate limit hits, errors
    - Setup Vercel/Supabase logs dashboard
    - *Task*: Add structured logging to edge functions

18. **Error Handling**
    - Never expose internal error details to frontend
    - Return generic error messages: "Something went wrong"
    - Log full error to server logs (for debugging)
    - Include error ID in response (link frontend error to server log)
    - *Task*: Standardize error responses across app

---

### Phase 1: Foundation Setup *(Parallel independent tasks)*

1. **Initialize Svelte App Kit project**
   - Create new project: `npm create svelte@latest new-frontend-web`
   - Install Skeleton UI: `npm install -D @skeletonlabs/tw-plugin`
   - Configure Tailwind + Skeleton theme
   - Setup TypeScript strict mode
   - *Dependency*: Must complete before Phase 2

2. **Setup Supabase client & auth context**
   - Create `lib/supabaseClient.ts` (reuse pattern from old frontend)
   - Create `lib/stores/auth.ts` - SvelteStore for user session, profile, role
   - Create `lib/stores/ui.ts` - Global UI state (theme, language, notifications)
   - Import & configure Supabase SDK
   - *Parallel with step 1*

3. **Setup i18n (English/Arabic)**
   - Install `svelte-i18n`
   - Create locale files: `src/locales/en.json`, `src/locales/ar.json`
   - Setup language switcher component
   - Setup RTL support for Arabic
   - *Parallel with step 1*

4. **Setup routing structure**
   - Create layout: `src/routes/+layout.svelte` (app shell with nav, theme toggle, language selector)
   - Create routes:
     - `/(auth)/login/+page.svelte`
     - `/(auth)/register/+page.svelte`
     - `/(auth)/verify-email/+page.svelte`
     - `/(auth)/forgot-password/+page.svelte`
     - `/(auth)/reset-password/+page.svelte`
     - `/(app)/home/+page.svelte`
     - `/(app)/bookings/+page.svelte`
     - `/(app)/profile/+page.svelte`
     - `/(app)/admin/users/+page.svelte` (admin only)
     - `/(app)/admin/pitches/+page.svelte` (admin only)
     - `/(app)/admin/manage-users/+page.svelte` (admin only)
     - `/(app)/pending-approval/+page.svelte`
   - Setup route guards for authentication
   - *Dependency*: Requires step 2 (auth store)*

---

### Phase 2: Authentication System

5. **Build login page** (email + student ID modes)
   - Form with mode toggle (segmented button: Email / Student ID)
   - Input fields: email/student_id + password
   - Validation: Email format, password length
   - Submit: Call `lib/auth.ts` → `loginWithEmail()` or `loginWithStudentId()` edge function
   - Handle: Success → redirect to `/home`, Error → show toast
   - Handle: Status `pending` → redirect to `/pending-approval`
   - *Dependency*: Phase 1 steps 2, 4; Phase 2 step 6*

6. **Build auth service functions** `lib/auth.ts`
   - `loginWithEmail(email, password)` → Supabase auth
   - `loginWithStudentId(studentId, password)` → Edge function `login-by-student-id`
   - `register(email, studentId, fullName, password)` → Supabase auth + profile insert
   - `logout()` → Clear session
   - `resetPassword(email)` → Supabase password reset
   - `updatePasswordWithToken(token, password)` → Supabase
   - `verifyEmail(token)` → Check email verification
   - *Parallel with step 5*

7. **Build register page**
   - Form fields: Full Name, Email, Student ID, Password, Confirm Password
   - Validation: Email unique check, password strength, student ID format
   - Submit: Call `register()` from lib/auth
   - Success: Send verification email → redirect to `/verify-email`
   - *Dependency*: Phase 2 step 6*

8. **Build email verification page**
   - Display: "Check your email for verification link"
   - Auto-check on load if token in URL → `verifyEmail(token)` → redirect to `/login` if success
   - Resend option: Call auth service
   - *Dependency*: Phase 2 step 6*

9. **Build forgot password & reset password pages**
   - **Forgot Password**: Email input → Call `resetPassword(email)` → Show success message
   - **Reset Password**: Password + confirm fields → Call `updatePasswordWithToken()` → redirect to `/login`
   - Both pages handle URL tokens from email links
   - *Dependency*: Phase 2 step 6*

10. **Build pending approval page**
    - Display: "Your account is pending admin approval" with user info
    - Auto-redirect if status changes to `approved` (poll auth store)
    - Show rejection reason if status = `rejected`
    - *Dependency*: Phase 1 step 4*

---

### Phase 3: Layout & Navigation

11. **Build app layout shell** `src/routes/+layout.svelte`
    - Determine user auth status from auth store
    - If NOT authenticated → show auth layout (no nav)
    - If authenticated:
      - Desktop (≥1024px): Sidebar nav + top bar + main content
      - Mobile (<1024px): Bottom nav + top bar + main content
    - Top bar: Logo, notification badge (count), user menu (profile, logout)
    - Bottom nav (mobile): Home, Bookings, Profile, Admin (with admin check)
    - Sidebar (desktop): Same navigation, vertical
    - Theme toggle in top bar
    - Language selector in top bar
    - Responsive breakpoints: Tailwind's `md:` and `lg:`
    - *Dependency*: Phase 1 steps 1, 2, 4; Phase 3 step 12*

12. **Build reusable navigation components**
    - `<BottomNav>` - Mobile nav component with active state indicator
    - `<Sidebar>` - Desktop nav component
    - `<TopBar>` - Header with logo, notifications, user menu
    - `<NotificationBadge>` - Shows unread notification count
    - `<LanguageSelector>` - i18n language dropdown
    - `<ThemeToggle>` - Dark/light mode switcher
    - *Parallel with step 11*

---

### Phase 4: Core Pages - Dashboard & Bookings

13. **Build Home page** `(app)/home/+page.svelte`
    - Load: `<script>` → `onMount()` → fetch pitches + next booking + notifications
    - Top section: "Next Booking" card (if exists) showing pitch name, time, countdown
    - Middle section: "Available Pitches" grid (card-based)
      - Each pitch card: Name, location, icon (based on sport), open hours, action button
      - Click → navigate to pitch details page
    - Bottom section: Recent notifications (optional)
    - Loading state: Skeleton placeholders for cards
    - Error handling: Toast notification + retry button
    - *Dependency*: Phase 3 step 11*

14. **Build Pitch Details page** `(app)/pitch/[id]/+page.svelte`
    - Route param: `[id]` = pitch ID from URL
    - Load: Fetch pitch details + available slots (call `available-slots` edge function)
    - Display: Pitch info header (name, location, capacity, hours)
    - Slot browser: Grid/list of slots grouped by date
      - Each slot card: Time range, availability status (green if available, red if booked)
      - Show booker name if booked (optional)
      - Hover effect: Show confirmation button
    - Selected slot: Highlight with confirmation dialog
    - Dialog: Show booking summary + cancel/confirm buttons
    - Submit: Call `bookings` edge function → success toast → redirect to `/bookings`
    - Error handling: Show conflict error if slot taken
    - Loading state: Skeleton for slots list
    - *Dependency*: Phase 3 step 11; needs `available-slots` edge function*

15. **Build Bookings page** `(app)/bookings/+page.svelte`
    - Load: Fetch user's bookings (filter by status)
    - Tabs/filter: Active, Completed, Cancelled
    - Each booking card:
      - Pitch name, date/time, status badge
      - For active bookings: Cancel button with confirmation
      - For past bookings: Show completed status
    - Empty state: "No bookings yet" with link to `/home`
    - Optimistic updates: Remove from list immediately on cancel, restore if error
    - Loading skeleton for list
    - *Dependency*: Phase 3 step 11*

---

### Phase 5: User Profile & Admin

16. **Build Profile page** `(app)/profile/+page.svelte`
    - Load: Fetch current user profile from auth store
    - Display section:
      - Avatar/initials, full name, email, student ID (read-only after approval)
      - Role badge (Student/Admin)
      - Approval status badge
    - Edit section (if approved):
      - Modal/form to edit: Full Name, Email (optional)
      - Save button: Call update profile API
      - Validation: Email format, required fields
    - Actions:
      - Change password link → modal with old + new password
      - Logout button
      - Delete account (optional, hidden by default)
    - Error/success toasts
    - *Dependency*: Phase 3 step 11; Phase 5 step 17*

17. **Build admin user approval page** `(app)/admin/users/+page.svelte` *(admin only)*
    - Load: Fetch pending user applications
    - List: User cards showing email, student ID, full name, status
    - Actions: Approve/Reject buttons with confirmation dialogs
    - Reject modal: Text field for rejection reason
    - Submit: Call admin update user API
    - Toast: Success/error feedback
    - Auto-refresh list after action
    - Pagination: If many users pending
    - *Dependency*: Phase 3 step 11; admin role check*

18. **Build admin pitch management** `(app)/admin/pitches/+page.svelte` *(admin only)*
    - Load: Fetch all pitches
    - List: Pitch cards with name, location, hours, actions
    - Actions: Edit, Delete buttons
    - Create: "Add Pitch" button → modal with form
    - Edit modal:
      - Fields: Name, Location, Capacity, Open Time, Close Time
      - Booking frequency toggle + days input
      - Sort order input
    - Submit: Create/update pitch API
    - Delete: Confirmation → API call
    - Toast feedback
    - *Dependency*: Phase 3 step 11; admin role check*

19. **Build admin user management** `(app)/admin/manage-users/+page.svelte` *(admin only)*
    - Load: Fetch all users with status
    - List: User cards with email, student ID, role, status, actions
    - Actions: Edit role, Suspend/Unsuspend, Delete
    - Edit modal: Change role dropdown
    - Submit: Update user API
    - Toast feedback
    - *Dependency*: Phase 3 step 11; admin role check*

---

### Phase 6: State Management & Utils

20. **Build SvelteStore state management**
    - `src/lib/stores/auth.ts`:
      - `user` store: { id, email, studentId, role, status, fullName }
      - `isAuthenticated` derived store
      - `isAdmin` derived store
      - Functions: `setUser()`, `clearUser()`, `updateProfile()`
    - `src/lib/stores/ui.ts`:
      - `theme` store: 'light' | 'dark'
      - `language` store: 'en' | 'ar'
      - `toastQueue` store: { id, message, type, duration }[]
      - Functions: `showToast()`, `toggleTheme()`, `setLanguage()`
    - `src/lib/stores/notifications.ts`:
      - `unreadCount` store
      - `notifications` store: array of notification objects
      - Functions: `fetchNotifications()`, `markAsRead()`
    - *Parallel development with earlier phases*

21. **Build API service functions** `src/lib/api.ts`
    - **Pitches**: `fetchPitches()`, `fetchPitchById()`, `createPitch()`, `updatePitch()`, `deletePitch()`
    - **Bookings**: `fetchBookings()`, `createBooking()`, `cancelBooking()`
    - **Slots**: `fetchAvailableSlots(pitchId)` (calls edge function)
    - **Admin**: `fetchPendingUsers()`, `approvePendingUser()`, `rejectPendingUser()`, `updateUserRole()`, `suspendUser()`
    - **Notifications**: `fetchNotifications()`, `markNotificationAsRead()`
    - All functions: Proper error handling, type-safe returns
    - *Parallel with earlier phases*

22. **Build UI utility components & helpers**
    - `<Loading>` - Spinner component
    - `<SkeletonCard>` - Placeholder card for loading
    - `<SkeletonText>` - Placeholder text shimmer
    - `<Toast>` - Toast notification (auto-dismiss)
    - `<ToastContainer>` - Renders toasts from store
    - `<Modal>` - Reusable modal wrapper
    - `<ConfirmDialog>` - Confirmation modal template
    - `formatTime()`, `formatDate()`, `getDayName()` - Date helpers
    - `cn()` - Tailwind class merging utility
    - *Parallel with earlier phases*

---

### Phase 7: Styling & Theme

23. **Configure Skeleton UI theme**
    - Customize Skeleton's theme to match Android neon aesthetic (within Skeleton's design system)
    - Define color palette:

Primary:
Teal Green — #1AA39A
(Used for headers, buttons, and main branding)
Secondary:
Soft Mint — #7ED1C6
(Used for accents, gradients, and illustrations)
Surface:
Light Gray / Off-White — save the current dark background (#07080b) for dark mode
(Background of cards, input fields, and screens)
Error:
Coral Red — #E74C3C
(For validation errors or alerts)
Success:
Fresh Green — #2ECC71
(For confirmations, success messages)
    - Configure in `tailwind.config.ts`
    - Setup dark mode toggle (Skeleton's native support)
    - *Dependency*: Phase 1 step 1*

24. **Build card & component styling**
    - Create Skeleton-based card variants (elevated, outlined, filled)
    - Style slot cards: Time, availability badge, click state
    - Style pitch cards: Image/icon, name, hours
    - Style booking cards: Pitch info, time, status, actions
    - Style form inputs: Leading/trailing icons, validation states
    - Style buttons: Primary, secondary, danger variants
    - Responsive spacing & sizing
    - *Dependency*: Phase 7 step 23*

25. **Implement responsive layout**
    - Mobile-first design using Tailwind
    - Breakpoints: Mobile (<640px), Tablet (640-1024px), Desktop (>1024px)
    - Bottom nav hides on desktop (sidebar shows)
    - Cards: 1 column on mobile, 2-3 columns on tablet/desktop
    - Forms: Full width on mobile, constrained on desktop
    - Touch-friendly: Minimum 44px tap targets
    - Test on device/browser DevTools
    - *Dependency*: Phase 7 step 24*

---

### Phase 8: Testing & Refinement

26. **Setup testing framework**
    - Install Vitest + SvelteKit testing utilities
    - Install Playwright for E2E testing
    - Create `tests/` directory structure
    - Setup CI/CD (GitHub Actions) to run tests on push
    - *Optional but recommended*

27. **Write unit tests** *(optional, high-value)*
    - Auth service functions (login, register, logout)
    - API service functions (fetch, create, update, delete)
    - Store mutations (setUser, setTheme, etc.)
    - Date/time helpers
    - Validation functions
    - *Dependency*: Phase 8 step 26*

28. **Write E2E tests** *(optional, critical paths)*
    - Login → Home → Browse Pitch → Book Slot
    - Register → Verify Email → Login
    - Admin: Approve pending user → Manage pitches
    - Cancel booking flow
    - *Dependency*: Phase 8 step 26*

29. **Manual testing & refinement**
    - Test on mobile (Chrome DevTools, actual devices)
    - Test on desktop (Chrome, Firefox, Safari)
    - Test dark/light theme toggle
    - Test English/Arabic language switching
    - Test error states (network errors, API failures)
    - Test loading states (skeleton placeholders)
    - Verify form validation
    - Check accessibility (keyboard navigation, screen readers)
    - Performance profiling: Lighthouse scores
    - *Depends on: All previous phases*

---

### Phase 9: Deployment & Polish

30. **Build & optimize for production**
    - Run `npm run build` → Check for errors
    - Analyze bundle size: `npm run build -- --verbose`
    - Code splitting verification
    - Image optimization (if applicable)
    - CSS/JS minification (Svelte does this automatically)
    - Remove any console.log debug statements
    - Setup `.env` for production Supabase URL
    - *Depends on: All phases*

31. **Deploy to hosting** (Vercel recommended)
    - Connect Git repo to Vercel
    - Configure environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
    - Set build command: `npm run build`
    - Set output directory: `.svelte-kit/build`
    - Deploy → Test live
    - Setup custom domain if applicable
    - *Depends on: Phase 9 step 30*

32. **Final polish & documentation**
    - Add loading animations/transitions (fade-in/out)
    - Verify all error messages are user-friendly
    - Add keyboard shortcuts (optional: K to open command palette)
    - Create README with setup/deploy instructions
    - Document API integration points
    - Document component usage examples
    - *Depends on: All phases*

---

## RELEVANT FILES TO REFERENCE

### To Create (New Svelte App)
- `src/routes/+layout.svelte` — App shell with persistent nav
- `src/routes/(auth)/login/+page.svelte` — Login form
- `src/routes/(auth)/register/+page.svelte` — Register form
- `src/routes/(app)/home/+page.svelte` — Home dashboard
- `src/routes/(app)/bookings/+page.svelte` — User bookings list
- `src/routes/(app)/pitch/[id]/+page.svelte` — Pitch detail & slot booking
- `src/routes/(app)/profile/+page.svelte` — User profile
- `src/routes/(app)/admin/**` — Admin pages (3 files)
- `src/lib/auth.ts` — Authentication functions
- `src/lib/api.ts` — API service layer
- `src/lib/stores/auth.ts` — Auth state store
- `src/lib/stores/ui.ts` — UI state store
- `src/lib/stores/notifications.ts` — Notifications state
- `src/components/BottomNav.svelte` — Mobile nav
- `src/components/Sidebar.svelte` — Desktop nav
- `src/components/TopBar.svelte` — Header bar
- `src/components/Toast.svelte` — Toast notification
- `src/components/Modal.svelte` — Reusable modal
- Additional UI components: SkeletonCard, Loading, etc.
- `src/locales/en.json` — English i18n
- `src/locales/ar.json` — Arabic i18n
- `tailwind.config.ts` — Tailwind + Skeleton config
- `svelte.config.js` — Svelte App Kit config

### To Adapt (From Old Frontend)
- Reference `old-bad-frontend/src/lib/auth.ts` — Auth functions (adapt logic only)
- Reference `old-bad-frontend/src/locales/` — i18n JSON (copy & update)
- Reference `old-bad-frontend/src/types/database.ts` — TypeScript types (copy)

### Reference Patterns
- Reference `old-bad-frontend/src/context/AuthContext.tsx` — State management pattern (adapt to SvelteStore)
- Reference `old-bad-frontend/src/pages/Home.tsx` — Feature structure
- Reference `booking/db/next-app/` — Next.js template (if you want to check env setup)

---

## VERIFICATION CHECKLIST

### Build Verification
1. ✅ `npm run dev` starts without errors
2. ✅ All routes accessible and rendering
3. ✅ Auth flow works: Register → Verify → Login → Home
4. ✅ Logout clears session and redirects to login
5. ✅ Protected routes redirect unauthenticated users to login

### Feature Verification
6. ✅ Home page loads pitches and shows next booking
7. ✅ Can browse pitch details and view available slots
8. ✅ Can create booking → appears in /bookings
9. ✅ Can cancel booking → removed from list (optimistic)
10. ✅ Can edit profile → name updates reflected

### Admin Verification
11. ✅ Non-admin users cannot access /admin routes
12. ✅ Admin can approve/reject pending users
13. ✅ Admin can create, edit, delete pitches
14. ✅ Admin can manage user roles

### UI/UX Verification
15. ✅ Bottom nav appears on mobile (<1024px)
16. ✅ Sidebar appears on desktop (≥1024px)
17. ✅ Dark/light theme toggle works
18. ✅ Language toggle switches English/Arabic (with RTL)
19. ✅ Loading skeletons show during data fetch
20. ✅ Toast notifications appear for success/error
21. ✅ Mobile form inputs are 44px+ tap targets
22. ✅ Responsive images/cards adjust to screen size

### Performance
23. ✅ Lighthouse score >80
24. ✅ First Contentful Paint <2s
25. ✅ No console errors in production build
26. ✅ Network requests batched (no N+1)

---

## KEY DECISIONS

1. **Tech Stack**: Svelte App Kit + Skeleton UI + Tailwind CSS
   - Rationale: Lightweight, modern, component-based, excellent TypeScript support, built-in i18n ecosystem
   
2. **State Management**: SvelteStore (built-in)
   - Rationale: Simple, reactive, no external dependency, idiomatic Svelte
   
3. **Styling Approach**: Skeleton UI components + Tailwind utilities
   - Rationale: Avoids recreating components from scratch, ensures accessibility, matches modern web standards
   
4. **Navigation Pattern**: Bottom nav (mobile) + Sidebar (desktop)
   - Rationale: Mirrors Android app, proven mobile-first UX pattern, responsive
   
5. **API Integration**: Keep edge functions as-is, call via HTTP
   - Rationale: No backend changes, frontend-only task, reuses tested integrations
   
6. **Reuse from Old Frontend**: Auth logic, API patterns, i18n files (code, NOT styling)
   - Rationale: Avoids reinventing wheel, maintains consistency with existing backend

---

## SCOPE EXCLUSIONS *(Deliberately Out of Scope)*

- ❌ Verification photo upload/ID document management (future phase)
- ❌ Email subscription/notification preferences (can be added post-launch)
- ❌ Analytics/usage tracking (nice-to-have, not critical)
- ❌ PWA support (optional enhancement)
- ❌ Internationalization beyond English/Arabic (extensible if needed)

---

## FURTHER CONSIDERATIONS

1. **Backend Breaking Changes?** → No, all edge functions remain unchanged. Frontend is purely additive.

2. **Old Frontend Deprecation?** → Once new frontend is live and tested, old React frontend can be archived/removed. For now, recommend keeping it as backup.

3. **Data Migration?** → No database changes needed. Virtual slots are generated on-demand by existing edge functions.

---

## REFINEMENT NOTES

*Use this section to track changes and improvements to the plan as you review it.*

- [ ] Phase dependencies validated?
- [ ] All critical features covered?
- [ ] Testing strategy adequate?
- [ ] Deployment plan clear?
- [ ] Any risks identified?
- [ ] Team/resource dependencies documented?

