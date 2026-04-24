
# 📅 Booking System

**A web application for managing sports pitch bookings.** Students browse available time slots, make reservations, and track their bookings. Administrators manage pitches, approve users, and oversee all bookings.

<div align="center">

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)

</div>

---

## 🎯 What is Booking System?

This is a **sports facility booking platform**. Here's what you can do:

- **Register & Get Approved:** Create an account with your student ID. Wait for admin approval before you can book.
- **Browse Pitches:** View available sports pitches with their opening hours.
- **Book Time Slots:** Select a pitch and reserve a time slot that works for you.
- **View Your Bookings:** Track all your active, past, and cancelled bookings in one place.
- **Auto-Completion:** Your bookings automatically mark as "completed" when the time passes — no manual work needed.

**For Admins:**
- Manage user registrations (approve/reject pending users)
- Create and configure pitches and their time slots
- View all bookings and user activity
- Set pitch opening hours and manage availability

---

## 📖 Key Features at a Glance

| Feature | Description |
|---------|------------|
| **User Registration** | Sign up with email, password, and student ID |
| **Approval Workflow** | Admins approve pending users before they can book |
| **Pitch Management** | Create pitches with names, locations, and opening hours |
| **Time Slots** | Browse hourly slots within pitch opening hours |
| **Smart Availability** | System auto-generates available slots; shows real-time capacity |
| **Booking Management** | Create, view, and cancel bookings easily |
| **Auto-Completion** | Bookings automatically complete when the slot time passes |
| **Multi-Language** | English and Arabic supported |
| **Secure Access** | Role-based permissions ensure students only see/modify their own bookings |

---

## 🚀 Quick Start

