# E2E Tests

End-to-end tests using Playwright for the booking app.

## Setup

```bash
# Install browsers (first time only)
npx playwright install chromium

# Or with system dependencies:
npx playwright install --with-deps chromium
```

## Running Tests

```bash
# Run all tests (headless)
npm run test:e2e

# Run tests with UI (interactive)
npm run test:e2e:ui

# Run tests in headed mode (see browser)
npm run test:e2e:headed

# View test report
npm run test:e2e:report
```

## Test Files

| File | What it tests |
|------|---------------|
| `login.spec.ts` | Login flow, validation, route guards, auth redirects |
| `booking.spec.ts` | Home page, pitch browsing, slot selection, booking confirmation |
| `admin.spec.ts` | Admin panel access, form validation, i18n, error handling |

## Mock Mode

Tests run with mock data by default. To test against real backend, set:
```bash
USE_MOCK=false npm run test:e2e
```

Note: Real backend tests require a running Supabase instance and valid test credentials.
