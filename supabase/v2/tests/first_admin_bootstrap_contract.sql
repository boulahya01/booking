-- UNEEM V2 first-admin bootstrap contract tests.
-- Run after schema layers through 020_first_admin_bootstrap.sql.
-- All fixtures roll back.

\set ON_ERROR_STOP on

begin;
set local session_replication_role = replica;

insert into public.profiles (
  id, student_id, full_name, username, role, status, email_kind, identity_status,
  access_restriction_reason
) values
  ('91000000-0000-4000-8000-000000000001', null, 'Chosen Owner', 'chosen_owner', 'student', 'pending', 'academic', 'required', null),
  ('91000000-0000-4000-8000-000000000002', null, 'Second Candidate', 'second_candidate', 'student', 'approved', 'academic', 'required', null);

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

-- 2. Database owner can promote exactly one selected existing profile.
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

-- 3. A second owner-level bootstrap is rejected once an admin exists.
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

-- 4. Bootstrap never creates a public/application execute grant.
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
\echo 'UNEEM V2 first-admin bootstrap contract tests passed.'
