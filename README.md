# Booking Application

A full-stack booking application built with:
- **Backend**: Supabase with PostgreSQL database and Edge Functions
- **Frontend**: React + TypeScript with Vite

## Project Structure

```
booking/
├── frontend/              # Vite + React + TypeScript frontend
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   └── lib/
│   │       └── supabaseClient.ts
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json
├── supabase/             # Supabase backend configuration
│   ├── config.toml
│   └── functions/        # Edge functions
│       ├── hello-world/
│       ├── bookings/
│       └── .env.example
└── package.json          # Root package.json
```

## Prerequisites

- Node.js 18+ and npm/pnpm
- Supabase CLI (installed globally)

## Installation

### 1. Install Supabase CLI

```bash
npm install -g supabase
```

### 2. Install Dependencies

```bash
# Install root dependencies
npm install

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### 3. Initialize Supabase

```bash
supabase init
```

## Development

### Start the entire stack

```bash
npm run dev
```

This will:
- Start Supabase local development environment
- Run the Vite dev server on http://localhost:5173
- Supabase Studio will be available at http://localhost:54323

### Individual Commands

```bash
# Start only Supabase
npm run supabase:start

# Start only frontend
npm run frontend:dev

# Stop Supabase
npm run supabase:stop
```

## Building

```bash
# Build frontend
npm run frontend:build

# Preview production build
npm run frontend:preview
```

## Edge Functions

Edge functions are TypeScript/Deno functions that run on Supabase.

### Available Functions

- **`hello-world`**: Simple example function
- **`bookings`**: Handle GET/POST bookings operations

### Deploy Functions

```bash
npm run supabase:functions:deploy
```

## Environment Variables

Create a `.env.local` file in the frontend directory:

```
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=your_anon_key
```

## Database Schema

The application uses a `bookings` table. Create it with:

```sql
CREATE TABLE bookings (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  title TEXT NOT NULL,
  date TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## API Endpoints

- `POST /functions/v1/bookings` - Create a booking
- `GET /functions/v1/bookings` - Get all bookings
- `POST /functions/v1/hello-world` - Test endpoint

## Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Vite Documentation](https://vitejs.dev)
- [React Documentation](https://react.dev)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
