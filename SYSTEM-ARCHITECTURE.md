# SYSTEM ARCHITECTURE - Booking App

**Last updated:** 2026-04-25
**Status:** Active production system with security issues and incomplete features

---

## 1. USER TYPES & PERMISSIONS

### Roles (profiles.role)

| Role | DB Values | Access |
|------|-----------|--------|
| `student` | Default on signup | Browse pitches, book, manage own bookings |
| `admin` | Set by admin in manage-users | All student + admin pages (users, pitches, manage-users) |
| `moderator` | Exists in DB + admin dropdown | **NOTHING** - dead role, zero permissions |

### Profile Status (profiles.status)

| Status | Access Level | Page Redirected To |
|--------|-------------|-------------------|
| `pending` | Cannot book, limited access | `/pending-approval` (waiting message) |
| `approved` | Full access | `/home` |
| `rejected` | Cannot book, limited access | `/pending-approval` (shows rejection reason) |
| `suspended` | Previously approved, now blocked | Login redirects to `/home` but RLS blocks bookings |

### Auth Flow

```
Land on / → redirect to /login
  ↓
Register (name, email, student_id, password)
  ↓
DB trigger auto-creates profile (status=pending, role=student)
  ↓
Redirect to /verify-email
  ↓
User clicks email link → OTP verified → redirect to /login
  ↓
Login → check profile status:
  ├── pending  → /pending-approval (waiting message, logout only)
  ├── rejected → /pending-approval (shows rejection reason, logout only)
  ├── approved → /home (full access)
  └── suspended → /home but RLS blocks booking actions
```

### isAuthenticated Store Bug

`isAuthenticated` in `stores/auth.ts` returns `true` ONLY if `user.status === 'approved'`.
This means pending/rejected users have a session but `isAuthenticated` is `false`.
TopBar and SideNav check `$isAuthenticated` - pending/rejected users see NO nav links.

---

## 2. COMPLETE USER JOURNEYS

### New User → Approved

```
/ → /login → /register → fill form → supabase.auth.signUp()
  → DB trigger creates profile (pending)
  → /verify-email → click email link → /login
  → login → profile.status=pending → /pending-approval
  → (wait for admin)
  → admin approves → user logs in → /home
  → browse pitches → click pitch → /pitch/[id]
  → edge function generates slots → click available slot → BookingModal
  → confirm → insert into bookings → booking created
```

### Approved User Booking Flow

```
/home → see pitches → click pitch → /pitch/[id]
  → call available-slots edge function
  → see date tabs + slot grid
  → click available slot → BookingModal opens
  → confirm → supabase.from('bookings').insert({
      user_id, pitch_id, slot_datetime, status: 'active'
    })
  → DB triggers fire:
    ├── trg_enforce_booking_frequency (checks if user already booked within N days)
    ├── trg_prevent_past_booking (blocks past slots)
    ├── trg_upsert_booking_job (tries to create booking_jobs - fails if slot_datetime_end is NULL)
    ├── trg_check_booking_completion (auto-completes if slot_datetime_end < NOW)
    └── trg_cleanup_completed_on_query (deletes completed >7 days old)
  → success → show toast → close modal → refresh slots
```

### Admin Journey

```
/login → /home (admin sees Admin link in nav)
  ├── /admin/users → list pending profiles → approve/reject
  ├── /admin/manage-users → list all profiles → edit role, suspend, delete
  └── /admin/pitches → list pitches → CRUD pitches (no sport_type or booking_frequency UI)
```

### Rejected User

```
/login → profile.status=rejected → /pending-approval
  → shows "Registration Rejected" + rejection_reason
  → only action: logout
  → NO appeal mechanism, NO re-registration with same email/student_id (unique constraints)
```

---

## 3. DATABASE TABLES & RELATIONSHIPS

