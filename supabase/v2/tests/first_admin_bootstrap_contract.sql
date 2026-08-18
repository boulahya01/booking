-- UNEEM V2 first-admin bootstrap contract tests.
-- Run against the final V2 schema through layer 024. All fixtures roll back.
-- Bootstrap is database-owner-only; synthetic Auth rows exercise the layer-021
-- confirmation requirement and the personal-email identity prerequisite.

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
    '91000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'bootstrap-owner@usmba.ac.ma', '', now(),
    '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '91000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'bootstrap-second@usmba.ac.ma', '', now(),
    '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '91000000-0000-4000-8000-000000000003',
    'authenticated', 'authenticated', 'bootstrap-unconfirmed@usmba.ac.ma', '', null,
    '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '91000000-0000-4000-8000-000000000004',
    'authenticated', 'authenticated', 'bootstrap-personal@example.com', '', now(),
    '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.profiles (
  id, student_id, full_name, username, role, status, email_kind, identity_status,
  access_restriction_reason
) values
  ('91000000-0000-4000-8000-000000000001', null, 'Chosen Owner', 'chosen_owner', 'student', 'pending', 'academic', 'required', null),
  ('91000000-0000-4000-8000-000000000002', null, 'Second Candidate', 'second_candidate', 'student', 'approved', 'academic', 'required', null),
  ('91000000-0000-4000-8000-000000000003', null, 'Unconfirmed Candidate', 'unconfirmed_candidate', 'student', 'pending', 'academic', 'required', null),
  ('91000000-0000-4000-8000-000000000004', 'S910000004', 'Personal Candidate', 'personal_candidate', 'student', 'pending', 'personal', 'pending', null);

set local session_replication_role = origin;

-- 1. Application-authenticated sessions cannot execute the bootstrap function.
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000001', true);
set local role authenticated;
do $$
begin
  begin
    perform private.bootstrap_first_admin('91000000-0000-4000-8000-000000000001');
    raise exception 'FAIL: authenticated client executed first-admin bootstrap';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;
reset role;

-- 2. Even the database owner cannot bootstrap an unconfirmed academic account.
do $$
begin
  begin
    perform private.bootstrap_first_admin('91000000-0000-4000-8000-000000000003');
    raise exception 'FAIL: unconfirmed account became first admin';
  exception
    when others then
      if sqlerrm not like '%email_confirmation_required%' then raise; end if;
  end;
end;
$$;

-- 3. A confirmed personal-email candidate still requires verified Student ID ownership.
do $$
begin
  begin
    perform private.bootstrap_first_admin('91000000-0000-4000-8000-000000000004');
    raise exception 'FAIL: unverified personal account became first admin';
  exception
    when others then
      if sqlerrm not like '%bootstrap_identity_not_verified%' then raise; end if;
  end;
end;
$$;

-- 4. Database owner can promote exactly one confirmed academic profile.
do $$
declare
  v_result public.profiles;
begin
  v_result := private.bootstrap_first_admin('91000000-0000-4000-8000-000000000001');

  if v_result.role <> 'admin' or v_result.status <> 'approved' then
    raise exception 'FAIL: first admin was not promoted to approved admin';
  end if;

  if not exists (
    select 1
    from private.admin_bootstrap_log
    where target_profile_id = '91000000-0000-4000-8000-000000000001'
      and new_state ->> 'role' = 'admin'
      and new_state ->> 'status' = 'approved'
  ) then
    raise exception 'FAIL: first-admin bootstrap log missing';
  end if;
end;
$$;

-- 5. A second owner-level bootstrap is rejected once an admin exists.
do $$
begin
  begin
    perform private.bootstrap_first_admin('91000000-0000-4000-8000-000000000002');
    raise exception 'FAIL: second first-admin bootstrap unexpectedly succeeded';
  exception
    when others then
      if sqlerrm not like '%first_admin_already_exists%' then raise; end if;
  end;
end;
$$;

-- 6. Bootstrap never exposes execute permission to application/service roles.
do $$
declare
  v_has_execute boolean;
begin
  select has_function_privilege('authenticated', 'private.bootstrap_first_admin(uuid)', 'EXECUTE')
  into v_has_execute;
  if v_has_execute then
    raise exception 'FAIL: authenticated retains bootstrap execute privilege';
  end if;

  select has_function_privilege('service_role', 'private.bootstrap_first_admin(uuid)', 'EXECUTE')
  into v_has_execute;
  if v_has_execute then
    raise exception 'FAIL: service_role retains bootstrap execute privilege';
  end if;
end;
$$;

rollback;
\echo 'UNEEM V2 final-schema first-admin bootstrap contract tests passed.'
