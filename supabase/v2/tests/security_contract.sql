-- UNEEM V2 security contract tests.
--
-- Run against the final V2 schema through layer 024.
-- The suite rolls back all fixtures.
-- Synthetic Supabase Auth rows are created alongside profiles so approved,
-- pending, and admin authorization is tested against the final
-- confirmation-aware access contract.

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
    '41000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'security-approved@usmba.ac.ma', '', now(),
    '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '41000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'security-pending@usmba.ac.ma', '', now(),
    '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '41000000-0000-4000-8000-000000000003',
    'authenticated', 'authenticated', 'security-admin@usmba.ac.ma', '', now(),
    '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.profiles (id, student_id, full_name, role, status)
values
  ('41000000-0000-4000-8000-000000000001', 'S410000001', 'Approved Student', 'student', 'approved'),
  ('41000000-0000-4000-8000-000000000002', 'S410000002', 'Pending Student', 'student', 'pending'),
  ('41000000-0000-4000-8000-000000000003', 'S410000003', 'Approved Admin', 'admin', 'approved');

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
values (
  '42000000-0000-4000-8000-000000000001',
  'Security test pitch',
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
);

-- 1. Approved students can browse facilities.
select set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000001', true);
set local role authenticated;

do $$
begin
  if (select count(*) from public.pitches where id = '42000000-0000-4000-8000-000000000001') <> 1 then
    raise exception 'FAIL: approved student could not read an active facility';
  end if;
end;
$$;

reset role;

-- 2. Pending students cannot browse facilities through direct table reads.
select set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000002', true);
set local role authenticated;

do $$
begin
  if (select count(*) from public.pitches where id = '42000000-0000-4000-8000-000000000001') <> 0 then
    raise exception 'FAIL: pending student unexpectedly read facilities';
  end if;
end;
$$;

reset role;

-- 3. Pending students cannot bypass the table policy through availability RPC.
select set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000002', true);
set local role authenticated;

do $$
begin
  begin
    perform *
    from public.get_pitch_availability(
      '42000000-0000-4000-8000-000000000001',
      now()::date
    );
    raise exception 'FAIL: pending student unexpectedly queried shared availability';
  exception
    when others then
      if sqlerrm <> 'account_not_approved' then
        raise;
      end if;
  end;
end;
$$;

reset role;

-- 4. Self-service profile updates can change only the display name.
select set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select public.update_my_profile('  Updated Student Name  ');
reset role;

do $$
declare
  v_profile public.profiles%rowtype;
begin
  select * into v_profile
  from public.profiles
  where id = '41000000-0000-4000-8000-000000000001';

  if v_profile.full_name <> 'Updated Student Name' then
    raise exception 'FAIL: safe profile RPC did not update full_name';
  end if;

  if v_profile.student_id <> 'S410000001'
     or v_profile.role <> 'student'
     or v_profile.status <> 'approved' then
    raise exception 'FAIL: safe profile RPC modified protected identity fields';
  end if;
end;
$$;

-- 5. A student cannot directly promote their own role/status through table UPDATE.
select set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000001', true);
set local role authenticated;

update public.profiles
set role = 'admin', status = 'approved'
where id = '41000000-0000-4000-8000-000000000001';

reset role;

do $$
begin
  if exists (
    select 1
    from public.profiles
    where id = '41000000-0000-4000-8000-000000000001'
      and role = 'admin'
  ) then
    raise exception 'FAIL: student escalated role through direct profile UPDATE';
  end if;
end;
$$;

-- 6. Invalid self-service names are rejected without changing the profile.
select set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000001', true);
set local role authenticated;

do $$
begin
  begin
    perform public.update_my_profile(' ');
    raise exception 'FAIL: blank profile name unexpectedly succeeded';
  exception
    when others then
      if sqlerrm <> 'invalid_full_name' then
        raise;
      end if;
  end;
end;
$$;

reset role;

-- 7. Approved admins retain facility visibility through the same access rule.
select set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000003', true);
set local role authenticated;

do $$
begin
  if (select count(*) from public.pitches where id = '42000000-0000-4000-8000-000000000001') <> 1 then
    raise exception 'FAIL: approved admin could not read facilities';
  end if;
end;
$$;

reset role;

rollback;

\echo 'UNEEM V2 security contract tests passed.'
