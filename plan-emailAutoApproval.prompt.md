# Plan: @usmba.ac.ma Email Verification Auto-Approval

## TL;DR
Keep student_id field. Add requirement: email must be `@usmba.ac.ma`. Replace manual admin approval with automatic approval on email verification. Flow: Register → Verify Email → Auto-Approved → Book.

---

## Changes

### 1. Database (Supabase/Postgres)

**Remove from profiles table:**
- `id_photo_url`, `selfie_url` columns (photo verification no longer needed)
- `verification_status` column (not used)
- `verification_notes`, `verified_by`, `verified_at` columns

**Keep:**
- `student_id` (required, unique)
- `status` column (pending → approved on email verification)

**Update `create_profile_on_auth_signup()`:**
- Set `status='pending'` on signup
- Add trigger `on_email_verification()`: when email verified → `status='approved'`

---

### 2. Frontend Auth & Registration

#### File: `frontend/src/routes/(auth)/register/+page.svelte`

**Keep:**
- Student ID field + validation (lines 171-186, 48-51) — no changes

**Add:**
```ts
$: emailUsmba = email.endsWith('@usmba.ac.ma') || email.length === 0
$: emailUsmbaValid = emailUsmba  // Reactive for UI feedback
```

**Update form validation:**
```ts
if (!fullName || !email || !studentId || !password || !confirmPassword) return false
if (!email.endsWith('@usmba.ac.ma')) return false  // NEW: enforce @usmba.ac.ma
if (!isValidStudentId(studentId.toUpperCase())) return false  // KEEP: existing validation
```

**Update submit handler (line 94):**
```ts
const result = await register(cleanEmail, cleanPassword, cleanStudentId, cleanFullName)
// Signature unchanged — keep student_id parameter
```

#### File: `frontend/src/routes/(auth)/login/+page.svelte`

**No changes** — keep existing login (student_id tab optional; email/password login primary)

---

### 3. Remove Verification Features

**Delete these files/features:**
- `frontend/src/routes/(app)/profile/verification/` (photo verification UI)
- `frontend/src/lib/components/VerificationStatus.svelte` (not needed)
- `frontend/src/lib/components/PhotoThumbnail.svelte` (not needed)
- All photo upload logic from profile page
- All admin photo review functionality

**Keep simple:**
- User registers with email + student_id
- Verify email in inbox
- Auto-approved
- Done

---

### 4. Remove from Profile Page

**Delete from `frontend/src/routes/(app)/profile/+page.svelte`:**
- Photo upload section (id_photo, selfie)
- Verification status display
- Verification notes display
- All photo-related validation

**Keep:**
- Full name
- Student ID
- Email
- Password change

### 5. Update Admin Pages

**Remove from `frontend/src/routes/(app)/admin/users/+page.svelte`:**
- Photo thumbnail display
- Photo verification workflow
- Approval/rejection of photos

**Keep:**
- User list
- Status (pending/approved/rejected)
- Ability to manually approve/reject (by status, no photos)

---

## Implementation

### Phase 1: Database
- Add `on_email_verification()` trigger (auto-approve on email verified)
- Remove photo columns (id_photo_url, selfie_url, verification_status, etc.)

### Phase 2: Frontend Cleanup
- Delete photo verification components
- Remove photo upload from profile page
- Remove photo review from admin page
- Register: add @usmba.ac.ma validation (keep student_id)

### Phase 3: Testing
- ✅ Register: email + student_id
- ✅ Verify email in inbox
- ✅ Auto-approved → `/home`
- ✅ Can book immediately

---

## Removed (Simplified)

❌ Photo verification  
❌ ID verification  
❌ Selfie verification  
❌ Verification notes/metadata  
❌ Admin photo review workflow  
❌ Photo upload UI  

✅ Keep: student_id + email verification only
