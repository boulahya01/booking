# Authentication & Authorization Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      USER DEVICE                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           React Frontend (Vite)                      │   │
│  │  ┌──────────────────────────────────────────────┐  │   │
│  │  │     AuthContext + useAuth Hook              │  │   │
│  │  │  - Manages user, profile, loading, etc.    │  │   │
│  │  └──────────────────────────────────────────────┘  │   │
│  │              ↓                   ↓                   │   │
│  │  ┌──────────────────┐  ┌───────────────────────┐  │   │
│  │  │  Auth Pages      │  │  Protected Pages      │  │   │
│  │  │  - Register      │  │  - Bookings           │  │   │
│  │  │  - Login         │  │  - AdminUsers         │  │   │
│  │  │  - PendingApprov │  │  - PendingApproval    │  │   │
│  │  └──────────────────┘  └───────────────────────┘  │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
              │                          │                      
              │ Calls auth functions     │ Calls API/RLS        
              ↓                          ↓                      
┌─────────────────────────────────────────────────────────────┐
│              SUPABASE (Cloud)                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │    Auth (JWT-based)                                │   │
│  │    - email/password signUp → creates JWT           │   │
│  │    - email/password signIn → returns JWT           │   │
│  │    - JWT embedded in requests → RLS evaluates      │   │
│  └────────────────────────────────────────────────────┘   │
│                          ↓                                  │
│  ┌────────────────────────────────────────────────────┐   │
│  │    Database (PostgreSQL + RLS)                     │   │
│  │  ┌────────────────────────────────────────────┐   │   │
│  │  │  profiles table                            │   │   │
│  │  │  - id (UUID, refs auth.users)             │   │   │
│  │  │  - student_id (UNIQUE)                    │   │   │
│  │  │  - role (student | admin)                 │   │   │
│  │  │  - status (pending | approved | rejected) │   │   │
│  │  │  RLS: Users see own row, admins see all   │   │   │
│  │  └────────────────────────────────────────────┘   │   │
│  │  ┌────────────────────────────────────────────┐   │   │
│  │  │  bookings table                            │   │   │
│  │  │  - id, user_id, slot_id, status           │   │   │
│  │  │  - UNIQUE(slot_id, user_id)               │   │   │
│  │  │  RLS:                                      │   │   │
│  │  │  - Users see only their bookings           │   │   │
│  │  │  - Can only INSERT if status='approved'   │   │   │
│  │  │  - Admins can see/modify all              │   │   │
│  │  └────────────────────────────────────────────┘   │   │
│  │  ┌────────────────────────────────────────────┐   │   │
│  │  │  slots, pitches tables                     │   │   │
│  │  │  - Visible to all authenticated users     │   │   │
│  │  │  - Modified by admins only                │   │   │
│  │  └────────────────────────────────────────────┘   │   │
│  └────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │    Edge Functions (Deno)                           │   │
│  │                                                    │   │
│  │  login-by-student-id:                             │   │
│  │  1. Find profile by student_id in DB             │   │
│  │  2. Check status = 'approved'                    │   │
│  │  3. Get user email from auth.users               │   │
│  │  4. Call signInWithPassword(email, password)     │   │
│  │  5. Return session                               │   │
│  │                                                    │   │
│  │  Deployed at: /functions/v1/login-by-student-id  │   │
│  └────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │    Triggers & Functions                            │   │
│  │  - handle_new_user(): Creates profile on signup   │   │
│  │  - update_updated_at_timestamp(): Auto-timestamps │   │
│  └────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Auth Flow Sequences

### 1️⃣ Registration Flow

```
User                 Frontend              Supabase Auth        Database
  │                    │                       │                   │
  ├─ Enter email,      │                       │                   │
  │  password,         │                       │                   │
  │  student_id        │                       │                   │
  │                    ├─ register()           │                   │
  │                    ├─ signUp({             │                   │
  │                    │   email,              │                   │
  │                    │   password,           │                   │
  │                    │   data: {student_id} │                   │
  │                    │ })                    │                   │
  │                    ├──────────────────────>│                   │
  │                    │                       ├─ Create user      │
  │                    │                       │  in auth.users    │
  │                    │                       ├─────────────────>│
  │                    │                       │   INSERT trigger  │
  │                    │                       │<─────────────────┤
  │                    │                       │  handle_new_user()
  │                    │                       │  CREATE profile   │
  │                    │                       │  status='pending' │
  │                    │                       │                   │
  │                    │<──────────────────────┤                   │
  │                    │ Return user + JWT     │                   │
  │                    │                       │                   │
  │<─ Success          │                       │                   │
  │  message           │                       │                   │
  │  Redirect to       │                       │                   │
  │  /login            │                       │                   │
```

