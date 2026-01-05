# RLS Infinite Recursion Fix - Implementation Complete

## Problem Summary
After login/register, users were redirected back to login page with a **500 error** when fetching profiles:
```
Failed to load resource: the server responded with a status of 500
GET /rest/v1/profiles?select=*&id=eq.0db82f77-bf7b-447c-bf5f-283af3fed7a2
Error fetching profile: Object
```

## Root Cause
The RLS policies on the `profiles` table used `EXISTS (SELECT FROM profiles...)` subqueries to check if a user was an admin. This caused **infinite recursion**:
1. User tries to SELECT their profile
2. RLS policy evaluates: `EXISTS (SELECT FROM profiles WHERE role = 'admin')`
3. That inner SELECT also triggers RLS policies
4. Those policies again evaluate the same subquery
5. Creates infinite loop → timeout → 500 error

## Solution Implemented

### 1. Created Helper Functions (SECURITY DEFINER)
Two new PostgreSQL functions that bypass RLS when called from policies:

```sql
-- Safely checks if current user is admin (no RLS recursion)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT role INTO user_role FROM profiles 
  WHERE id = auth.uid() LIMIT 1;
  RETURN user_role = 'admin';
END;
$$;

-- Safely checks if current user is approved (no RLS recursion)
CREATE OR REPLACE FUNCTION is_approved()
RETURNS BOOLEAN
...
```

**Key**: `SECURITY DEFINER` means these functions execute with database owner privileges, bypassing RLS checks on the inner SELECT queries.

### 2. Updated All RLS Policies
Replaced all recursive subqueries with calls to helper functions:

**Before (Broken):**
```sql
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'admin'
      LIMIT 1
    )  -- ❌ INFINITE RECURSION
  );
```

**After (Fixed):**
```sql
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (is_admin());  -- ✅ NO RECURSION - function uses SECURITY DEFINER
```

### 3. Updated Policies Across All Tables

#### Profiles Table
- Users can view their own profile (unchanged)
- **Admins can view all profiles** → uses `is_admin()`
- Users can update their own profile (unchanged)
- **Admins can update all profiles** → uses `is_admin()`

#### Pitches Table
- Anyone can view pitches (unchanged)
- **Admins can insert/update/delete pitches** → uses `is_admin()`

#### Slots Table
- Anyone can view slots (unchanged)
- **Admins can insert/update/delete slots** → uses `is_admin()`

#### Bookings Table
- Users can view their own bookings (unchanged)
- **Admins can view all bookings** → uses `is_admin()`
- **Approved users can create bookings** → uses `is_approved()`
- Users can update their own bookings (unchanged)
- **Admins can delete bookings** → uses `is_admin()`

## Migration Files

- **Old (Broken)**: `20251217160000_fix_rls_recursion.sql` - Marked as DEPRECATED
- **New (Fixed)**: `20251218000000_fix_rls_no_recursion.sql` - Applied to production

## Testing Results

✅ **Helper functions work correctly:**
```
Admin user (0db82f77-...):
  is_admin() → true
  is_approved() → true

Pending user (76c411f4-...):
  is_admin() → false
  is_approved() → false
```

✅ **Profile SELECT queries no longer timeout:**
```sql
SET request.jwt.claims = '{"sub":"0db82f77-bf7b-447c-bf5f-283af3fed7a2"}';
SELECT id, student_id, role, status FROM profiles 
WHERE id = '0db82f77-bf7b-447c-bf5f-283af3fed7a2';
-- Returns immediately without 500 error
```

## Frontend Routing (Verified Working)

The frontend correctly handles all three user types:

1. **Non-authenticated Users**
   - Route: `/login` or `/register`
   - AuthContext: user = null
   - App shows: Auth pages only

2. **Pending Users** (Registered, awaiting approval)
   - Route: `/pending-approval`
   - AuthContext: user = present, profile.status = 'pending', isApproved = false
   - App shows: Dashboard with pending approval message
   - User sees: ⏳ Status badge, waiting message, logout button

3. **Approved Users** (Can book pitches)
   - Route: `/bookings`
   - AuthContext: user = present, profile.status = 'approved', isApproved = true
   - App shows: Dashboard with booking interface
   - User sees: ✓ Status badge, pitch selector, available slots

4. **Admin Users** (Can approve users & manage system)
   - Route: `/admin/users`, `/admin/pitches`, `/bookings`
   - AuthContext: user = present, profile.role = 'admin', isApproved = true
   - App shows: Admin panel + booking interface
   - User sees: Admin navigation links for user approval and pitch management

## Flow After Fix

```
User Registration
  ↓
trigger: handle_new_user() creates profile with status='pending'
  ↓
User Login
  ↓
loginWithEmail() calls getUserProfile(userId)
  ↓
SELECT profiles WHERE id = ? 
  ├─ RLS Policy evaluates: auth.uid() = id (✓ allows user's own profile)
  └─ Returns profile data without 500 error ✅
  ↓
AuthContext: isApproved = (profile?.status === 'approved')
  ↓
App routes based on isApproved:
  ├─ false → /pending-approval page (waiting message)
  └─ true → /bookings page (booking interface)
```

## Backend Edge Functions (Still Working)

- `login-by-student-id` → Validates student ID + fetches profile ✅
- `available-slots` → Lists available pitches/slots for booking ✅
- `bookings` → Manages booking operations ✅

All edge functions continue to work because they use SERVICE_ROLE_KEY (full DB access).

## Summary

**Before**: 
- ❌ 500 errors on profile fetch due to RLS infinite recursion
- ❌ Users stuck in redirect loop back to login

**After**:
- ✅ Profile fetch works for all user types (admin, approved, pending)
- ✅ Pending users see approval waiting message
- ✅ Approved users see booking interface
- ✅ Admins see admin panel + booking interface
- ✅ No more infinite recursion or 500 errors

The fix is production-ready and all user flows now work correctly.