### profiles
- **PK**: id (FK to auth.users)
- **Columns**: student_id (unique), role, status, full_name, id_photo_url, verification_status, verification_notes, verified_by, verified_at, selfie_url, rejection_reason, created_at, updated_at
- **RLS**: User reads own row; admin reads all
- **Triggers**: auto-create on auth signup, updated_at timestamp, verification fields guard, email validation
- **Missing in UI**: ID photo upload, selfie upload, verification status display

### pitches
- **PK**: id
- **Columns**: name, location, capacity, open_time, close_time, sort_order, booking_frequency_days, booking_frequency_enabled, sport_type, created_at
- **RLS**: All authenticated read; admin only write
- **Missing in UI**: sport_type field, booking_frequency_days, booking_frequency_enabled in admin form

### slots (UNUSED TABLE)
- **PK**: id
- **Columns**: pitch_id, datetime_start, datetime_end, capacity, is_available, created_at
- **RLS**: All authenticated read; admin only write
- **Status**: Frontend uses VIRTUAL slots from edge function, never queries this table for booking display

### bookings
- **PK**: id
- **Columns**: user_id (FK profiles), slot_id (FK slots, nullable), pitch_id (FK pitches), slot_datetime, slot_datetime_end, status, created_at, updated_at
- **RLS**: User reads own; admin reads all. User inserts own (approved only). User updates own (restricted).
- **Triggers**: updated_at, upsert_booking_job, check_booking_completion, enforce_booking_frequency, prevent_past_booking, cleanup_completed
- **Unique**: idx_bookings_unique_slot (pitch_id + slot_datetime for active bookings)
- **Missing in UI**: Admin booking management page, cancelled_by, cancellation_reason

### booking_jobs
- **PK**: id
- **Columns**: booking_id (FK bookings), run_at, status, created_at, processed_at
- **RLS**: DENIED to all authenticated - only accessible via SECURITY DEFINER functions
- **Purpose**: Job queue for auto-completing bookings

### login_attempts
- **PK**: id
- **Columns**: student_id, attempted_at, success
- **RLS**: User reads own (via student_id); admin reads all; anyone can insert
- **Status**: Frontend NEVER writes to this table - dead data

### system_notifications
- **PK**: id
- **Columns**: key (unique), title_en, title_ar, message_en, message_ar, enabled, created_at, expires_at, updated_at
- **RLS**: All authenticated read (enabled only); admin only write
- **Missing in UI**: Entire notification system - no page, no banner, no admin CRUD

### user_dismissed_notifications
- **PK**: (user_id, notification_key) composite
- **Columns**: user_id (FK profiles), notification_key (FK system_notifications), dismissed_at
- **RLS**: User reads/writes own
- **Missing in UI**: No UI to dismiss notifications (no notification UI exists)

---

## 4. BOOKING FLOW - DETAILED

### Virtual Slot Generation (CURRENT system)

The `available-slots` edge function:
1. Fetches pitch (name, open_time, close_time)
2. Generates 1-hour slots from open_time to close_time for next 2 days
3. Fetches active bookings for the pitch
4. Marks slots unavailable if slot_datetime matches a booking
5. Returns slots with booker_name for booked slots (privacy concern)

**Slots table is NOT used for this.** Virtual slots are generated on-the-fly.

### Booking Creation Problem

Frontend inserts: `{ user_id, pitch_id, slot_datetime, status: 'active' }`

**Missing:**
- `slot_datetime_end` is NOT set
- `slot_id` is NULL (virtual slots)

**Consequences:**
- `trg_upsert_booking_job` can't determine run_at time → NO booking_jobs entry created
- `trg_check_booking_completion` can't check slot_datetime_end → NO auto-complete
- `auto_complete_past_bookings()` needs slot_datetime_end → doesn't work for these bookings
- Only `complete-bookings` edge function handles this (fallback: slot_datetime + 1hr)

**Result: Bookings from the frontend NEVER auto-complete unless the complete-bookings edge function is scheduled.**

### Booking Completion Mechanisms (3 competing)

