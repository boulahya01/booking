# 🏗️ Architecture & Component Diagram

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         React App                               │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              AuthProvider (Context)                        │ │
│  │                                                            │ │
│  │  Provides: user, profile, loading, isApproved             │ │
│  │  Functions: loadProfile(), signOut()                       │ │
│  │                                                            │ │
│  │  ┌──────────────────────────────────────────────────────┐ │ │
│  │  │           AppRoutes (Auth Check)                     │ │ │
│  │  │                                                      │ │ │
│  │  │  If NOT authenticated:                              │ │ │
│  │  │  ├─ /login → Login page                             │ │ │
│  │  │  ├─ /register → Register page                       │ │ │
│  │  │  └─ * → Redirect to /login                          │ │ │
│  │  │                                                      │ │ │
│  │  │  If authenticated:                                  │ │ │
│  │  │  └─ Dashboard ──────────────────────┐              │ │ │
│  │  │                                       │              │ │ │
│  │  │                    ┌──────────────────▼──────────┐  │ │ │
│  │  │                    │    Dashboard Component     │  │ │ │
│  │  │                    │                            │  │ │ │
│  │  │                    ├─ <MobileMenu /> ✨NEW      │  │ │ │
│  │  │                    │  ├─ Hamburger Button       │  │ │ │
│  │  │                    │  ├─ Menu Overlay           │  │ │ │
│  │  │                    │  └─ Navigation Links       │  │ │ │
│  │  │                    │     (role-based)           │  │ │ │
│  │  │                    │                            │  │ │ │
│  │  │                    ├─ <Header>                 │  │ │ │
│  │  │                    │  ├─ Title                  │  │ │ │
│  │  │                    │  └─ User Info              │  │ │ │
│  │  │                    │     ├─ Name               │  │ │ │
│  │  │                    │     ├─ Role Badge ✨NEW   │  │ │ │
│  │  │                    │     ├─ Status Badge       │  │ │ │
│  │  │                    │     └─ Logout Btn         │  │ │ │
│  │  │                    │                            │  │ │ │
│  │  │                    ├─ <Nav> (hidden < 768px)   │  │ │ │
│  │  │                    │  ├─ Bookings              │  │ │ │
│  │  │                    │  ├─ Admin: Users (admin)  │  │ │ │
│  │  │                    │  └─ Admin: Pitches(admin) │  │ │ │
│  │  │                    │                            │  │ │ │
│  │  │                    ├─ <Routes>                 │  │ │ │
│  │  │                    │  ├─ /bookings             │  │ │ │
│  │  │                    │  │  → ApprovedRoute       │  │ │ │
│  │  │                    │  │     → <Bookings />     │  │ │ │
│  │  │                    │  │                        │  │ │ │
│  │  │                    │  ├─ /admin/users          │  │ │ │
│  │  │                    │  │  → <AdminUsers />      │  │ │ │
│  │  │                    │  │     ✅ Has admin check │  │ │ │
│  │  │                    │  │                        │  │ │ │
│  │  │                    │  ├─ /admin/pitches        │  │ │ │
│  │  │                    │  │  → <AdminPitches />    │  │ │ │
│  │  │                    │  │     ✅ FIXED - now works│  │ │ │
│  │  │                    │  │                        │  │ │ │
│  │  │                    │  ├─ /pending-approval     │  │ │ │
│  │  │                    │  │  → <PendingApproval /> │  │ │ │
│  │  │                    │  │                        │  │ │ │
│  │  │                    │  └─ /logout              │  │ │ │
│  │  │                    │     → <LogoutHandler />   │  │ │ │
│  │  │                    │                            │  │ │ │
│  │  │                    └────────────────────────────┘  │ │ │
│  │  │                                                      │ │ │
│  │  └──────────────────────────────────────────────────────┘ │ │
│  │                                                            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Hierarchy

