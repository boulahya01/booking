-- UNEEM V2 authoritative backend-read contract tests.
-- Run after schema layers through 018_backend_read_contract.sql.
-- All fixtures roll back.

\set ON_ERROR_STOP on

begin;
set local timezone = 'UTC';
set local session_replication_role = replica;

insert into public.profiles (
  id, student_id, full_name, username, role, status, email_kind, identity_status
) values
  ('71000000-0000-4000-8000-000000000001', 'S710000001', 'Player One', 'one_player', 'student', 'approved', 'academic', 'verified'),
  ('71000000-0000-4000-8000-000000000002', 'S710000002', 'Player Two', 'two_player', 'student', 'approved', 'personal', 'verified'),
  ('71000000-0000-4000-8000-000000000003', 'S710000003', 'Pending Player', 'pending_player', 'student', 'pending', 'personal', 'pending'),
  ('71000000-0000-4000-8000-000000000004', 'S710000004', 'Operations Admin', 'ops_admin', 'admin', 'approved', 'academic', 'verified');

insert into public.pitches (
  id, name, location, sport_type, capacity, timezone, open_time, close_time,
  slot_duration_minutes, booking_window_hours, booking_frequency_enabled,
  booking_frequency_days, cancellation_cutoff_minutes, is_active, sort_order
) values (
  '72000000-0000-4000-8000-000000000001', 'Backend Contract Pitch', 'Test Campus', 'football', 10,
  'UTC', time '00:00', time '24:00', 60, 168, false, 1, 60, true, 1
);

insert into public.bookings (
  id, user_id, pitch_id, starts_at, ends_at, status, created_at
) values
  ('73000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000001', date_trunc('hour', now()) + interval '2 hours', date_trunc('hour', now()) + interval '3 hours', 'scheduled', now() - interval '1 day'),
  ('73000000-0000-4000-8000-000000000002', '71000000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000001', date_trunc('hour', now()) + interval '5 hours', date_trunc('hour', now()) + interval '6 hours', 'scheduled', now() - interval '1 day'),
  ('73000000-0000-4000-8000-000000000003', '71000000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000001', date_trunc('hour', now()) - interval '2 hours', date_trunc('hour', now()) - interval '1 hour', 'scheduled', now() - interval '2 days'),
  ('73000000-0000-4000-8000-000000000004', '71000000-0000-4000-8000-000000000002', '72000000-0000-4000-8000-000000000001', date_trunc('hour', now()) + interval '8 hours', date_trunc('hour', now()) + interval '9 hours', 'scheduled', now());

insert into public.support_threads (
  id, user_id, kind, status, subject, created_at, updated_at
) values
  ('74000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001', 'support', 'open', 'My support thread', now() - interval '1 hour', now() - interval '5 minutes'),
  ('74000000-0000-4000-8000-000000000002', '71000000-0000-4000-8000-000000000002', 'support', 'open', 'Other support thread', now() - interval '2 hours', now() - interval '2 hours');

insert into public.support_messages (
  id, thread_id, sender_user_id, sender_role, body, created_at
) values
  ('75000000-0000-4000-8000-000000000001', '74000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001', 'user', 'First message', now() - interval '10 minutes'),
  ('75000000-0000-4000-8000-000000000002', '74000000-0000-4000-8000-000000000001', null, 'admin', 'Latest reply', now() - interval '5 minutes'),
  ('75000000-0000-4000-8000-000000000003', '74000000-0000-4000-8000-000000000002', '71000000-0000-4000-8000-000000000002', 'user', 'Private other message', now() - interval '2 hours');

insert into public.identity_verification_attempts (
  id, user_id, claimed_student_id, card_storage_path, status, submitted_at
) values
  ('76000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001', 'S710000001', '71000000-0000-4000-8000-000000000001/old.jpg', 'rejected', now() - interval '2 days'),
  ('76000000-0000-4000-8000-000000000002', '71000000-0000-4000-8000-000000000001', 'S710000001', '71000000-0000-4000-8000-000000000001/latest.jpg', 'pending', now() - interval '1 day');

set local session_replication_role = origin;

-- 1. Session bootstrap is one authoritative payload scoped to auth.uid().
select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000001', true);
set local role authenticated;

do $$
declare
  v_context record;
begin
  select * into v_context from public.get_my_session_context();
  if v_context.user_id <> '71000000-0000-4000-8000-000000000001'
     or v_context.full_name <> 'Player One'
     or v_context.username <> 'one_player'
     or not v_context.can_use_sports then
    raise exception 'FAIL: session context is incorrect';
  end if;
end;
$$;

-- 2. My-bookings read is owner-scoped and lifecycle is derived by PostgreSQL.
do $$
declare
  v_count integer;
  v_completed integer;
begin
  select count(*), count(*) filter (where lifecycle_status = 'completed')
  into v_count, v_completed
  from public.list_my_bookings(100);

  if v_count <> 3 or v_completed <> 1 then
    raise exception 'FAIL: authoritative my-bookings read returned unexpected rows/lifecycle';
  end if;
end;
$$;

-- 3. Next booking is the earliest active/upcoming booking owned by the caller.
do $$
declare
  v_next record;
begin
  select * into v_next from public.get_next_booking();
  if v_next.booking_id <> '73000000-0000-4000-8000-000000000001' then
    raise exception 'FAIL: get_next_booking returned the wrong booking';
  end if;
end;
$$;

-- 4. Support summary returns one row per own thread and computes the latest message in DB.
do $$
declare
  v_summary record;
begin
  select * into v_summary from public.list_my_support_threads(30);
  if v_summary.thread_id <> '74000000-0000-4000-8000-000000000001'
     or v_summary.last_body <> 'Latest reply'
     or v_summary.last_sender_role <> 'admin' then
    raise exception 'FAIL: support thread summary is incorrect';
  end if;
end;
$$;

-- 5. Support detail returns only the caller-owned conversation.
do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.get_my_support_thread('74000000-0000-4000-8000-000000000001');
  if v_count <> 2 then
    raise exception 'FAIL: support thread detail did not return both own messages';
  end if;

  begin
    perform * from public.get_my_support_thread('74000000-0000-4000-8000-000000000002');
    raise exception 'FAIL: another user support thread was readable';
  exception
    when others then
      if sqlerrm not like '%support_thread_not_found%' then raise; end if;
  end;
end;
$$;

-- 6. Verification history read returns only the caller's latest attempt.
do $$
declare
  v_attempt record;
begin
  select * into v_attempt from public.get_my_latest_identity_verification();
  if v_attempt.attempt_id <> '76000000-0000-4000-8000-000000000002'
     or v_attempt.card_storage_path not like '%latest.jpg' then
    raise exception 'FAIL: latest identity verification read is incorrect';
  end if;
end;
$$;

-- 7. Student callers cannot use the admin directory read model.
do $$
begin
  begin
    perform * from public.admin_list_users(null, null, 50, 0);
    raise exception 'FAIL: student unexpectedly listed admin users';
  exception
    when others then
      if sqlerrm not like '%admin_required%' then raise; end if;
  end;
end;
$$;

reset role;

-- 8. Admin user directory filtering/pagination runs server-side and stays narrow.
select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000004', true);
set local role authenticated;

do $$
declare
  v_rows integer;
  v_total bigint;
begin
  select count(*), max(total_count)
  into v_rows, v_total
  from public.admin_list_users('player', 'approved', 50, 0);

  if v_rows <> 2 or v_total <> 2 then
    raise exception 'FAIL: admin user directory filter/count is incorrect';
  end if;
end;
$$;

reset role;
rollback;
\echo 'UNEEM V2 backend read/session contract tests passed.'