| Mechanism | Trigger | Works for virtual slots? |
|-----------|---------|------------------------|
| `auto_complete_past_bookings()` | Called by available-slots edge fn | NO (needs slot_datetime_end) |
| `trg_check_booking_completion` | On INSERT/UPDATE | NO (needs slot_datetime_end) |
| `complete-bookings` edge fn | Needs cron scheduler | YES (uses slot_datetime + 1hr fallback) |

### Booking Cleanup

`trg_cleanup_completed_on_query` fires on EVERY booking INSERT/UPDATE:
- Deletes completed bookings older than 7 days
- Permanent deletion (no soft delete)
- Users lose booking history after 7 days
- Performance: every mutation triggers a cleanup scan

### Booking Frequency

Database columns exist: `booking_frequency_days`, `booking_frequency_enabled`
Functions created: `check_booking_frequency_eligible()`, `trg_enforce_booking_frequency`
**Admin form has NO UI for these settings** - can only be set via direct DB query.

---

## 5. EDGE FUNCTIONS

| Function | Used by Frontend? | Purpose | Status |
|----------|-------------------|---------|--------|
| `available-slots` | YES (pitch page) | Generate virtual slots | Critical, working |
| `bookings` | NO | CRUD proxy for bookings | DEAD CODE, security risk (service_role_key) |
| `process-booking-jobs` | NO | Process booking_jobs queue | Needs cron setup |
| `complete-bookings` | NO | Alternative completion | Needs cron setup |
| `login-by-student-id` | NO | Server-side student login | DEAD CODE, redundant |
| `get-signed-url` | NO | Signed URLs for id-photos bucket | DEAD CODE until upload UI exists |

### Booker Name Exposure

`available-slots` returns `booker_name` for booked slots.
`SlotCard.svelte` displays it: `<div>{slot.booker_name}</div>`
Any user can see WHO booked which slot. Privacy concern.

---

## 6. STORAGE BUCKETS

### id-photos
- **Purpose**: Store student ID photos for verification
- **DB support**: id_photo_url column, verification_status, verification_notes, verified_by, verified_at
- **Trigger**: profiles_verify_fields_guard protects verification fields
- **UI**: NONE - no upload, no preview, no admin review

### selfie_url
- Column exists in profiles
- No bucket configured, no UI, no verification flow

### Verification Flow (What exists vs needed)

| Component | Status |
|-----------|--------|
| DB columns | EXISTS |
| Storage bucket | EXISTS (id-photos) |
| Get-signed-url edge fn | EXISTS (unused) |
| Upload UI | MISSING |
| Admin verification dashboard | MISSING |
| Verification status display | MISSING |
| Selfie upload | MISSING entirely |

---

## 7. NOTIFICATION SYSTEM

| Component | Status |
|-----------|--------|
| system_notifications table | EXISTS with RLS |
| user_dismissed_notifications table | EXISTS with RLS |
| NotificationBadge component | EXISTS (never imported) |
| TopBar notification bell | EXISTS (links to /notifications) |
| /notifications page | MISSING |
| RPC functions (get_active_notifications_for_user, dismiss) | MISSING in migrations |
| Admin notification CRUD | MISSING |
| Notification banner on home | MISSING |

**100% infrastructure, zero frontend implementation.**

---

## 8. FUNCTIONS STATUS

### Database Functions

| Function | Active? | Notes |
|----------|---------|-------|
| create_profile_on_auth_signup | YES | Trigger on auth.users INSERT |
| update_updated_at_timestamp | YES | On profiles, bookings |
| is_admin / check_is_admin | YES | Used by RLS |
| is_approved | YES | Used by RLS |
| approve_profile | NO | Dead code - frontend updates directly |
| auto_complete_past_bookings | PARTIAL | Needs slot_datetime_end |
| trg_check_booking_completion | PARTIAL | Needs slot_datetime_end |
| process_booking_completion_jobs | EXISTS | Needs cron |
| upsert_booking_job | PARTIAL | Fails for virtual slots |
| cleanup_old_completed_bookings | YES | Fires on every mutation |
| profiles_verify_fields_guard | YES | Active |
| validate_profile_email | YES | Fixed with SECURITY DEFINER |
| is_valid_email | YES | Fixed regex |
| check_booking_frequency_eligible | YES | New function |
| trg_enforce_booking_frequency | YES | New trigger |
| trg_prevent_past_booking | YES | New trigger |
| trg_auto_complete_before_select | NO | Never attached as trigger |
| cleanup_old_login_attempts | UNCLEAR | May not exist |

