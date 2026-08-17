# Booking V1 -> V2 Migration Plan

Status: planning / read-only production audit complete

This document records the data-preservation and cutover rules for V2. It is intentionally separate from executable production migrations.

## Non-negotiable rule

V2 does not wipe production data.

Existing authentication accounts, profile identities, facilities and booking history must be preserved or explicitly quarantined when the source data is inconsistent. No source row is silently discarded.

## Source audit snapshot

Read-only audit of the production `BOOKING` Supabase project on 2026-08-17:

| Entity | Count |
| --- | ---: |
| Auth users | 63 |
| Profiles | 62 |
| Facilities | 5 |
| Bookings | 109 |
| Persistent slots | 0 |
| Booking jobs | 0 |

### Profile/auth state

- 44 profiles are `approved`; all 44 belong to email-confirmed Auth users.
- 18 profiles are `pending`; all 18 belong to unconfirmed Auth users.
- There are no profile rows without an Auth user.
- There is one unconfirmed Auth user without a profile.
- That orphan Auth user's metadata Student ID already belongs to a different, approved, email-confirmed profile. It must not be auto-converted into a second profile. Treat it as a quarantined duplicate/stale signup until identity resolution is explicit.

### Booking integrity

- all 109 bookings reference an existing profile
- all 109 bookings reference an existing facility
- all 109 bookings have a start timestamp
- all 109 bookings have an end timestamp
- all 109 bookings are exactly one hour long
- 30 are cancelled
- 79 are still persisted as `active`, although every one of those 79 bookings has already ended
- no duplicate active pitch/start-time groups were found during the audit

The 79 stale `active` rows are lifecycle drift, not lost bookings. V2 keeps them as history and derives `completed` from timestamps.

### Facility compatibility

Existing facilities use:

- one-hour slots
- booking frequency limits of 3 or 7 days
- opening times between `00:00` and `08:00`
- closing times between `18:00` and the Postgres end-of-day value `24:00`

V2 supports `24:00` as a valid end-of-day boundary. The MVP intentionally does not support arbitrary overnight windows where closing time is earlier than opening time.

## Target strategy

The preferred V2 target is a clean Supabase/Postgres environment validated from `supabase/v2/schema.sql` before production cutover.

The current production migration history is not a trustworthy clean-room baseline, so V2 must not be created by replaying the historical V1 migration directory as-is.

### Authentication preservation

Supabase supports migrating Auth users between projects with their hashed passwords. User UUIDs can also be preserved. This allows existing credentials and profile foreign keys to survive a clean-project migration.

Reference: https://supabase.com/docs/guides/troubleshooting/migrating-auth-users-between-projects

A new Supabase project normally has a different JWT signing secret, so existing browser sessions should be treated as invalid at cutover unless there is a deliberate secret-migration decision. The safer default for this small user base is:

- preserve accounts, UUIDs and password hashes
- require one fresh sign-in after cutover
- do not require password resets or account recreation

This is an authentication-session reset, not user-data loss.

## Transform rules

### Auth users

- preserve UUID
- preserve email identity and confirmation state
- preserve password hash where applicable
- preserve required metadata used by onboarding
- quarantine the single duplicate/stale Auth-only account until resolved

### Profiles

V1 -> V2:

- `id` -> `id`
- `student_id` -> normalized `student_id`
- `full_name` -> trimmed `full_name`
- `role=admin` -> `admin`
- all other currently valid user roles -> `student` unless a real product requirement is identified before cutover
- `approved` -> `approved`
- `pending` -> `pending`
- any legacy rejected/suspended state found at the final snapshot requires an explicit mapping before import
- preserve `created_at` where practical

The migration must not create a profile for an Auth user when its Student ID conflicts with an existing profile.

### Facilities

Preserve facility IDs so historical booking relationships remain stable.

V1 -> V2:

- `name` -> trimmed `name`
- `location` -> trimmed `location`
- `sport_type` -> trimmed `sport_type`
- `capacity` -> `capacity`
- `open_time` -> `open_time`
- `close_time` -> `close_time`
- inferred `slot_duration_minutes` -> `60`
- current availability window -> `booking_window_hours=24`
- `booking_frequency_enabled` -> unchanged
- `booking_frequency_days` -> unchanged
- V1 cancellation behavior -> `cancellation_cutoff_minutes=60`
- facility timezone -> `Africa/Casablanca`
- `sort_order` -> unchanged
- `is_active=true` unless a facility is explicitly retired before cutover

`24:00` is preserved as the end-of-day boundary.

### Bookings

Preserve booking IDs.

V1 -> V2:

- `id` -> `id`
- `user_id` -> `user_id`
- `pitch_id` -> `pitch_id`
- `slot_datetime` -> `starts_at`
- `slot_datetime_end` -> `ends_at`
- V1 `cancelled` -> V2 persisted `cancelled`
- V1 `active` -> V2 persisted `scheduled`
- cancelled rows receive the best available cancellation timestamp if recoverable; otherwise the migration must record that the historical timestamp is unknown rather than fabricate one
- `created_at` -> `created_at`

V2 derives display lifecycle:

- scheduled + future -> `upcoming`
- scheduled + currently running -> `in_progress`
- scheduled + ended -> `completed`
- cancelled -> `cancelled`

This means the 79 stale V1 `active` rows become truthful completed history without a destructive status-cleanup job.

## Pre-cutover validation gates

A cutover is blocked unless all of these pass on the target:

1. Auth user count matches the expected migration set plus the explicitly quarantined row policy.
2. Profile count and IDs match the approved migration mapping.
3. Facility count is 5 unless production changed after this snapshot.
4. Booking count is 109 unless production changed after this snapshot.
5. No booking has an orphan `user_id` or `pitch_id`.
6. All migrated bookings have `ends_at > starts_at`.
7. No overlapping scheduled bookings violate the exclusion constraint.
8. Approved users can read facilities and availability.
9. Availability returns only the intended peer display field for occupied slots.
10. Students cannot update protected profile role/status fields.
11. Students cannot modify another student's booking.
12. Concurrent attempts for the same facility/time produce exactly one successful booking.
13. Frequency-limit behavior matches each facility's configured rule.
14. Cancellation cutoff behaves correctly at the boundary.
15. Admin-only mutations reject normal students.
16. Home, facility booking, My Booking and admin smoke flows pass against the target.

## Cutover sequence

1. Freeze schema changes on V1.
2. Take a final read-only audit and export/backup.
3. Recompute counts and anomaly list; do not assume the 2026-08-17 snapshot is still current.
4. Import/migrate Auth identities.
5. Apply the validated V2 schema and profile/facility/booking transform in the tested order.
6. Run integrity and RLS tests.
7. Deploy V2 application against the target.
8. Run authenticated smoke tests with student and admin accounts.
9. Switch production configuration only after all gates pass.
10. Keep the V1 project/database available for rollback until the cutover is accepted.

## Rollback rule

The V1 source is never destroyed during initial cutover. If a blocking V2 issue appears, application traffic/configuration can be pointed back to the unchanged V1 source while the target is corrected.
