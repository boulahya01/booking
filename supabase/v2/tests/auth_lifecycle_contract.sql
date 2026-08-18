-- UNEEM V2 authentication lifecycle contract tests.
-- Run after schema layers 001-021. All fixtures roll back.
--
-- These fixtures model profile/Auth drift and recovery-session edge cases. The
-- database must fail closed whenever profile status and Auth confirmation differ.

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
    '81000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'unconfirmed@usmba.ac.ma', '', null,
    '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '81000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'personal@example.com', '', now(),
    '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '81000000-0000-4000-8000-000000000003',
    'authenticated', 'authenticated', 'owner@usmba.ac.ma', '', null,
    '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '81000000-0000-4000-8000-000000000004',
    'authenticated', 'authenticated', 'autoconfirmed@usmba.ac.ma', '', now(),
    '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.profiles (
  id, student_id, full_name, username, role, status, email_kind, identity_status
) values
  ('81000000-0000-4000-8000-000000000001', null, 'Unconfirmed Academic', 'unconfirmed_academic', 'student', 'approved', 'academic', 'required'),
  ('81000000-0000-4000-8000-000000000002', 'S810000002', 'Confirmed Personal', 'confirmed_personal', 'student', 'pending', 'personal', 'required'),
  ('81000000-0000-4000-8000-000000000003', null, 'Admin Candidate', 'admin_candidate', 'student', 'pending', 'academic', 'required'),
  ('81000000-0000-4000-8000-000000000004', null, 'Auto Confirm Guard', 'auto_confirm_guard', 'student', 'pending', 'academic', 'required');

-- Student-card object fixtures for auth lifecycle tests.
insert into storage.objects (bucket_id, name)
values
  (
    'student-verification',
    '81000000-0000-4000-8000-000000000001/card.webp'
  ),
  (
    'student-verification',
    '81000000-0000-4000-8000-000000000002/card.webp'
  );
insert into public.pitches (
  id, name, location, sport_type, capacity, timezone, open_time, close_time,
  slot_duration_minutes, booking_window_hours, booking_frequency_enabled,
  booking_frequency_days, cancellation_cutoff_minutes, is_active, sort_order
) values (
  '82000000-0000-4000-8000-000000000001',
  'Auth Contract Court', 'Campus', 'Football', 10, 'Africa/Casablanca',
  '08:00', '22:00', 60, 168, false, 7, 60, true, 0
);

set local session_replication_role = origin;

-- 1. Profile approval alone never grants sports access while Auth email is unconfirmed.
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000001', true);
set local role authenticated;

do $$
declare
  v_state record;
begin
  select * into v_state from public.get_my_account_state();
  if v_state.can_use_sports then
    raise exception 'FAIL: unconfirmed approved profile received sports access';
  end if;
  if v_state.restriction_reason <> 'email_confirmation_required' then
    raise exception 'FAIL: unconfirmed account did not expose confirmation requirement';
  end if;
end;
$$;

-- 2. Booking creation fails closed even if the profile has drifted to approved.
do $$
declare
  v_start timestamptz := (((now() at time zone 'Africa/Casablanca')::date + 2 + time '10:00') at time zone 'Africa/Casablanca');
begin
  begin
    perform public.create_booking('82000000-0000-4000-8000-000000000001', v_start);
    raise exception 'FAIL: unconfirmed account created a booking';
  exception
    when others then
      if sqlerrm not like '%account_not_approved%' then raise; end if;
  end;
end;
$$;

-- Create the pre-existing booking only after the booking authorization test.
-- It exists solely so Test #3 can exercise the match authorization boundary.
reset role;
set local session_replication_role = replica;

insert into public.bookings (
  id, user_id, pitch_id, starts_at, ends_at, status
) values (
  '83000000-0000-4000-8000-000000000001',
  '81000000-0000-4000-8000-000000000001',
  '82000000-0000-4000-8000-000000000001',
  (((now() at time zone 'Africa/Casablanca')::date + 1 + time '09:00') at time zone 'Africa/Casablanca'),
  (((now() at time zone 'Africa/Casablanca')::date + 1 + time '10:00') at time zone 'Africa/Casablanca'),
  'scheduled'
);