---

## 9. MISSING UI PAGES

| Feature | DB Support | UI Status | Priority |
|---------|-----------|-----------|----------|
| Notifications page/banner | Full table + RLS | NONE | Medium |
| ID photo upload | id_photo_url + bucket | NONE | High |
| Selfie upload | selfie_url column | NONE | Low |
| Verification status display | verification_status | NONE | High |
| Admin verification dashboard | All verification columns | NONE | High |
| Admin booking management | bookings table | NONE | Medium |
| Sport type in pitch form | sport_type column | NONE | Low |
| Booking frequency settings | booking_frequency columns | NONE | Medium |
| Re-appeal for rejected users | rejection_reason column | NONE | Medium |
| Notification admin CRUD | system_notifications | NONE | Medium |

---

## 10. SECURITY ISSUES

| Issue | Severity | Fix Needed |
|-------|----------|------------|
| bookings edge fn uses service_role_key | CRITICAL | Add JWT auth or delete |
| 3 functions callable by anon users | CRITICAL | Revoke anon access |
| Bookings INSERT doesn't check approved status | CRITICAL | Re-add is_approved() to RLS |
| Bookings UPDATE allows any field change | HIGH | Restrict to status-only |
| 3 tables have no RLS | HIGH | Add RLS policies |
| Email validation trigger broken | HIGH | Add SECURITY DEFINER |
| Booker names exposed to all users | INTENTIONAL | Keep as-is (user confirmed) |
| Client-side admin checks only | MEDIUM | Add server-side guards |
| Moderator role does nothing | LOW | Remove from DB and UI |

---

## 11. CONFIRMED DESIGN DECISIONS (from user)

### Booker Names
- **Visible** to all users on booked slots (intentional feature, not a bug)
- No change needed to `available-slots` edge function or `SlotCard.svelte`

### Notifications
- Admins create/edit/delete notifications via admin page
- Shown as **banners on home page** (not a separate page)
- Users can **dismiss** banners - stored in `user_dismissed_notifications`
- Dismissed banners don't show again to that user
- Need: RPC functions for `get_active_notifications_for_user` and `dismiss_notification_for_user`
- Need: Admin CRUD page for managing notifications
- Need: Banner component on home page
- Note: This was already working in a previous version of the app, code was lost

### ID + Selfie Verification
- After registration, user must upload **ID photo + selfie**
- Photos auto-deleted after **7 days**
- Admin sees ID photo + selfie when approving/rejecting users
- Admin uses these to verify identity before approving
- Need: Upload UI on profile or a verification page
- Need: Admin view of uploaded photos in approval workflow
- Need: Auto-cleanup for old photos (7 days)

### moderator Role
- **REMOVE** - no permissions needed, not used
- Remove from DB CHECK constraint
- Remove from admin dropdown in manage-users

### login_attempts Table
- **REMOVE** - not used, just remove it
- Focus security efforts on proper auth, session management, and rate limiting instead

### slots Table
- **KEEP but don't delete** - intentionally unused (virtual slots are better for performance)
- Virtual slots generated on-the-fly by edge function, only stored when booked

### Booking Frequency
- **REQUIRED** - user must wait N days after a successful booking before booking again
- Set by admin per pitch via `booking_frequency_days` and `booking_frequency_enabled`
- Already enforced by DB trigger (from latest migration)
- Need: Admin UI to configure these settings in pitch form

### Booking Completion & Cleanup
- Keep current auto-complete mechanism
- Can improve the cron job setup later
- Don't delete current mechanism

---

## 12. KEY PROBLEMS TO FIX
