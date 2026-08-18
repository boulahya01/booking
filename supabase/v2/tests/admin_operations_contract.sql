-- UNEEM V2 audited admin operations contract tests.
-- Run against the final V2 schema through layer 024. All fixtures roll back.
-- Synthetic confirmed Supabase Auth rows are paired with profile fixtures so
-- confirmation-aware admin authorization is exercised explicitly.

\set ON_ERROR_STOP on

begin;
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
    '71000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'operations-admin@usmba.ac.ma', '', now(),
    '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '71000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'operations-student@usmba.ac.ma', '', now(),
    '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.profiles (id, student_id, full_name, role, status, email_kind, identity_status)
values
  ('71000000-0000-4000-8000-000000000001', 'S710000001', 'Operations Admin', 'admin', 'approved', 'academic', 'verified'),
  ('71000000-0000-4000-8000-000000000002', 'S710000002', 'Student One', 'student', 'approved', 'academic', 'verified');

insert into public.pitches (
  id, name, location, sport_type, capacity, timezone, open_time, close_time,
  slot_duration_minutes, booking_window_hours, booking_frequency_enabled,
  booking_frequency_days, cancellation_cutoff_minutes, is_active, sort_order
) values (
  '72000000-0000-4000-8000-000000000001', 'Test Court', 'Campus', 'Basketball', 10,
  'Africa/Casablanca', '08:00', '22:00', 60, 168, false, 7, 60, true, 0
);

insert into public.bookings (id, user_id, pitch_id, starts_at, ends_at, status)
values (
  '73000000-0000-4000-8000-000000000001',
  '71000000-0000-4000-8000-000000000002',
  '72000000-0000-4000-8000-000000000001',
  now() + interval '2 days', now() + interval '2 days 1 hour', 'scheduled'
);

set local session_replication_role = origin;

-- 1. Normal authenticated clients cannot mutate facility rows directly.
select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000002', true);
set local role authenticated;
do $$
begin
  begin
    update public.pitches set capacity = 99 where id = '72000000-0000-4000-8000-000000000001';
    raise exception 'FAIL: direct facility update unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;
reset role;

-- 2. Non-admin callers cannot use audited admin operations.
select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000002', true);
set local role authenticated;
do $$
begin
  begin
    perform public.admin_cancel_booking('73000000-0000-4000-8000-000000000001', 'maintenance');
    raise exception 'FAIL: student admin cancellation unexpectedly succeeded';
  exception
    when others then
      if sqlerrm not like '%admin_required%' then raise; end if;
  end;
end;
$$;
reset role;

-- 3. Admin booking cancellation is authoritative. The authenticated client sees
-- only the RPC result; the privileged harness verifies the audit record directly.
select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000001', true);
set local role authenticated;
do $$
declare
  v_booking public.bookings;
begin
  v_booking := public.admin_cancel_booking('73000000-0000-4000-8000-000000000001', 'maintenance');
  if v_booking.status <> 'cancelled' or v_booking.cancelled_by <> '71000000-0000-4000-8000-000000000001' then
    raise exception 'FAIL: admin cancellation state was not persisted';
  end if;
end;
$$;
reset role;

do $$
begin
  if not exists (
    select 1 from public.admin_audit_log
    where action = 'booking_cancelled'
      and target_id = '73000000-0000-4000-8000-000000000001'
      and actor_id = '71000000-0000-4000-8000-000000000001'
      and reason_code = 'maintenance'
  ) then
    raise exception 'FAIL: booking cancellation audit entry missing';
  end if;
end;
$$;

-- 4. Facility updates go through one audited RPC and preserve row identity.
select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000001', true);
set local role authenticated;
do $$
declare
  v_pitch public.pitches;
begin
  v_pitch := public.admin_save_pitch(
    '72000000-0000-4000-8000-000000000001',
    'Updated Court', 'Main Campus', 'Basketball', 12,
    '09:00', '21:00', 90, 240, true, 5, 120, true, 2, 'Africa/Casablanca'
  );

  if v_pitch.name <> 'Updated Court' or v_pitch.capacity <> 12 or v_pitch.slot_duration_minutes <> 90 then
    raise exception 'FAIL: audited facility update did not persist';
  end if;
end;
$$;
reset role;

do $$
begin
  if not exists (
    select 1 from public.admin_audit_log
    where action = 'facility_updated'
      and target_id = '72000000-0000-4000-8000-000000000001'
      and actor_id = '71000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'FAIL: facility update audit entry missing';
  end if;
end;
$$;

-- 5. Archive replaces destructive deletion and records a structured reason.
select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000001', true);
set local role authenticated;
do $$
declare
  v_pitch public.pitches;
begin
  v_pitch := public.admin_archive_pitch('72000000-0000-4000-8000-000000000001', 'retired');
  if v_pitch.is_active then raise exception 'FAIL: facility remained active after archive'; end if;
end;
$$;
reset role;

do $$
begin
  if not exists (
    select 1 from public.admin_audit_log
    where action = 'facility_archived'
      and target_id = '72000000-0000-4000-8000-000000000001'
      and actor_id = '71000000-0000-4000-8000-000000000001'
      and reason_code = 'retired'
  ) then
    raise exception 'FAIL: facility archive audit entry missing';
  end if;
end;
$$;

rollback;
\echo 'UNEEM V2 final-schema admin operations contract tests passed.'
