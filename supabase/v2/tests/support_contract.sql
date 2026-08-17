-- UNEEM V2 support/report security contract tests.
-- Run after schema layers 001-012. All fixtures roll back.

\set ON_ERROR_STOP on

begin;
set local session_replication_role = replica;

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

-- 5. Guest support remains available without a contact email. Capability-token access
-- is still returned and every anonymous creation is covered by the global burst ceiling.
set local role anon;

do $$
declare
  v_row record;
begin
  select * into v_row from public.create_guest_support_thread('', 'Need help', 'Guest message');
  if v_row.thread_id is null or v_row.access_token is null then
    raise exception 'FAIL: no-email guest support did not return capability access';
  end if;
end;
$$;
reset role;

-- 6. When a contact email is provided, two recent threads for the same normalized
-- address are allowed; a third inside 30 minutes is throttled.
set local role anon;
select * from public.create_guest_support_thread('Guest@Test.Example', 'First', 'First guest request');
select * from public.create_guest_support_thread('guest@test.example', 'Second', 'Second guest request');

do $$
begin
  begin
    perform * from public.create_guest_support_thread('guest@test.example', 'Third', 'Third guest request');
    raise exception 'FAIL: guest contact throttle did not fire';
  exception
    when others then
      if sqlerrm not like '%support_rate_limited%' then raise; end if;
  end;
end;
$$;
reset role;

rollback;
\echo 'UNEEM V2 support/report contract tests passed.'