### 2️⃣ Email Login Flow

```
User                 Frontend              Supabase Auth        Database
  │                    │                       │                   │
  ├─ Enter email,      │                       │                   │
  │  password          │                       │                   │
  │                    ├─ loginWithEmail()     │                   │
  │                    ├─ signInWithPassword({ │                   │
  │                    │   email,              │                   │
  │                    │   password            │                   │
  │                    │ })                    │                   │
  │                    ├──────────────────────>│                   │
  │                    │                       ├─ Authenticate     │
  │                    │                       │  using JWT        │
  │                    │                       │                   │
  │                    │<──────────────────────┤                   │
  │                    │ Return session + user │                   │
  │                    │                       │                   │
  │                    ├─ Fetch profile       │                   │
  │                    │ SELECT * FROM        │                   │
  │                    │  profiles WHERE      │                   │
  │                    │  id = user.id        │                   │
  │                    ├──────────────────────────────────────────>│
  │                    │                       │   JWT in request  │
  │                    │                       │   RLS checks:     │
  │                    │                       │   - auth.uid()=id?│
  │                    │<──────────────────────────────────────────┤
  │                    │ Profile + status     │                   │
  │                    │                       │                   │
  │                    ├─ Check status:       │                   │
  │                    │ if !== 'approved'    │                   │
  │                    │ → signOut() + error  │                   │
  │                    │ if === 'approved'    │                   │
  │                    │ → Redirect to        │                   │
  │                    │   /bookings          │                   │
  │                    │                       │                   │
  │<─ Booking page OR  │                       │                   │
  │  Pending msg       │                       │                   │
```

### 3️⃣ Student ID Login Flow

```
User                 Frontend              Edge Function      Supabase
  │                    │                       │                   │
  ├─ Enter student_id, │                       │                   │
  │  password          │                       │                   │
  │                    ├─ POST /api/           │                   │
  │                    │ login-by-student-id   │                   │
  │                    │ { studentId, password}│                   │
  │                    ├──────────────────────>│                   │
  │                    │                       ├─ Find profile     │
  │                    │                       │ WHERE student_id  │
  │                    │                       ├─────────────────>│
  │                    │                       │<─────────────────┤
  │                    │                       │ Profile found     │
  │                    │                       │                   │
  │                    │                       ├─ Check status    │
  │                    │                       │ if !== 'approved'│
  │                    │                       │ → Return 403    │
  │                    │                       │ else continue    │
  │                    │                       │                   │
  │                    │                       ├─ Get user email  │
  │                    │                       │ from auth.users  │
  │                    │                       ├─────────────────>│
  │                    │                       │<─────────────────┤
  │                    │                       │ Email: xxx       │
  │                    │                       │                   │
  │                    │                       ├─ signInWithPwd(  │
  │                    │                       │   email,         │
  │                    │                       │   password)      │
  │                    │                       ├─────────────────>│
  │                    │                       │<─────────────────┤
  │                    │                       │ session          │
  │                    │                       │                   │
  │                    │<──────────────────────┤                   │
  │                    │ { session, user }     │                   │
  │                    │ Store in localStorage │                   │
  │                    │ Redirect to /bookings │                   │
  │                    │                       │                   │
  │<─ Booking page     │                       │                   │
```

### 4️⃣ Admin Approval Flow