set local session_replication_role = origin;
select set_config(
  'request.jwt.claim.sub',
  '81000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;
-- 3. Match mutations use the same confirmed-email sports gate.
do $$
begin
  begin
    perform public.create_open_match('83000000-0000-4000-8000-000000000001', 0);
    raise exception 'FAIL: unconfirmed account created an open match';
  exception
    when others then
      if sqlerrm not like '%account_not_approved%' then raise; end if;
  end;
end;
$$;

-- 4. A temporary authenticated session cannot submit student-card identity
-- evidence until its email credential is actually confirmed.
do $$
begin
  begin
    perform public.submit_identity_verification('S819999999', '81000000-0000-4000-8000-000000000001/card.webp');
    raise exception 'FAIL: unconfirmed account submitted identity verification';
  exception
    when others then
      if sqlerrm not like '%email_confirmation_required%' then raise; end if;
  end;
end;
$$;
reset role;

-- 5. The owner-only first-admin bootstrap refuses an unconfirmed target.
do $$
begin
  begin
    perform private.bootstrap_first_admin('81000000-0000-4000-8000-000000000003');
    raise exception 'FAIL: unconfirmed account became first admin';
  exception
    when others then
      if sqlerrm not like '%email_confirmation_required%' then raise; end if;
  end;
end;
$$;

-- 6. A personal-email account cannot become first admin merely because its email
-- is confirmed; Student ID ownership must already be verified.
do $$
begin
  begin
    perform private.bootstrap_first_admin('81000000-0000-4000-8000-000000000002');
    raise exception 'FAIL: unverified personal-email account became first admin';
  exception
    when others then
      if sqlerrm not like '%bootstrap_identity_not_verified%' then raise; end if;
  end;
end;
$$;

-- 7. A confirmed credential paired with a pending application profile remains
-- blocked. This is the fail-closed state expected when Auth is accidentally set
-- to auto-confirm new users: handle_new_user() always creates pending profiles.
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000004', true);
set local role authenticated;
do $$
declare
  v_state record;
begin
  select * into v_state from public.get_my_account_state();
  if v_state.can_use_sports then
    raise exception 'FAIL: auto-confirm guard profile received sports access';
  end if;
  if v_state.access_status <> 'pending' then
    raise exception 'FAIL: auto-confirm guard profile did not remain pending';
  end if;
end;
$$;
reset role;

-- 8. Confirming the academic email unlocks the already-approved drift fixture at
-- the database capability boundary; booking succeeds once the stale fixture is removed.
update auth.users
set email_confirmed_at = now(), updated_at = now()
where id = '81000000-0000-4000-8000-000000000001';

delete from public.bookings where id = '83000000-0000-4000-8000-000000000001';

select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000001', true);
set local role authenticated;

do $$
declare
  v_state record;
  v_booking public.bookings;
  v_start timestamptz := (((now() at time zone 'Africa/Casablanca')::date + 1 + time '10:00') at time zone 'Africa/Casablanca');
begin
  select * into v_state from public.get_my_account_state();
  if not v_state.can_use_sports then
    raise exception 'FAIL: confirmed approved academic account remained blocked';
  end if;

  v_booking := public.create_booking('82000000-0000-4000-8000-000000000001', v_start);
  if v_booking.user_id <> '81000000-0000-4000-8000-000000000001' then
    raise exception 'FAIL: confirmed academic booking was not created for caller';
  end if;
end;
$$;
reset role;

-- 9. A confirmed personal-email account remains sports-blocked while identity is
-- pending, but can submit evidence through the normal verification workflow.
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000002', true);
set local role authenticated;

do $$
declare
  v_state record;
  v_attempt public.identity_verification_attempts;
begin
  select * into v_state from public.get_my_account_state();
  if v_state.can_use_sports then
    raise exception 'FAIL: confirmed personal account bypassed identity approval';
  end if;

  v_attempt := public.submit_identity_verification(
    'S810000002',
    '81000000-0000-4000-8000-000000000002/card.webp'
  );
  if v_attempt.status <> 'pending' then
    raise exception 'FAIL: confirmed personal verification submission was not accepted';
  end if;
end;
$$;
reset role;

-- 10. First-admin bootstrap succeeds after the academic candidate email is
-- confirmed, and the resulting admin predicate becomes true for that caller.
update auth.users
set email_confirmed_at = now(), updated_at = now()
where id = '81000000-0000-4000-8000-000000000003';

select private.bootstrap_first_admin('81000000-0000-4000-8000-000000000003');

select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000003', true);
set local role authenticated;
do $$
begin
  if not private.is_admin() then
    raise exception 'FAIL: confirmed bootstrapped admin was not recognized';
  end if;
end;
$$;
reset role;

rollback;
\echo 'UNEEM V2 authentication lifecycle contract tests passed.'
