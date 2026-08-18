-- UNEEM V2 support/report security contract tests.
-- Run against the final hosted V2 schema through layer 024. All fixtures roll back.
-- Synthetic confirmed Auth rows are created for authenticated support/report actors,
-- and guest thread creation is exercised only through the trusted service-role gate
-- introduced by layer 023.

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
    '61000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'reporter@usmba.ac.ma', '', now(),
    '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '61000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'reported@usmba.ac.ma', '', now(),
    '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '61000000-0000-4000-8000-000000000003',
    'authenticated', 'authenticated', 'support-other@usmba.ac.ma', '', now(),
    '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.profiles (
  id, student_id, full_name, role, status, email_kind, identity_status
) values
  ('61000000-0000-4000-8000-000000000001', 'S610000001', 'Reporter Student', 'student', 'approved', 'academic', 'verified'),
  ('61000000-0000-4000-8000-000000000002', 'S610000002', 'Reported Student', 'student', 'approved', 'academic', 'verified'),
  ('61000000-0000-4000-8000-000000000003', 'S610000003', 'Other Student', 'student', 'approved', 'academic', 'verified');

set local session_replication_role = origin;

-- 1. Authenticated reports require structured target + reason context.
select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000001', true);
set local role authenticated;

do $$
declare
  v_thread uuid;
begin
  v_thread := public.create_my_report_thread(
    'user',
    '61000000-0000-4000-8000-000000000002',
    'harassment',
    'Repeated unwanted messages during match coordination.'
  );

  if not exists (
    select 1 from public.support_threads
    where id = v_thread
      and user_id = '61000000-0000-4000-8000-000000000001'
      and kind = 'report'
      and target_type = 'user'
      and target_id = '61000000-0000-4000-8000-000000000002'
      and reason_code = 'harassment'
  ) then
    raise exception 'FAIL: structured report context was not persisted';
  end if;
end;
$$;
reset role;

-- 2. A student cannot report themselves through the structured report RPC.
select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000001', true);
set local role authenticated;

do $$
begin
  begin
    perform public.create_my_report_thread(
      'user',
      '61000000-0000-4000-8000-000000000001',
      'other',
      'Self-target should fail.'
    );
    raise exception 'FAIL: self-report unexpectedly succeeded';
  exception
    when others then
      if sqlerrm not like '%invalid_report_target%' then raise; end if;
  end;
end;
$$;
reset role;

-- 3. Generic support RPC cannot be abused to create an unstructured report.
select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000003', true);
set local role authenticated;

do $$
begin
  begin
    perform public.create_my_support_thread('report', 'No context', 'This should fail.');
    raise exception 'FAIL: unstructured report unexpectedly succeeded';
  exception
    when others then
      if sqlerrm not like '%invalid_support_kind%' then raise; end if;
  end;
end;
$$;
reset role;

-- 4. New thread creation is throttled after three recent threads, but that throttle
-- must not prevent a normal reply to an existing thread.
set local session_replication_role = replica;
insert into public.support_threads (id, user_id, kind, subject, created_at)
values
  ('62000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000003', 'support', 'one', now()),
  ('62000000-0000-4000-8000-000000000002', '61000000-0000-4000-8000-000000000003', 'support', 'two', now()),
  ('62000000-0000-4000-8000-000000000003', '61000000-0000-4000-8000-000000000003', 'support', 'three', now());
set local session_replication_role = origin;

select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000003', true);
set local role authenticated;

do $$
begin
  begin
    perform public.create_my_support_thread('support', 'four', 'This should be throttled.');
    raise exception 'FAIL: authenticated thread throttle did not fire';
  exception
    when others then
      if sqlerrm not like '%support_rate_limited%' then raise; end if;
  end;

  perform public.add_my_support_message(
    '62000000-0000-4000-8000-000000000001',
    'A legitimate reply must remain possible.'
  );

  if not exists (
    select 1 from public.support_messages
    where thread_id = '62000000-0000-4000-8000-000000000001'
      and sender_role = 'user'
      and body = 'A legitimate reply must remain possible.'
  ) then
    raise exception 'FAIL: reply was not persisted while thread creation was throttled';
  end if;
end;
$$;
reset role;

delete from public.support_threads where user_id = '61000000-0000-4000-8000-000000000003';

-- 5. Layer 023 closes legacy anonymous thread creation completely. Guest creation
-- must cross the trusted server boundary instead of calling the old RPC directly.
set local role anon;

do $$
begin
  begin
    perform * from public.create_guest_support_thread('', 'Legacy path', 'Must be denied');
    raise exception 'FAIL: anon unexpectedly retained legacy guest thread creation';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;
reset role;

-- 6. Guest support remains available without a contact email through the trusted
-- service-role RPC and returns capability access. The network identity is already
-- HMAC-hashed by the application server; PostgreSQL never receives a raw IP.
set local role service_role;

do $$
declare
  v_row record;
begin
  select * into v_row
  from public.create_guest_support_thread_server(
    '',
    'Need help',
    'Guest message',
    repeat('a', 64)
  );

  if v_row.thread_id is null or v_row.access_token is null then
    raise exception 'FAIL: trusted no-email guest support did not return capability access';
  end if;
end;
$$;
reset role;

-- 7. When a contact email is provided, two recent threads for the same normalized
-- address are allowed; a third inside 30 minutes is throttled. Reusing one valid
-- network hash also confirms the contact throttle remains defense-in-depth beside
-- the layer-023 per-network gate.
set local role service_role;
select * from public.create_guest_support_thread_server(
  'Guest@Test.Example', 'First', 'First guest request', repeat('b', 64)
);
select * from public.create_guest_support_thread_server(
  'guest@test.example', 'Second', 'Second guest request', repeat('b', 64)
);

do $$
begin
  begin
    perform * from public.create_guest_support_thread_server(
      'guest@test.example', 'Third', 'Third guest request', repeat('b', 64)
    );
    raise exception 'FAIL: guest contact throttle did not fire';
  exception
    when others then
      if sqlerrm not like '%support_rate_limited%' then raise; end if;
  end;
end;
$$;
reset role;

-- 8. Browser roles cannot invoke the trusted server-only creation RPC.
set local role authenticated;

do $$
begin
  begin
    perform * from public.create_guest_support_thread_server(
      '', 'Wrong role', 'Must be denied', repeat('c', 64)
    );
    raise exception 'FAIL: authenticated user unexpectedly executed server-only guest creation';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;
reset role;

rollback;
\echo 'UNEEM V2 final-schema support/report contract tests passed.'
