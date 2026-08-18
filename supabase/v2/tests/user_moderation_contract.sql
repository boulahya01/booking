-- UNEEM V2 user-access moderation contract tests.
-- Run against the final V2 schema through layer 024. All fixtures roll back.
-- Synthetic confirmed Supabase Auth rows are paired with profile fixtures so
-- layer-021 confirmation-aware admin/account-state authorization is exercised.
-- Audit-table assertions run only from the privileged transactional harness.

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
    'authenticated', 'authenticated', 'moderation-admin@usmba.ac.ma', '', now(),
    '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '81000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'moderation-approved@usmba.ac.ma', '', now(),
    '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '81000000-0000-4000-8000-000000000003',
    'authenticated', 'authenticated', 'moderation-verified@example.com', '', now(),
    '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '81000000-0000-4000-8000-000000000004',
    'authenticated', 'authenticated', 'moderation-pending@example.com', '', now(),
    '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '81000000-0000-4000-8000-000000000005',
    'authenticated', 'authenticated', 'moderation-other-admin@usmba.ac.ma', '', now(),
    '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '81000000-0000-4000-8000-000000000006',
    'authenticated', 'authenticated', 'moderation-unverified@example.com', '', now(),
    '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '81000000-0000-4000-8000-000000000007',
    'authenticated', 'authenticated', 'moderation-remediation@usmba.ac.ma', '', now(),
    '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.profiles (
  id, student_id, full_name, username, role, status, email_kind, identity_status,
  restriction_reason, access_restriction_reason
) values
  ('81000000-0000-4000-8000-000000000001', 'S810000001', 'Moderation Admin', 'moderation_admin', 'admin', 'approved', 'academic', 'verified', null, null),
  ('81000000-0000-4000-8000-000000000002', 'S810000002', 'Approved Student', 'approved_student', 'student', 'approved', 'academic', 'required', null, null),
  ('81000000-0000-4000-8000-000000000003', 'S810000003', 'Verified Suspended', 'verified_suspended', 'student', 'suspended', 'personal', 'verified', null, 'conduct'),
  ('81000000-0000-4000-8000-000000000004', 'S810000004', 'Pending Student', 'pending_student', 'student', 'pending', 'personal', 'pending', null, null),
  ('81000000-0000-4000-8000-000000000005', 'S810000005', 'Other Admin', 'other_admin', 'admin', 'approved', 'academic', 'verified', null, null),
  ('81000000-0000-4000-8000-000000000006', 'S810000006', 'Unverified Suspended', 'unverified_suspended', 'student', 'suspended', 'personal', 'pending', null, 'safety'),
  ('81000000-0000-4000-8000-000000000007', 'S810000007', 'Academic Remediation', 'academic_remediation', 'student', 'approved', 'academic', 'rejected', 'student_card_unreadable', null);

set local session_replication_role = origin;

-- 1. Even an admin browser session cannot directly update profiles anymore.
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000001', true);
set local role authenticated;
do $$
begin
  begin
    update public.profiles
    set status = 'suspended'
    where id = '81000000-0000-4000-8000-000000000002';
    raise exception 'FAIL: direct profile update unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;
reset role;

-- 2. A normal student cannot call the admin moderation RPC.
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000002', true);
set local role authenticated;
do $$
begin
  begin
    perform * from public.admin_set_user_access(
      '81000000-0000-4000-8000-000000000003', 'approved', 'review_complete'
    );
    raise exception 'FAIL: student moderation unexpectedly succeeded';
  exception
    when others then
      if sqlerrm not like '%admin_required%' then raise; end if;
  end;
end;
$$;
reset role;

-- 3. Admin suspension uses a structured reason. Browser code sees only the RPC
-- result; the privileged harness verifies the internal audit row afterwards.
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000001', true);
set local role authenticated;
do $$
declare
  v_result record;
begin
  select * into v_result
  from public.admin_set_user_access(
    '81000000-0000-4000-8000-000000000002', 'suspended', 'booking_abuse'
  );

  if v_result.access_status <> 'suspended' or v_result.restriction_reason <> 'booking_abuse' then
    raise exception 'FAIL: suspension result is incorrect';
  end if;
end;
$$;
reset role;

do $$
begin
  if not exists (
    select 1
    from public.admin_audit_log
    where actor_id = '81000000-0000-4000-8000-000000000001'
      and target_id = '81000000-0000-4000-8000-000000000002'
      and action = 'user_suspended'
      and reason_code = 'booking_abuse'
  ) then
    raise exception 'FAIL: suspension audit entry missing';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000001', true);
set local role authenticated;

-- 4. Routine moderation cannot turn a pending identity into an approved account.
do $$
begin
  begin
    perform * from public.admin_set_user_access(
      '81000000-0000-4000-8000-000000000004', 'approved', 'review_complete'
    );
    raise exception 'FAIL: pending student was approved through moderation';
  exception
    when others then
      if sqlerrm not like '%user_not_restorable%' then raise; end if;
  end;
end;
$$;

-- 5. Routine moderation cannot change another admin identity.
do $$
begin
  begin
    perform * from public.admin_set_user_access(
      '81000000-0000-4000-8000-000000000005', 'suspended', 'other'
    );
    raise exception 'FAIL: admin identity was moderated through student RPC';
  exception
    when others then
      if sqlerrm not like '%admin_user_target_not_student%' then raise; end if;
  end;
end;
$$;

-- 6. A verified personal-email account can be restored.
do $$
declare
  v_result record;
begin
  select * into v_result
  from public.admin_set_user_access(
    '81000000-0000-4000-8000-000000000003', 'approved', 'appeal_approved'
  );

  if v_result.access_status <> 'approved' or v_result.restriction_reason is not null then
    raise exception 'FAIL: verified personal account was not restored cleanly';
  end if;
end;
$$;
reset role;

-- Internal audit persistence is verified only by the privileged harness.
do $$
begin
  if not exists (
    select 1
    from public.admin_audit_log
    where target_id = '81000000-0000-4000-8000-000000000003'
      and action = 'user_access_restored'
      and reason_code = 'appeal_approved'
  ) then
    raise exception 'FAIL: restore audit entry missing';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000001', true);
set local role authenticated;

-- 7. A personal-email account cannot regain sports access before identity proof.
do $$
begin
  begin
    perform * from public.admin_set_user_access(
      '81000000-0000-4000-8000-000000000006', 'approved', 'review_complete'
    );
    raise exception 'FAIL: unverified personal account was restored';
  exception
    when others then
      if sqlerrm not like '%identity_verification_required%' then raise; end if;
  end;
end;
$$;

-- 8. Access moderation never destroys a separate identity-remediation reason.
do $$
declare
  v_state record;
begin
  perform * from public.admin_set_user_access(
    '81000000-0000-4000-8000-000000000007', 'suspended', 'safety'
  );

  perform set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000007', true);
  select * into v_state from public.get_my_account_state();
  if v_state.restriction_reason <> 'safety' or v_state.access_status <> 'suspended' then
    raise exception 'FAIL: suspended account did not expose access restriction reason';
  end if;

  perform set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000001', true);
  perform * from public.admin_set_user_access(
    '81000000-0000-4000-8000-000000000007', 'approved', 'review_complete'
  );

  perform set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000007', true);
  select * into v_state from public.get_my_account_state();
  if v_state.restriction_reason <> 'student_card_unreadable'
     or v_state.identity_status <> 'rejected'
     or v_state.access_status <> 'approved' then
    raise exception 'FAIL: identity remediation reason was lost across moderation';
  end if;
end;
$$;

reset role;
rollback;
\echo 'UNEEM V2 final-schema user moderation contract tests passed.'