```
App
├── BrowserRouter
│   └── AuthProvider
│       └── AppRoutes
│           ├── (Not authenticated)
│           │   ├── /register → <Register />
│           │   ├── /login → <Login />
│           │   └── * → Redirect to /login
│           │
│           └── (Authenticated)
│               └── Dashboard ═══════════════════════════════════
│                   ├── <MobileMenu />  ✨ NEW COMPONENT
│                   │   ├── Hamburger Button (< 768px only)
│                   │   ├── Menu Overlay (animated slide-in)
│                   │   ├── Menu Header
│                   │   ├── User Info Section
│                   │   │   ├── Avatar (first letter)
│                   │   │   ├── Student ID
│                   │   │   └── Role Display
│                   │   └── Navigation Links
│                   │       ├── Bookings (all users)
│                   │       ├── Admin: Users (admin only)
│                   │       ├── Admin: Pitches (admin only)
│                   │       └── Logout (all users)
│                   │
│                   ├── <Header>
│                   │   ├── <h1>Title</h1>
│                   │   └── <UserInfo>
│                   │       ├── Welcome text
│                   │       ├── Role Badge ✨ NEW FEATURE
│                   │       │   ├── If admin: 👤 Admin (green)
│                   │       │   └── If student: 👤 Student (blue)
│                   │       ├── Status Badge (existing)
│                   │       │   ├── ✓ Approved (green)
│                   │       │   └── ⏳ Pending (yellow)
│                   │       └── Logout Button
│                   │
│                   ├── <Nav> (hidden on mobile)
│                   │   ├── Bookings Link
│                   │   ├── Admin: Users Link (admin only)
│                   │   ├── Admin: Pitches Link (admin only)
│                   │   └── (Auto-hides < 768px)
│                   │
│                   └── <Routes>
│                       ├── /bookings
│                       │   └── <ApprovedRoute>
│                       │       └── <Bookings />
│                       │           ├── Pitch List
│                       │           ├── Slot Selection
│                       │           └── Booking Management
│                       │
│                       ├── /admin/users
│                       │   └── <AdminUsers />
│                       │       ├── ✅ Admin check included
│                       │       ├── Pending Users List
│                       │       └── Approve/Reject Buttons
│                       │
│                       ├── /admin/pitches
│                       │   └── <AdminPitches /> ✅ FIXED
│                       │       ├── ✅ Admin check ADDED
│                       │       ├── ✅ No longer stuck loading
│                       │       ├── Pitch List Table
│                       │       ├── Edit Pitch Form
│                       │       └── Save/Cancel Buttons
│                       │
│                       ├── /pending-approval
│                       │   └── <PendingApproval />
│                       │       ├── User Information
│                       │       ├── Waiting Message
│                       │       └── Logout Button
│                       │
│                       └── /logout
│                           └── <LogoutHandler />
                                (Redirects to /login)
```

---

## Data Flow Diagram

```
User Login/Register
        │
        ▼
┌──────────────────────────────┐
│    Supabase Auth             │
│  (email/password or ID)      │
└──────────────────┬───────────┘
                   │
        ┌──────────▼──────────┐
        │ Auth Success?       │
        └──────┬──────┬───────┘
               │ YES  │ NO
               │      │
               │      └───→ /login (show error)
               │
        ┌──────▼──────────────────────┐
        │ Fetch User Profile          │
        │ (from profiles table)       │
        │                             │
        │ SELECT * WHERE id = uid     │ ✅ RLS allows
        │                             │    (not recursive)
        └──────┬──────────────────────┘
               │
    ┌──────────▼──────────────┐
    │ Profile Retrieved       │
    │ ├─ id                   │
    │ ├─ role (admin/student) │
    │ ├─ status (pending/ok)  │
    │ ├─ student_id           │
    │ └─ full_name            │
    └──────┬──────────────────┘
           │
    ┌──────▼──────────────────────────┐
    │ Set AuthContext State           │
    │ ├─ user = auth user             │
    │ ├─ profile = fetched profile    │
    │ ├─ loading = false              │
    │ └─ isApproved = status === 'ok' │
    └──────┬──────────────────────────┘
           │
    ┌──────▼──────────────────────────────┐
    │ Route Based on Status               │
    │                                     │
    │ If status == 'pending'              │
    │   └─ /pending-approval              │
    │                                     │
    │ If status == 'approved'             │
    │   └─ /dashboard → /bookings         │
    │                                     │
    │ If role == 'admin'                  │
    │   └─ See admin nav + badge          │
    │                                     │
    └──────┬───────────────────────────────┘
           │
    ┌──────▼──────────────────────────────┐
    │ Dashboard Renders                   │
    │                                     │
    │ ✨ NEW: MobileMenu checks:          │
    │    • Screen width < 768px?          │
    │    • Show hamburger? YES/NO         │
    │    • User role? admin/student       │
    │    • Show admin links? YES/NO       │
    │                                     │
    │ ✨ NEW: Header badges show:         │
    │    • 👤 Admin (if admin)            │
    │    • 👤 Student (if student)        │
    │    • ✓ Approved (if approved)       │
    │    • ⏳ Pending (if pending)        │
    │                                     │
    └─────────────────────────────────────┘
```

---

## State Management Flow

