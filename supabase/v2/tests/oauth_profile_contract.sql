-- Run after layer 062. Every fixture is rolled back.
begin;
create function pg_temp.oauth_assert(ok boolean, message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',message; end if; end;
$$;
insert into auth.users(id,instance_id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
('82000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','oauth-v21-google@usmba.ac.ma',now(),'{"provider":"google"}','{"name":"OAuth Student","role":"admin","identity_status":"verified","student_id":"S82001"}',now(),now()),
('82000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','oauth-v21-facebook@example.com',now(),'{"provider":"facebook"}','{}',now(),now());
select pg_temp.oauth_assert((select count(*)=2 from public.profiles where id in ('82000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000002') and role='student' and status='pending' and identity_status='required' and student_id is null and username ~ '^student_[a-f0-9]{16}$'),'OAuth creates only unverified profiles and ignores claimed authority');
select pg_temp.oauth_assert((select full_name='Student' from public.profiles where id='82000000-0000-4000-8000-000000000002'),'missing provider display name has an editable fallback');
select set_config('request.jwt.claim.sub','82000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select pg_temp.oauth_assert(private.has_browse_access(),'confirmed OAuth account may browse');
select pg_temp.oauth_assert(not private.has_app_access(),'academic Google email does not grant sports');
select pg_temp.oauth_assert((select not can_use_sports and identity_status='required' from public.get_my_account_state()),'account state requires verification');
select public.update_my_profile('Updated OAuth Name','oauth_v21_updated');
select pg_temp.oauth_assert((select identity_status='required' and student_id is null from public.profiles where id=auth.uid()),'profile edits cannot grant identity');
reset role;
do $$
declare caught boolean := false;
begin
  begin
    insert into auth.users(id,instance_id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
    values('82000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','oauth-v21-spoof@example.com','{"provider":"email"}','{"provider":"google","name":"Spoof Student"}',now(),now());
  exception when others then
    if position('invalid_full_name' in sqlerrm)=0 then raise; end if;
    caught := true;
  end;
  if not caught then raise exception 'Client provider metadata bypassed email signup validation'; end if;
end;
$$;
rollback;
