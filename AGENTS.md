# Repository Engineering Rules

## Live users and production data

UNEEM is live and has real users. Treat the connected Supabase project and
deployed website as production, not as a disposable test environment.

- Keep production audits read-only by default. Run mutation, capacity, cancellation,
  and concurrency tests against an isolated database with fictional fixtures.
- Never reset, truncate, reseed, bulk-delete, or overwrite live accounts, bookings,
  match participation, verification records, or support conversations for testing.
- Preserve existing users and data when preparing migrations. Validate changes in
  isolation and prepare a rollback plan before requesting production deployment.
- Do not create test users or send test emails through production unless the user
  explicitly authorizes that specific test and account.
- Keep real user data out of exported logs, screenshots, fixtures, and reports.
  Record aggregate timings and sanitized results instead.
- A successful local build or mocked browser test is not proof of production
  performance, database safety, or release completion.

## Personal-data prohibition

This repository and every deployed/public build must not contain a contributor's, operator's, owner's, maintainer's, or tester's real personal data.

Do not commit or publish real:

- names or initials used as identity examples
- personal email addresses or phone numbers
- home, school, work, or personal location details unless they are product-owned public business data explicitly required by the product
- account usernames, provider account slugs, personal preview hostnames, profile URLs, or personal social handles
- IDs, student numbers, government identifiers, payment details, or authentication/recovery material
- screenshots, fixtures, seed data, demos, documentation, tests, logs, analytics examples, or mock data containing real personal information

Use clearly fictional or generic data such as `Student`, `Test User`, `student@example.com`, generated UUIDs, and project-owned domains.

Secrets and environment-specific identifiers belong in the deployment provider, secret manager, or local ignored environment files, never in versioned source.

If a feature genuinely requires real user data at runtime, collect and process it only through the application's intended secure data path. Never turn that runtime data into committed fixtures, examples, screenshots, snapshots, logs, or static/public content.

Before creating a PR or production deployment, inspect changed files for accidental personal data. If uncertain whether a value is personal, treat it as personal and replace it with a generic/project-owned value.
