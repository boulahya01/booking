# University Football Pitch Booking System - Setup & Deployment Guide

## ✅ Completed Implementation

### 1. Database Schema & Migrations
- ✅ **profiles**: User profiles with `student_id`, `role`, and `status` (pending/approved/rejected)
- ✅ **pitches**: Football pitch information
- ✅ **slots**: Bookable time slots for each pitch
- ✅ **bookings**: User bookings with unique constraint to prevent double-booking
- ✅ **RLS Policies**: Fine-grained access control for all tables
- ✅ **Triggers**: Automatic profile creation on signup, auto-updated timestamps

### 2. Authentication System
- ✅ **Email/Password Registration**: Creates profiles with status='pending'
- ✅ **Email Login**: Validates approval status before allowing login
- ✅ **Student ID Login**: Edge function validates student ID + password + approval
- ✅ **Auth Context**: Manages user state, profile, and approval status
- ✅ **Route Guards**: Protected routes that redirect based on auth state

### 3. Admin Approval System
- ✅ **Admin Users Page**: Lists pending users with Approve/Reject buttons
- ✅ **Status Management**: Admins can change user status from pending to approved/rejected
- ✅ **Role-based Access**: Only admin users can access approval panel

### 4. Booking System
- ✅ **Pitch & Slot Browsing**: Approved users can browse available pitches and slots
- ✅ **Booking Creation**: Users can book slots (prevents double-booking via RLS)
- ✅ **Booking Cancellation**: Users can cancel their own active bookings
- ✅ **My Bookings**: Users can see their active bookings

### 5. Frontend Pages
- ✅ `Register.tsx` - Registration with email, password, and student ID
- ✅ `Login.tsx` - Login with email OR student ID toggle
- ✅ `PendingApproval.tsx` - Message for pending users
- ✅ `AdminUsers.tsx` - Admin approval panel
- ✅ `Bookings.tsx` - Booking management interface
- ✅ `App.tsx` - Full routing, auth checks, and protected routes

### 6. Backend Edge Function
- ✅ `login-by-student-id` - Validates student ID, checks approval, authenticates via Supabase Auth

---

## 🚀 Deployment Status

### Database Migrations
- ✅ **Applied**: 20251217120000_init_schema.sql
- ✅ **Applied**: 20251217120100_rls_policies.sql
- ✅ **Applied**: 20251217120200_triggers_auth.sql

### Edge Functions
- ✅ **Deployed**: login-by-student-id

### Frontend
- ⏳ **Pending**: npm install & build (network timeout, retry manually)

---

## 📋 Next Steps to Complete

### 1. Install Frontend Dependencies

```bash
cd /home/shobee/Desktop/database/booking/frontend
npm install
```

If you hit network issues, retry with:
```bash
npm install --no-save --prefer-offline
```

### 2. Deploy to Vercel

```bash
cd /home/shobee/Desktop/database/booking
vercel --prod
```

This will use your existing Vercel project and deploy the frontend.

### 3. Create a Test Admin User

After deployment, create your first admin manually in Supabase:

1. Go to Supabase Dashboard > Authentication > Users
2. Create a test user (email: admin@test.com, password: anything)
3. Go to Supabase Dashboard > SQL Editor
4. Run this command:

```sql
UPDATE profiles 
SET role = 'admin', status = 'approved' 
WHERE student_id = 'admin-student-id';
```

Replace `'admin-student-id'` with a student ID value.

### 4. Test the Full Flow

**Registration & Approval:**
1. Go to `/register` and sign up with email, password, student ID
2. Log in to Supabase Dashboard > Admin Panel
3. Find the pending user and click "Approve"
4. User should now be able to log in and see booking interface

**Email Login:**
1. Go to `/login`
2. Enter registered email + password
3. Should see booking page if approved, or pending approval page if not

**Student ID Login:**
1. Go to `/login`
2. Click "Student ID Login" toggle
3. Enter student ID + password
4. Same result as email login

**Booking:**
1. (As approved user) Go to `/bookings`
2. Select a pitch from dropdown
3. Available slots appear
4. Click "Book" to create booking
5. Booking appears in "My Bookings" section
6. Click "Cancel" to cancel booking

**Admin Panel:**
1. (As admin) Click "Admin Panel" in navigation
2. See list of pending users
3. Click "Approve" or "Reject" to update status
4. User is removed from pending list

---

## 🏗️ Architecture Overview

```
Frontend (React + Vite)
  ├── Pages: Register, Login, PendingApproval, AdminUsers, Bookings
  ├── Context: AuthProvider (manages auth state)
  ├── Hooks: useAuth (exposes user, profile, loading, isApproved)
  ├── Utils: supabaseClient, auth functions
  └── Styles: Auth.css, AdminUsers.css, Bookings.css

Backend (Supabase)
  ├── Database Tables: profiles, pitches, slots, bookings
  ├── RLS Policies: User, admin, and approval-based access control
  ├── Triggers: Auto-create profile on signup, auto-update timestamps
  └── Edge Functions: login-by-student-id (validates student ID login)

Environment Variables (.env.local)
  ├── VITE_PUBLIC_SUPABASE_URL
  ├── VITE_PUBLIC_SUPABASE_ANON_KEY
  └── Other Supabase keys for local development
```

---

## 📚 Key Features & Security

✅ **Authentication**: Supabase Auth with email/password, no custom JWT
✅ **Authorization**: RLS policies enforce user ownership and approval status
✅ **Double-booking Prevention**: UNIQUE constraint on (slot_id, user_id)
✅ **Approval Workflow**: Pending users cannot book until admin approves
✅ **Admin Panel**: Only admins can approve/reject users
✅ **Student ID Login**: Validates student ID, checks status, signs in via Supabase Auth

---

## 🔧 Troubleshooting

### Migrations not applied?
```bash
npx supabase db push --debug
```

### Edge function not deployed?
```bash
npx supabase functions deploy login-by-student-id --debug
```

### Env variables not working?
Make sure `.env.local` exists in `/frontend` with:
```
VITE_PUBLIC_SUPABASE_URL=https://mismymbsavogkuovfyvj.supabase.co
VITE_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

### RLS blocking queries?
Check Supabase Dashboard > Authentication > Policies to verify policies are created correctly.

---

## 📞 Support

For issues with Supabase, check:
- https://supabase.com/docs/guides/auth
- https://supabase.com/docs/guides/database/postgres/row-level-security

For Vite/React issues:
- https://vitejs.dev/guide/
- https://react.dev
