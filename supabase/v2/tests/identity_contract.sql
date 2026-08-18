-- UNEEM V2 identity verification contract tests.
-- Run against the final V2 schema through layer 024. All fixtures roll back.
-- Synthetic confirmed Supabase Auth rows are paired with profile fixtures so
-- confirmation-aware student/admin authorization is exercised explicitly.

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
    '51000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'identity-academic@usmba.ac.ma', '', now(),
    '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '51000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'identity-personal@example.com', '', now(),
    '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '51000000-0000-4000-8000-000000000003',
    'authenticated', 'authenticated', 'identity-verified@example.com', '', now(),
    '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '51000000-0000-4000-8000-000000000004',
    'authenticated', 'authenticated', 'identity-admin@usmba.ac.ma', '', now(),
    '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.profiles (
  id, student_id, full_name, username, role, status, email_kind, identity_status
) values
  ('51000000-0000-4000-8000-000000000001', null, 'Academic Student', 'academic_player', 'student', 'approved', 'academic', 'required'),
  ('51000000-0000-4000-8000-000000000002', 'S510000002', 'Personal Student', 'personal_player', 'student', 'pending', 'personal', 'required'),
  ('51000000-0000-4000-8000-000000000003', 'S510000003', 'Verified Student', 'verified_player', 'student', 'approved', 'personal', 'verified'),
  ('51000000-0000-4000-8000-000000000004', null, 'Review Admin', 'review_admin', 'admin', 'approved', 'academic', 'verified');

set local session_replication_role = origin;

-- 1. Academic access and identity verification are deliberately independent.
select set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000001', true);
set local role authenticated;

do $$
declare
  v_state record;
begin
  select * into v_state from public.get_my_account_state();
  if not v_state.can_use_sports or not v_state.needs_identity_action then
    raise exception 'FAIL: academic fast-path state is incorrect';
  end if;
end;
$$;
reset role;

-- 2. Personal-email pending users remain blocked from sports access.
select set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000002', true);
set local role authenticated;

do $$
declare
  v_state record;
begin
  select * into v_state from public.get_my_account_state();
  if v_state.can_use_sports then
    raise exception 'FAIL: personal pending user unexpectedly has sports access';
  end if;
end;
$$;
reset role;

-- 3. Two unverified accounts may claim the same ID without reserving it.
-- Ownership is decided only when an admin approves a verification attempt.
update public.profiles
set student_id = 'S519999999', identity_status = 'pending'
where id in (
  '51000000-0000-4000-8000-000000000001',
  '51000000-0000-4000-8000-000000000002'
);

-- 4. A verified ID remains globally unique.
do $$
begin
  begin
    update public.profiles
    set student_id = 'S510000003', identity_status = 'verified'
    where id = '51000000-0000-4000-8000-000000000001';
    raise exception 'FAIL: duplicate verified Student ID unexpectedly succeeded';
  exception
    when unique_violation then null;
  end;
end;
$$;

-- Restore first user to an unverified state for review-flow tests.
update public.profiles
set student_id = 'S519999999', identity_status = 'pending', verified_student_id_at = null
where id = '51000000-0000-4000-8000-000000000001';

insert into public.identity_verification_attempts (
  id, user_id, claimed_student_id, card_storage_path, status
) values (
  '52000000-0000-4000-8000-000000000001',
  '51000000-0000-4000-8000-000000000001',
  'S519999999',
  '51000000-0000-4000-8000-000000000001/card.jpg',
  'pending'
);

-- 5. A structured rejection keeps the same account and exposes a remediation reason.
select set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000004', true);
set local role authenticated;
select public.review_identity_verification(
  '52000000-0000-4000-8000-000000000001',
  'rejected',
  'student_card_unreadable'
);
reset role;

do $$
begin
  if not exists (
    select 1 from public.profiles
    where id = '51000000-0000-4000-8000-000000000001'
      and identity_status = 'rejected'
      and restriction_reason = 'student_card_unreadable'
      and status = 'approved'
  ) then
    raise exception 'FAIL: rejection did not preserve academic access/remediation state';
  end if;
end;
$$;

-- 6. Resubmission creates a new attempt on the same account, then approval verifies identity.
insert into public.identity_verification_attempts (
  id, user_id, claimed_student_id, card_storage_path, status
) values (
  '52000000-0000-4000-8000-000000000002',
  '51000000-0000-4000-8000-000000000001',
  'S519999999',
  '51000000-0000-4000-8000-000000000001/card-retry.jpg',
  'pending'
);

update public.profiles
set identity_status = 'pending', restriction_reason = null
where id = '51000000-0000-4000-8000-000000000001';

select set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000004', true);
set local role authenticated;
select public.review_identity_verification(
  '52000000-0000-4000-8000-000000000002',
  'approved',
  null
);
reset role;

do $$
begin
  if not exists (
    select 1 from public.profiles
    where id = '51000000-0000-4000-8000-000000000001'
      and identity_status = 'verified'
      and student_id = 'S519999999'
      and restriction_reason is null
  ) then
    raise exception 'FAIL: remediation approval did not verify identity';
  end if;
end;
$$;

-- 7. Public usernames are case-insensitively unique and remain separate from Student ID.
do $$
begin
  begin
    update public.profiles
    set username = 'VERIFIED_PLAYER'
    where id = '51000000-0000-4000-8000-000000000002';
    raise exception 'FAIL: duplicate username unexpectedly succeeded';
  exception
    when unique_violation then null;
  end;
end;
$$;

-- 8. Invalid usernames cannot be persisted even when direct table access is simulated in this contract fixture.
do $$
begin
  begin
    update public.profiles
    set username = 'bad handle!'
    where id = '51000000-0000-4000-8000-000000000002';
    raise exception 'FAIL: invalid username unexpectedly succeeded';
  exception
    when check_violation then null;
  end;
end;
$$;

rollback;
\echo 'UNEEM V2 identity contract tests passed.'
