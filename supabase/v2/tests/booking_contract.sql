-- UNEEM V2 booking contract tests.
--
-- Run against the final V2 schema through layer 024.
-- The entire suite is transactional and rolls back its fixtures.
-- Synthetic Supabase Auth rows are created alongside profiles so the suite
-- exercises the final confirmation-aware authorization contract instead of
-- relying on pre-021 profile-only fixtures.

\set ON_ERROR_STOP on

begin;

set local timezone = 'UTC';

set local session_replication_role = replica;

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'booking1@usmba.ac.ma', '', now(),
    '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'booking2@usmba.ac.ma', '', now(),
    '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-4000-8000-000000000003',
    'authenticated', 'authenticated', 'bookingadmin@usmba.ac.ma', '', now(),
    '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-4000-8000-000000000004',
    'authenticated', 'authenticated', 'booking4@usmba.ac.ma', '', now(),
    '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-4000-8000-000000000005',
    'authenticated', 'authenticated', 'booking5@usmba.ac.ma', '', now(),
    '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.profiles (id, student_id, full_name, role, status)
values
  ('10000000-0000-4000-8000-000000000001', 'T000000001', 'Student One', 'student', 'approved'),
  ('10000000-0000-4000-8000-000000000002', 'T000000002', 'Student Two', 'student', 'approved'),
  ('10000000-0000-4000-8000-000000000003', 'T000000003', 'Test Admin', 'admin', 'approved'),
  ('10000000-0000-4000-8000-000000000004', 'T000000004', 'Student Four', 'student', 'approved'),
  ('10000000-0000-4000-8000-000000000005', 'T000000005', 'Student Five', 'student', 'approved');

set local session_replication_role = origin;

insert into public.pitches (
  id,
  name,
  location,
  sport_type,
  timezone,
  open_time,
  close_time,
  slot_duration_minutes,
  booking_window_hours,
  booking_frequency_enabled,
  booking_frequency_days,
  cancellation_cutoff_minutes,
  is_active,
  sort_order
)
values
  (
    '20000000-0000-4000-8000-000000000001',
    'Shared schedule pitch',
    'Test campus',
    'football',
    'UTC',
    time '00:00',
    time '24:00',
    60,
    168,
    false,
    1,
    60,
    true,
    1
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    'Frequency pitch',
    'Test campus',
    'basketball',
    'UTC',
    time '00:00',
    time '24:00',
    60,
    168,
    true,
    3,
    60,
    true,
    2
  ),
  (
    '20000000-0000-4000-8000-000000000003',
    'Cancellation pitch',
    'Test campus',
    'volleyball',
    'UTC',
    time '00:00',
    time '24:00',
    60,
    168,
    false,
    1,
    60,
    true,
    3
  );

-- 1. A normal student can create an aligned future booking through the RPC.
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
set local role authenticated;

select public.create_booking(
  '20000000-0000-4000-8000-000000000001',
  date_trunc('hour', now()) + interval '4 hours'
);

reset role;

do $$
begin
  if not exists (
    select 1
    from public.bookings
    where user_id = '10000000-0000-4000-8000-000000000001'
      and pitch_id = '20000000-0000-4000-8000-000000000001'
      and starts_at = date_trunc('hour', now()) + interval '4 hours'
      and ends_at = date_trunc('hour', now()) + interval '5 hours'
      and status = 'scheduled'
  ) then
    raise exception 'FAIL: create_booking did not create the expected one-hour booking';
  end if;
end;
$$;

-- 2. A second student cannot take the same pitch/time.
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
set local role authenticated;

do $$
begin
  begin
    perform public.create_booking(
      '20000000-0000-4000-8000-000000000001',
      date_trunc('hour', now()) + interval '4 hours'
    );
    raise exception 'FAIL: overlapping booking unexpectedly succeeded';
  exception
    when others then
      if sqlerrm <> 'slot_unavailable' then
        raise;
      end if;
  end;
end;
$$;

reset role;

-- 3. Shared availability exposes only the booked student's display name.
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
set local role authenticated;

do $$
declare
  v_count integer;
begin
  select count(*)
  into v_count
  from public.get_pitch_availability(
    '20000000-0000-4000-8000-000000000001',
    ((date_trunc('hour', now()) + interval '4 hours') at time zone 'UTC')::date
  ) a
  where a.starts_at = date_trunc('hour', now()) + interval '4 hours'
    and a.is_available = false
    and a.booker_name = 'Student One';

  if v_count <> 1 then
    raise exception 'FAIL: shared availability did not expose the expected peer display name';
  end if;