```
┌─────────────────────────────────────────────────────┐
│              AuthContext (Provider)                  │
│                                                      │
│  State Variables:                                   │
│  ├─ user: Supabase.Auth.User | null                │
│  ├─ profile: Profile | null                        │
│  ├─ loading: boolean                               │
│  ├─ isApproved: boolean                            │
│  └─ error: string | null                           │
│                                                      │
│  Functions:                                         │
│  ├─ loadProfile(userId)                            │
│  │  └─ Fetches profile from DB                     │
│  ├─ signOut()                                       │
│  │  └─ Signs out Supabase session                  │
│  └─ useEffect (on mount)                           │
│     └─ Listens to auth state changes               │
│                                                      │
└────────────┬────────────────────────────────────────┘
             │
             │ useContext(AuthContext)
             │
    ┌────────▼────────┐
    │   Components    │
    │ Using useAuth() │
    │                 │
    │ ├─ App.tsx      │ ✅ Gets profile for role badge
    │ ├─ Login.tsx    │ ✅ Calls loginWithEmail()
    │ ├─ Register.tsx │ ✅ Calls register()
    │ ├─ AdminUsers   │ ✅ Checks admin role
    │ ├─ AdminPitches │ ✅ NEW: Added admin check
    │ ├─ Bookings     │ ✅ Gets user booking info
    │ └─ MobileMenu   │ ✅ NEW: Gets role for links
    │                 │
    └─────────────────┘
```

---

## Responsive Breakpoint Logic

```
Window Width
     │
     ├─────────────────────────────────────────────────────────────
     │                                                              │
     ▼                                                              ▼
 < 768px                                                        ≥ 768px
MOBILE LAYOUT                                                 DESKTOP LAYOUT
     │                                                              │
     ├─ Show MobileMenu                                    ├─ Show desktop nav
     │  ├─ Hamburger button visible (fixed, top-left)    │  ├─ Horizontal nav
     │  ├─ Z-index: 1000                                 │  ├─ Below header
     │  ├─ Menu icon: 3 horizontal lines                 │  └─ Traditional style
     │  └─ On tap: slides from left                      │
     │                                                    ├─ Hide MobileMenu
     ├─ Hide desktop nav                                  │  └─ Hamburger hidden
     │                                                    │
     ├─ Responsive header                                 ├─ Normal header
     │  ├─ Stack vertically                              │  ├─ Row layout
     │  ├─ Badges wrap                                   │  ├─ Badges inline
     │  └─ Touch-friendly sizes                          │  └─ Normal spacing
     │                                                    │
     └─ Content padding reduced                          └─ Normal padding
        (1rem vs 2rem)                                      (2rem)


CSS Media Query Applied:
────────────────────────────────────────

@media (max-width: 768px) {
  .dashboard-nav { display: none; }           /* Hide desktop nav */
  .mobile-menu-toggle { display: block; }     /* Show hamburger */
  .dashboard-header { flex-direction: column; } /* Stack items */
  .user-info { flex-wrap: wrap; }             /* Wrap badges */
  .dashboard-main { padding: 1rem; }          /* Reduce padding */
}
```

---

## Role & Status Badge Logic

```
User Authentication
        │
        ▼
┌─────────────────────────────────────┐
│  Check profile.role field           │
└─────┬───────────────────────┬───────┘
      │                       │
   "admin"               "student"
      │                       │
      ▼                       ▼
 ┌──────────────────┐  ┌──────────────────┐
 │ Show Admin Badge │  │ Show Student     │
 │                  │  │ Badge            │
 │ 👤 Admin         │  │                  │
 │ (green #4CAF50)  │  │ 👤 Student       │
 │                  │  │ (blue #2196F3)   │
 └────────┬─────────┘  └────────┬─────────┘
          │                     │
          └──────────┬──────────┘
                     │
                     ▼
       ┌──────────────────────────────┐
       │ PLUS Status Badge (existing) │
       └──────────┬───────────────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
   status='approved'   status='pending'
        │                   │
        ▼                   ▼
    ┌──────────┐     ┌────────────┐
    │ ✓        │     │ ⏳         │
    │ Approved │     │ Pending    │
    │ (green)  │     │ (yellow)   │
    └──────────┘     └────────────┘

Display in Header:
┌─────────────────────────────────────┐
│ Welcome, STUDENT_ID                 │
│ [👤 Admin] [✓ Approved]             │  (if admin)
│ [👤 Student] [⏳ Pending]           │  (if student)
└─────────────────────────────────────┘
```

---

## Navigation Logic by Role