### For Regular Users
1. Go to the application website
2. **Register** with your email, password, and student ID
3. **Wait for admin approval** (you'll see a "Pending Approval" message)
4. Once approved, **browse pitches** on the home page
5. **Select a pitch** → view available time slots → **click to book**
6. View your bookings in the **Bookings** section

### For Administrators
1. Log in with your admin account
2. Use the **Admin Panel** to:
   - **Manage Users:** Approve or reject pending registrations
   - **Manage Pitches:** Create new pitches and set their opening hours
   - **View Bookings:** See all active and completed bookings

---

## 👥 User Roles & Permissions

| Role | Can Register | Can Book | Can Approve Users | Can Manage Pitches |
|------|-------------|----------|------------------|------------------|
| **Student** | ✅ Yes | ✅ After approval | ❌ No | ❌ No |
| **Admin** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    BOOKING SYSTEM                       │
└─────────────────────────────────────────────────────────┘

┌───────────────────┐          ┌──────────────────────────┐
│   Web Frontend    │◄────────►│    Supabase Backend      │
│  (React + Vite)   │          │  (Auth, Database, APIs)  │
└───────────────────┘          └──────────────────────────┘
        │                              │
        │ TypeScript, React Router     │ PostgreSQL
        │ Context API, i18next         │ Row-Level Security (RLS)
        │                              │ Real-time Functions
        │                              │
        └──────────────────────────────┘
                      │
         ┌────────────┴────────────┐
         │                         │
    ┌────────────┐         ┌──────────────┐
    │  Database  │         │  Background  │
    │(PostgreSQL)│         │    Jobs      │
    │            │         │  (Vercel     │
    │ - Profiles │         │   Cron)      │
    │ - Pitches  │         │              │
    │ - Slots    │         │ Auto-process │
    │ - Bookings │         │ bookings     │
    └────────────┘         └──────────────┘
```

---

## 🛠️ For Developers

### Prerequisites
- **Node.js** (v16 or later)
- **npm** (comes with Node.js)
- **Supabase CLI** (for local development and migrations)
- **Git**

### Local Setup (5 minutes)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/boulahya01/booking.git
   cd booking
   ```

2. **Install dependencies:**
   ```bash
   npm install
   cd frontend && npm install && cd ..
   ```

3. **Set up environment variables:**

   Create `.env.local` in the root directory with your Supabase credentials:
   ```env
   # Supabase connection (get these from https://supabase.com)
   VITE_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   VITE_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   
   # Optional: for Vercel Cron background jobs
   CRON_SECRET=your-secure-random-secret
   ```

   > **Don't have a Supabase project?** [Create one free here](https://supabase.com).

4. **Start the application:**
   ```bash
   # Terminal 1: Start Supabase locally (includes PostgreSQL)
   npm run supabase:start
   
   # Terminal 2: Start the frontend dev server
   cd frontend && npm run dev
   ```

5. **Access the app:**
   - Frontend: http://localhost:5173
   - Supabase Studio: http://localhost:54323
   - Database (Postgres): localhost:54322

### Verify Everything Works
- Open http://localhost:5173 in your browser
- Try registering a new account
- Check the **Supabase Studio** (http://localhost:54323) to see data being saved

---

## 📁 Project Structure

```
booking/
├── frontend/                 # React web app
│   ├── src/
│   │   ├── pages/           # Page components (Login, Register, Home, Bookings, etc.)
│   │   ├── components/      # Reusable UI components
│   │   ├── context/         # React Context (Auth, Toasts)
│   │   ├── hooks/           # Custom hooks (useAuth, useToast)
│   │   ├── lib/             # Utilities (Supabase client, Auth logic)
│   │   ├── locales/         # Translation files (English, Arabic)
│   │   └── types/           # TypeScript type definitions
│   ├── package.json
│   └── vite.config.ts
│
├── supabase/                # Backend configuration
│   ├── functions/           # Serverless functions
│   │   ├── available-slots/ # Get available slots for a pitch
│   │   ├── bookings/        # Create/fetch bookings
│   │   └── process-booking-jobs/  # Auto-complete past bookings
│   ├── migrations/          # Database schema (SQL files)
│   └── config.toml          # Local Supabase config
│
├── api/                     # API utilities
│   └── cron/                # Cron job scripts for background processing
│
└── package.json             # Root dependencies
```

---

## 🗄️ Database Overview

### Main Tables

**profiles** — User accounts
- `id` (unique identifier)
- `email` (from auth)
- `student_id` (unique)
- `full_name`
- `role` (student or admin)
- `status` (pending, approved, or rejected)

**pitches** — Sports facilities
- `id`
- `name` (e.g., "Pitch A")
- `location`
- `open_time` (e.g., "08:00")
- `close_time` (e.g., "22:00")

**slots** — Time slots within pitches
- `id`
- `pitch_id` (which pitch)
- `datetime_start` (e.g., 2026-01-05 10:00:00)
- `datetime_end` (e.g., 2026-01-05 11:00:00)
- `capacity` (max bookings allowed)

**bookings** — User reservations
- `id`
- `user_id` (which student)
- `slot_id` (which time slot)
- `status` (active, completed, or cancelled)
- `created_at`

**booking_jobs** — Background completion tasks
- `id`
- `booking_id` (which booking to complete)
- `run_at` (when to complete it)
- `status` (pending or completed)

---

## 🔌 API Functions

All functions are in the `supabase/functions/` directory:

### `available-slots`
**What it does:** Returns available time slots for a pitch.

**Example request:**
```bash
curl -X POST http://localhost:54321/functions/v1/available-slots \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pitch_id": "123"}'
```

**Response:**
```json
{
  "slots": [
    {
      "id": "slot-1",
      "start": "2026-01-05 10:00:00",
      "end": "2026-01-05 11:00:00",
      "available": true
    }
  ]
}
```

### `bookings`
**What it does:** Create new bookings or fetch existing ones.

**Create a booking:**
```bash
curl -X POST http://localhost:54321/functions/v1/bookings \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"slot_id": "slot-1"}'
```

### `process-booking-jobs`
**What it does:** Auto-complete bookings when their slot time passes.
- Runs every 5 minutes via Vercel Cron in production
- Can also be triggered manually for testing

---

## 🔐 Security & Access Control

**Row-Level Security (RLS):** All database queries enforce role-based rules:
- **Students** can only see and modify their own bookings
- **Admins** can view and modify all data
- **Unauthenticated users** cannot access any data

**Authentication:**
- JWT tokens expire after 1 hour
- Sessions are managed by Supabase Auth
- Passwords are hashed and never stored in plain text

**Best Practices:**
- ✅ **DO:** Keep `.env.local` private (add to `.gitignore`)
- ✅ **DO:** Rotate API keys if ever exposed
- ❌ **DON'T:** Commit secrets or `.env` files
- ❌ **DON'T:** Share admin credentials

---

## 📋 Key Workflows

### Workflow 1: Student Registration & Booking

```
1. Student registers          → Account created with status="pending"
2. Student sees "Pending"     → Waits for admin approval
3. Admin approves             → Status changes to "approved"
4. Student logs in            → Can now access booking features
5. Student browses pitches    → Selects pitch, views available slots
6. Student books a slot       → Booking created with status="active"
7. Slot time passes           → Auto-completion job marks booking="completed"
8. Student views booking      → Sees it in "Completed" section
```

### Workflow 2: Admin Approval

```
1. Admin logs in              → Views Admin Users page
2. Admin sees pending users   → List of users awaiting approval
3. Admin clicks "Approve"     → User status updates to "approved"
4. User gets notified         → Toast message or email (if configured)
5. User can now book          → Access to booking features unlocked
```

### Workflow 3: Auto-Completion (Background Process)

```
Every 5 minutes:
1. Vercel Cron triggers       → Calls process-booking-jobs function
2. Function queries DB        → Finds bookings with slot_time passed
3. Updates booking status     → Changes status from "active" to "completed"
4. Cleans up job records      → Marks booking_jobs as done
5. Students see results       → Completed bookings appear in their history
```

---

## 🌍 Multi-Language Support

The app supports **English** and **Arabic**:

- **Default language:** Arabic
- **Language switcher:** Top-right corner of the app
- **Preference saved:** Your choice is remembered in browser storage
- **Translations location:** [frontend/src/locales/](frontend/src/locales/)

To add a new language:
1. Create a translation file in `frontend/src/locales/`
2. Add it to the language selector component
3. Translate all keys from existing language files

---

## 📚 Useful Commands

```bash
# Install dependencies
npm install

# Start frontend dev server
cd frontend && npm run dev

# Build frontend for production
cd frontend && npm run build

# Run tests
npm run test

# Check for security issues
bash verify-security.sh

# Start Supabase locally
npm run supabase:start

# View Supabase Studio (local database UI)
# http://localhost:54323
```

---

## 🆘 Troubleshooting

### "Can't connect to Supabase"
- Make sure Supabase is running: `npm run supabase:start`
- Check that ports are not blocked (54321, 54322, 54323)
- Verify `.env.local` has correct Supabase URL and keys

### "Bookings not auto-completing"
- In production: Check that Vercel Cron is configured and running
- In local dev: Manually call the `process-booking-jobs` function
- Check function logs in Supabase Studio

### "User approval not working"
- Ensure your account has admin role in the database
- Check RLS policies in Supabase Studio
- Verify service role key has admin permissions

### "Slots not appearing"
- Ensure pitch has valid opening hours (e.g., "08:00" to "22:00")
- Check that slots are in the future (not in the past)
- Verify pitch exists and is accessible to your user role

---

## 🤝 Contributing

We welcome contributions! Here's how:

1. **Fork the repo** and create a feature branch
2. **Make your changes** — keep commits focused and small
3. **Test locally** — ensure frontend and functions work
4. **Submit a pull request** with a clear description of changes
5. **Follow the code style** — use TypeScript, keep consistent formatting

**Code Style Guidelines:**
- Use TypeScript for type safety
- Follow existing naming conventions (camelCase for variables, PascalCase for components)
- Write clear comments for complex logic
- Test your changes before submitting

---

## 📞 Support & Feedback

- **Found a bug?** Open an [issue on GitHub](https://github.com/boulahya01/booking/issues)
- **Have a feature idea?** [Start a discussion](https://github.com/boulahya01/booking/discussions)
- **Need help?** Check this README or open an issue with the label `question`

---

## 📄 License

This project is licensed under the [MIT License](LICENSE) — feel free to use it for personal or commercial projects.

---

## 🙏 Acknowledgments

Built with:
- [Supabase](https://supabase.com/) — Backend, Auth & Database
- [React](https://react.dev/) — UI Framework
- [Vite](https://vitejs.dev/) — Build Tool
- [TypeScript](https://www.typescriptlang.org/) — Type Safety
- [i18next](https://www.i18next.com/) — Internationalization

---

**Last Updated:** January 2026