end;
$$;

reset role;

-- 4. Frequency limits still apply after a previous booking is completed.
insert into public.bookings (user_id, pitch_id, starts_at, ends_at, status)
values (
  '10000000-0000-4000-8000-000000000004',
  '20000000-0000-4000-8000-000000000002',
  date_trunc('hour', now()) - interval '24 hours',
  date_trunc('hour', now()) - interval '23 hours',
  'scheduled'
);

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000004', true);
set local role authenticated;

do $$
begin
  begin
    perform public.create_booking(
      '20000000-0000-4000-8000-000000000002',
      date_trunc('hour', now()) + interval '6 hours'
    );
    raise exception 'FAIL: frequency-limited booking unexpectedly succeeded';
  exception
    when others then
      if sqlerrm <> 'booking_frequency_limited' then
        raise;
      end if;
  end;
end;
$$;

reset role;

-- 5. A student can hold only one active/upcoming booking at a time.
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000005', true);
set local role authenticated;

select public.create_booking(
  '20000000-0000-4000-8000-000000000001',
  date_trunc('hour', now()) + interval '10 hours'
);

do $$
begin
  begin
    perform public.create_booking(
      '20000000-0000-4000-8000-000000000003',
      date_trunc('hour', now()) + interval '12 hours'
    );
    raise exception 'FAIL: second active booking unexpectedly succeeded';
  exception
    when others then
      if sqlerrm <> 'active_booking_exists' then
        raise;
      end if;
  end;
end;
$$;

reset role;

-- 6. Students cannot bypass RPC rules with direct booking INSERTs.
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
set local role authenticated;

do $$
begin
  begin
    insert into public.bookings (user_id, pitch_id, starts_at, ends_at, status)
    values (
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      date_trunc('hour', now()) + interval '14 hours',
      date_trunc('hour', now()) + interval '15 hours',
      'scheduled'
    );
    raise exception 'FAIL: authenticated user unexpectedly wrote directly to bookings';
  exception
    when insufficient_privilege then
      null;
  end;
end;
$$;

reset role;

-- 7. Cancellation is blocked inside the configured cutoff.
insert into public.bookings (id, user_id, pitch_id, starts_at, ends_at, status)
values (
  '30000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000003',
  now() + interval '30 minutes',
  now() + interval '90 minutes',
  'scheduled'
);

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
set local role authenticated;

do $$
begin
  begin
    perform public.cancel_booking('30000000-0000-4000-8000-000000000001');
    raise exception 'FAIL: cancellation inside cutoff unexpectedly succeeded';
  exception
    when others then
      if sqlerrm <> 'cancellation_window_closed' then
        raise;
      end if;
  end;
end;
$$;

reset role;

-- 8. Cancellation succeeds outside the cutoff and records who cancelled it.
insert into public.bookings (id, user_id, pitch_id, starts_at, ends_at, status)
values (
  '30000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000003',
  date_trunc('hour', now()) + interval '6 hours',
  date_trunc('hour', now()) + interval '7 hours',
  'scheduled'
);

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select public.cancel_booking('30000000-0000-4000-8000-000000000002');
reset role;

do $$
begin
  if not exists (
    select 1
    from public.bookings
    where id = '30000000-0000-4000-8000-000000000002'
      and status = 'cancelled'
      and cancelled_at is not null
      and cancelled_by = '10000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'FAIL: cancel_booking did not persist the expected cancellation state';
  end if;
end;
$$;

-- 9. Lifecycle status is derived from timestamps rather than completion jobs.
insert into public.bookings (id, user_id, pitch_id, starts_at, ends_at, status)
values (
  '30000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000003',
  now() - interval '2 hours',
  now() - interval '1 hour',
  'scheduled'
);

do $$
begin
  if not exists (
    select 1
    from public.booking_timeline
    where id = '30000000-0000-4000-8000-000000000003'
      and lifecycle_status = 'completed'
  ) then
    raise exception 'FAIL: past scheduled booking was not derived as completed';
  end if;
end;
$$;

rollback;

\echo 'UNEEM V2 booking contract tests passed.'
