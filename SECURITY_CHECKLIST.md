# Security Checklist Before Deployment

## ✅ Sensitive Files to NEVER Commit

### Environment Variables
- `frontend/.env.local` - Contains API keys & secrets
- `.env` - Root environment file
- `.env.cron` - Cron job secrets
- `supabase/.env.local` - Supabase local config

### Files with Hardcoded Credentials
- `test_booking_jobs_trigger.js` - Contains Supabase keys
- `test_get_columns.js` - May contain credentials
- `.env.cron.example` - Real credentials (should be sanitized)

## 🔐 Secrets Currently Exposed (DO NOT PUSH)

### Found in frontend/.env.local:
- ❌ `POSTGRES_PASSWORD` 
- ❌ `SUPABASE_ANON_KEY` (JWT token)
- ❌ `SUPABASE_JWT_SECRET`
- ❌ `SUPABASE_SECRET_KEY` (sb_secret_*)
- ❌ `SUPABASE_SERVICE_ROLE_KEY` (JWT)
- ❌ `VERCEL_OIDC_TOKEN` (JWT)

### Found in test files:
- ❌ Hardcoded Supabase credentials in `test_booking_jobs_trigger.js`

## 📋 Updated .gitignore Patterns

All three `.gitignore` files have been updated to ignore:
```
.env
.env.local
.env.*.local
.env.cron
.env.cron.local
.env.cron.example
.supabase/
supabase/.env.local
```

## ✅ Safe to Push

### Source Code
- All `.tsx`, `.ts`, `.sql` files
- Component files
- Configuration files (`vite.config.ts`, `tsconfig.json`)

### Documentation
- All `.md` files
- API documentation
- Architecture diagrams

### Config Files (Safe)
- `package.json` (without lock files)
- `vercel.json` (if no secrets)
- `supabase/config.toml` (if no credentials)

## 🚀 Pre-Push Verification

Run before committing:

```bash
# Check for any accidentally staged secrets
git status | grep -E "\.env|secret|token"

# Check staged files for sensitive patterns
git diff --cached | grep -E "password|token|key.*=" | grep -v "\.tsx\|\.ts\|\.md"

# List what will be pushed
git diff --name-only --cached | sort
```

## 🔧 Immediate Actions Required

1. ✅ `.gitignore` files updated
2. ⚠️ Remove credentials from test files (optional - test files won't be pushed)
3. ✅ `frontend/.env.local` is ignored
4. ✅ `.env.cron.example` is ignored

## 📝 Notes

- All `.env.local` files are now properly ignored
- The root `.gitignore` includes catch-all patterns for `*secret*`, `*private*`, `*token*`
- IDE files (`.vscode/`, `.idea/`) are now ignored
- Build outputs and node_modules are excluded