```
User Role & Admin Status
        │
        ├─ admin=true, status=approved
        │  │
        │  └─ Navigation Links:
        │     ├─ Bookings (always)
        │     ├─ Admin: Users (admin-only)
        │     └─ Admin: Pitches (admin-only)
        │
        └─ admin=false (student), status=pending
           │
           ├─ Navigates to: /pending-approval
           │  └─ Cannot access /bookings until approved
           │
           └─ admin=false (student), status=approved
              │
              └─ Navigation Links:
                 └─ Bookings only
                    (admin links hidden)

Mobile Menu Rendering (NEW):
───────────────────────────

MobileMenu.tsx:
  const { profile } = useAuth()
  
  return (
    <>
      <button className="hamburger">☰</button>
      
      <nav className="mobile-menu">
        <Link to="/bookings">📗 Bookings</Link>
        
        {profile?.role === 'admin' && (
          <>
            <Link to="/admin/users">👥 Admin: Users</Link>
            <Link to="/admin/pitches">⚽ Admin: Pitches</Link>
          </>
        )}
        
        <button onClick={logout}>🚪 Logout</button>
      </nav>
    </>
  )
```

---

## AdminPitches Fix Implementation

```
BEFORE (Broken):
────────────────

export function AdminPitches() {
  // ❌ No auth check
  // ❌ No role verification
  // ❌ Gets stuck on "Loading..."
  
  useEffect(() => {
    fetchPitches() // Called immediately
  }, [])
  
  return <div>Pitches...</div>
}


AFTER (Fixed) ✅:
─────────────────

export function AdminPitches() {
  const { profile: userProfile, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  
  useEffect(() => {
    // ✅ Check if admin BEFORE fetching
    if (!authLoading && userProfile?.role !== 'admin') {
      navigate('/dashboard')
      return
    }
    if (!authLoading) {
      fetchPitches()
    }
  }, [authLoading, userProfile, navigate])
  
  // ✅ Show loading while auth loads
  if (authLoading) {
    return <div>Loading...</div>
  }
  
  // ✅ Show access denied for non-admins
  if (userProfile?.role !== 'admin') {
    return <div>Access denied. Admin only.</div>
  }
  
  return <div>Pitches...</div> // ✅ Only renders for admins
}
```

---

## CSS Media Query Implementation

```
Desktop (≥ 768px)
─────────────────
┌─────────────────────────────────────┐
│ Header (normal width)               │
│ ├─ Title: 1.8rem                    │
│ └─ User Info: row layout            │
├─────────────────────────────────────┤
│ Navigation (visible)                │
│ ├─ Horizontal flex layout           │
│ ├─ Gap: 2rem                        │
│ └─ Links with hover effects         │
├─────────────────────────────────────┤
│ Main Content                        │
│ └─ Padding: 2rem                    │
└─────────────────────────────────────┘


Mobile (< 768px)
────────────────
┌─────────────────────────────────────┐
│ [☰] Header (wrapped column)         │
│ ├─ Hamburger fixed (top-left)       │
│ ├─ Title: 1.4rem                    │
│ └─ User Info: wrap, gap: 0.75rem    │
├─────────────────────────────────────┤
│ Navigation (hidden)                 │
│ └─ display: none                    │
├─────────────────────────────────────┤
│ Mobile Menu (slides from left)      │
│ ├─ Fixed position                   │
│ ├─ Z-index: 1001                    │
│ └─ Transforms in/out                │
├─────────────────────────────────────┤
│ Main Content                        │
│ └─ Padding: 1rem (reduced)          │
└─────────────────────────────────────┘
```

---

## Component Dependencies

```
MobileMenu.tsx
    ├─ React (useState)
    ├─ react-router-dom (useNavigate)
    ├─ useAuth hook
    │  └─ AuthContext
    │     └─ Supabase client
    └─ MobileMenu.css

App.tsx
    ├─ React (useEffect)
    ├─ react-router-dom (all routing)
    ├─ AuthProvider
    ├─ useAuth hook
    ├─ MobileMenu component ✨
    ├─ All page components
    ├─ App.css
    └─ MobileMenu.css ✨

AdminPitches.tsx
    ├─ React (useState, useEffect)
    ├─ react-router-dom (useNavigate) ✨
    ├─ useAuth hook ✨
    ├─ Supabase client
    └─ AdminPitches.css
```

---

## Summary

- **✨ New:** MobileMenu component with hamburger and role-aware navigation
- **✨ New:** Role badges (Admin/Student) in header
- **✨ New:** Mobile responsive design with 768px breakpoint
- **✅ Fixed:** AdminPitches now has admin role check
- **✅ Enhanced:** Better mobile user experience
- **✅ Improved:** Clearer role identification for all users

All components properly integrated and tested.
