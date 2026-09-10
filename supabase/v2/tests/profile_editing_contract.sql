-- Run after layer 061; all account fixtures are transactional.
begin;
create function pg_temp.profile_assert(ok boolean, message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %', message; end if; end;
$$;
create function pg_temp.profile_expect_error(statement text, expected text) returns void language plpgsql as $$
declare caught boolean := false;
begin
  begin execute statement;
  exception when others then
    if position(expected in sqlerrm) = 0 then raise exception 'Expected %, got %', expected, sqlerrm; end if;
    caught := true;
  end;
  if not caught then raise exception 'Expected error: %', expected; end if;
end;
$$;
insert into auth.users(id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
('71000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','profile-v21-one@example.com',now(),'{"provider":"email"}','{"full_name":"Profile One","username":"v21_profile_one","student_id":"S710000001"}',now(),now()),
('71000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','profile-v21-two@example.com',now(),'{"provider":"email"}','{"full_name":"Profile Two","username":"v21_profile_two","student_id":"S710000002"}',now(),now());
update public.profiles set identity_status='verified',status='approved',verified_student_id_at=now() where id='71000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub','71000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select pg_temp.profile_assert((public.update_my_profile('  Updated Name  ','V21_UPDATED_NAME')).username='v21_updated_name','username is normalized');
select pg_temp.profile_assert((select full_name='Updated Name' and student_id='S710000001' and role='student' and identity_status='verified' and status='approved' from public.profiles where id=auth.uid()),'profile changes preserve verified identity and access');
select pg_temp.profile_expect_error($q$select public.update_my_profile('X','v21_updated_name')$q$,'invalid_full_name');
select pg_temp.profile_expect_error($q$select public.update_my_profile('Valid Name','x!')$q$,'invalid_username');
select pg_temp.profile_expect_error($q$select public.update_my_profile('Valid Name','v21_profile_two')$q$,'username_taken');
select pg_temp.profile_expect_error($q$select public.update_my_student_id('S999')$q$,'identity_already_verified');
select pg_temp.profile_expect_error($q$update public.profiles set role='admin' where id=auth.uid()$q$,'permission denied');
reset role;
select pg_temp.profile_assert((select full_name='Profile Two' and username='v21_profile_two' and identity_status='required' from public.profiles where id='71000000-0000-4000-8000-000000000002'),'other profile remains unchanged');
select set_config('request.jwt.claim.sub','71000000-0000-4000-8000-000000000002',true);
set local role authenticated;
select pg_temp.profile_assert((public.update_my_profile('Pending Name','v21_pending_name')).identity_status='required','pending users may edit their public profile');
select public.update_my_student_id('s710000003');
select pg_temp.profile_assert((select student_id='S710000003' and identity_status='required' and not can_use_sports from public.get_my_account_state()),'pending ID edit cannot approve access');
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role authenticated;
select pg_temp.profile_expect_error($q$select public.update_my_profile('Valid Name','v21_valid_name')$q$,'authentication_required');
reset role;
set local role anon;
select pg_temp.profile_expect_error($q$select public.update_my_profile('Valid Name','v21_valid_name')$q$,'permission denied');
reset role;
rollback;