```
Admin                Frontend              Database
  │                    │                       │
  ├─ Navigate to       │                       │
  │  /admin/users      │                       │
  │                    ├─ Fetch pending       │
  │                    │ SELECT * FROM        │
  │                    │ profiles WHERE       │
  │                    │ status='pending'     │
  │                    ├──────────────────────>│
  │                    │                       │ RLS allows:
  │                    │                       │ User is admin
  │                    │<──────────────────────┤
  │                    │ List of pending      │
  │                    │                       │
  ├─ Click Approve    │                       │
  │  for a user       │                       │
  │                    ├─ UPDATE profiles      │
  │                    │ SET status=           │
  │                    │ 'approved'            │
  │                    │ WHERE id=user_id      │
  │                    ├──────────────────────>│
  │                    │                       │ RLS allows:
  │                    │                       │ User is admin
  │                    │<──────────────────────┤
  │                    │ 1 row updated         │
  │                    │                       │
  │                    ├─ Refetch pending     │
  │                    │ users (user removed)  │
  │                    │                       │
  │<─ User removed     │                       │
  │  from list         │                       │
  │                    │                       │
  │  [User can now     │                       │
  │   login & book]    │                       │
```

### 5️⃣ Booking Creation Flow

```
Approved User        Frontend              Database (RLS)
  │                    │                       │
  ├─ Navigate to       │                       │
  │  /bookings         │                       │
  │                    ├─ useAuth hook checks:│
  │                    │ - user exists? ✓     │
  │                    │ - isApproved? ✓      │
  │                    │ else redirect to     │
  │                    │ pending-approval pg  │
  │                    │                       │
  ├─ Select pitch,     │                       │
  │  click Book        │                       │
  │                    ├─ INSERT booking      │
  │                    │ { user_id, slot_id } │
  │                    ├──────────────────────>│
  │                    │                       │ RLS policy checks:
  │                    │                       │ 1. auth.uid()=user_id? ✓
  │                    │                       │ 2. Profile status=
  │                    │                       │    'approved'? ✓
  │                    │                       │ 3. NO duplicate
  │                    │                       │    (slot_id,user_id)? ✓
  │                    │                       │
  │                    │                       │ Allowed → INSERT
  │                    │<──────────────────────┤
  │                    │ Booking created       │
  │                    │                       │
  │<─ Booking appears  │                       │
  │  in "My Bookings"  │                       │
  │                    │                       │
  ├─ Click Cancel     │                       │
  │                    ├─ UPDATE booking      │
  │                    │ SET status=          │
  │                    │ 'cancelled'          │
  │                    ├──────────────────────>│
  │                    │                       │ RLS allows:
  │                    │                       │ User is owner
  │                    │<──────────────────────┤
  │                    │ 1 row updated         │
  │                    │                       │
  │<─ Booking removed  │                       │
  │  from list         │                       │
```

---

## Security Checks at Each Layer

| Layer | Check | Result |
|-------|-------|--------|
| **Frontend Auth** | User exists? | Redirect to /login if not |
| **Frontend Auth** | User approved? | Redirect to /pending-approval if not |
| **Edge Function** | Student ID found? | 400 Bad Request if not |
| **Edge Function** | Status approved? | 403 Forbidden if not |
| **RLS Policy** | auth.uid() matches row? | Row hidden/blocked if not |
| **RLS Policy** | Profile status approved? | INSERT booking blocked if not |
| **Database** | Unique(slot_id, user_id)? | Double-booking prevented |

---

## JWT Flow

```
┌─ Supabase Auth creates JWT with claims:
│  {
│    iss: "supabase",
│    sub: "user-id",  // used in auth.uid()
│    role: "authenticated",  // from JWT role
│    iat: timestamp,
│    exp: timestamp
│  }
│
├─ Frontend stores JWT in localStorage
│
├─ Every API request includes JWT in Authorization header
│
├─ Supabase RLS policies read JWT via auth.uid()
│
└─ Policies compare auth.uid() against row data
   - If matches → Allow
   - If doesn't match → Block
   - Admin role can bypass most checks
```

---

## Status State Machine

```
┌───────────┐
│ New User  │
│ (signs up)│
└─────┬─────┘
      │
      ↓
┌───────────────────┐
│ status='pending'  │  ← User cannot book
│ (trigger creates) │  ← Admin reviews
└─────┬─────┬─────┘
      │     │
  Approve Reject
      │     │
      ↓     ↓
   ┌────┐ ┌─────────────┐
   │✓   │ │ status=     │
   │    │ │ 'rejected'  │
   └┬───┘ └─────────────┘
    │     (User cannot
    │      re-register)
    ↓
┌──────────────┐
│'approved'    │  ← User can now:
│              │   - Login
│              │   - Create bookings
│              │   - See slots/pitches
└──────────────┘
```

This is a production-ready architecture with multiple security layers!
