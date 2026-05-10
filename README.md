# Booking System

A comprehensive sports facility booking platform built with modern web technologies. Students can browse available pitches, reserve time slots, and manage their bookings seamlessly. Administrators oversee user approvals, pitch management, and system operations.

<div align="center">

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![SvelteKit](https://img.shields.io/badge/SvelteKit-FF3E00?style=for-the-badge&logo=svelte&logoColor=white)](https://kit.svelte.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/)
[![GitHub](https://img.shields.io/badge/GitHub-100000?style=for-the-badge&logo=github&logoColor=white)](https://github.com/)

</div>

---

> **Note**: This `dev` branch contains the current SvelteKit implementation. The `main` branch contains the previous React-based implementation. [View main branch](https://github.com/your-username/booking-system/tree/main) for the legacy codebase.

---

## Overview

This is a full-stack booking application designed for educational institutions to manage sports facility reservations. The platform enables students to book pitches while providing administrators with comprehensive management tools.

### Key Capabilities

- **Student Portal**: Browse pitches, view availability, and make reservations
- **Admin Dashboard**: Approve users, manage pitches, and oversee bookings
- **Real-time Availability**: Dynamic slot generation based on pitch opening hours
- **Automated Workflows**: Background jobs for booking completion and notifications
- **Multi-language Support**: English and Arabic interfaces
- **Secure Authentication**: Role-based access with Supabase Auth

---

## Features

### For Students
- User Registration with email, password, and student ID verification
- Pitch Discovery with detailed information and opening hours
- Smart Booking with real-time availability and conflict prevention
- Booking Management view, modify, and cancel reservations
- Automated Completion bookings auto-complete when time passes
- Multi-language English/Arabic support

### For Administrators
- User Approval Workflow review and approve pending registrations
- Pitch Management create, configure, and manage sports facilities
- Booking Oversight monitor all active and completed reservations
- System Monitoring view logs and system notifications
- Data Export access to booking and user data

### System Features
- Row-Level Security database-level access control
- Background Processing automated booking completion via cron jobs
- Email Notifications user status updates and booking confirmations
- Responsive Design mobile-first approach with Tailwind CSS
- Type Safety full TypeScript implementation
- Edge Functions serverless API endpoints with Supabase

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    BOOKING SYSTEM                       │
└─────────────────────────────────────────────────────────┘

┌───────────────────┐          ┌──────────────────────────┐
│   Frontend        │◄────────►│    Supabase Backend      │
│  (SvelteKit)      │          │  (Auth, Database, APIs)  │
└───────────────────┘          └──────────────────────────┘
        │                              │
        │ TypeScript, Tailwind         │ PostgreSQL
        │ SvelteKit, i18n              │ Row-Level Security (RLS)
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

### Core Components

- **Frontend**: SvelteKit application with responsive UI
- **Backend**: Supabase (PostgreSQL + Auth + Edge Functions)
- **API**: RESTful endpoints for cron jobs and external integrations
- **Database**: Relational schema with RLS policies
- **Deployment**: Vercel for frontend and cron jobs

---

## Tech Stack

### Frontend
- **Framework**: [SvelteKit](https://kit.svelte.dev/) - Modern web framework
- **Language**: [TypeScript](https://www.typescriptlang.org/) - Type-safe JavaScript
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS
- **Internationalization**: [svelte-i18n](https://github.com/kaisermann/svelte-i18n) - Multi-language support
- **Validation**: [Zod](https://zod.dev/) - Schema validation
- **Icons**: Custom SVG components

### Backend
- **Platform**: [Supabase](https://supabase.com/) - Backend-as-a-Service
- **Database**: [PostgreSQL](https://www.postgresql.org/) - Relational database
- **Authentication**: Supabase Auth with custom student ID login
- **API**: Supabase Edge Functions (Deno runtime)
- **Storage**: Supabase Storage for file uploads

### Infrastructure
- **Hosting**: [Vercel](https://vercel.com/) - Frontend deployment
- **Cron Jobs**: Vercel Cron for background processing
- **Version Control**: Git with GitHub
- **CI/CD**: Automated deployment pipelines

### Development Tools
- **Build Tool**: [Vite](https://vitejs.dev/) - Fast development server
- **Testing**: [Playwright](https://playwright.dev/) - End-to-end testing
- **Linting**: ESLint with TypeScript support
- **Package Manager**: npm with lockfile

---

## Quick Start

### Prerequisites

- Node.js v18 or later
- npm v8 or later
- Supabase CLI (optional, for local development)
- Git for version control

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/booking-system.git
   cd booking-system
   ```

2. **Install dependencies**
   ```bash
   npm install
   cd frontend && npm install
   ```

3. **Environment Setup**
   Create `.env.local` in the root directory:
   ```env
   # Supabase Configuration
   VITE_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   VITE_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

   # Cron Secret (for Vercel)
   CRON_SECRET=your-secure-random-token
   ```

4. **Database Setup**
   - Create a new Supabase project
   - Run migrations from `supabase/migrations/`
   - Deploy edge functions from `supabase/functions/`

### Development

```bash
# Start frontend development server
npm run dev

# Or run frontend directly
cd frontend && npm run dev
```

### Production Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

---

## Project Structure

```
booking-system/
├── frontend/                 # SvelteKit application
│   ├── src/
│   │   ├── lib/             # Utilities and components
│   │   ├── pages/           # Route components
│   │   ├── styles/          # Global styles
│   │   └── types/           # TypeScript definitions
│   ├── static/              # Static assets
│   └── tests/               # End-to-end tests
├── supabase/                # Backend configuration
│   ├── functions/           # Edge Functions
│   └── migrations/          # Database migrations
├── api/                     # Vercel API routes
│   └── cron/                # Background job triggers
├── static/                  # Shared static assets
└── package.json             # Root dependencies
```

---

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_PUBLIC_SUPABASE_URL` | Supabase project URL | Yes |
| `VITE_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for server operations | Yes |
| `CRON_SECRET` | Secret token for cron job authentication | Yes |

### Supabase Setup

1. Create a new Supabase project
2. Enable Row Level Security (RLS)
3. Run database migrations
4. Deploy edge functions
5. Configure authentication settings

---

## Contributing

We welcome contributions! Please follow these steps:

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes**
4. **Run tests**
   ```bash
   cd frontend && npm run test:e2e
   ```
5. **Commit your changes**
   ```bash
   git commit -m "Add your feature description"
   ```
6. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```
7. **Create a Pull Request**

### Development Guidelines

- Follow TypeScript best practices
- Write meaningful commit messages
- Add tests for new features
- Update documentation as needed
- Ensure responsive design works on all devices

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

- [Supabase](https://supabase.com/) for the amazing backend platform
- [SvelteKit](https://kit.svelte.dev/) for the excellent framework
- [Tailwind CSS](https://tailwindcss.com/) for the utility-first styling
- [Vercel](https://vercel.com/) for hosting and deployment

---

## Support

If you have questions or need help:

- Email: marwaneboulahya@gmail.com
- Issues: [GitHub Issues](https://github.com/your-username/booking-system/issues)
- Documentation: [Project Wiki](https://github.com/your-username/booking-system/wiki)

---

<div align="center">

Made with ❤️ for educational institutions

</div>