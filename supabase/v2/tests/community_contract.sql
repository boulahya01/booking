-- Fictional fixtures only. Run on the isolated PostgreSQL harness, never production.
\set ON_ERROR_STOP on
begin;
set local session_replication_role=replica;
insert into auth.users(id,email,email_confirmed_at) values
('41000000-0000-4000-8000-000000000001','host@example.com',now()),
('41000000-0000-4000-8000-000000000002','player@example.com',now()),
('41000000-0000-4000-8000-000000000003','other@example.com',now()),
('41000000-0000-4000-8000-000000000004','pending@example.com',now()),
('41000000-0000-4000-8000-000000000005','admin@example.com',now());
insert into public.profiles(id,full_name,username,role,status,email_kind,identity_status) values
('41000000-0000-4000-8000-000000000001','Test Host','test_host','student','approved','personal','verified'),
('41000000-0000-4000-8000-000000000002','Test Player','test_player','student','approved','personal','verified'),
('41000000-0000-4000-8000-000000000003','Other Player','other_player','student','approved','personal','verified'),
('41000000-0000-4000-8000-000000000004','Pending Player','pending_player','student','pending','personal','pending'),
('41000000-0000-4000-8000-000000000005','Test Admin','test_admin','admin','approved','personal','verified');
update public.profiles set student_id='S8800000'||right(id::text,1),verified_student_id_at=now()
  where id::text like '41000000-%' and identity_status='verified';
set local session_replication_role=origin;
insert into public.pitches(id,name,location,sport_type,capacity,open_time,close_time,timezone)
values('42000000-0000-4000-8000-000000000001','Test facility','Sports centre','football',10,'00:00','23:59','UTC');
insert into public.bookings(id,user_id,pitch_id,starts_at,ends_at) values
('43000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000001','42000000-0000-4000-8000-000000000001',date_trunc('hour',now())+interval '4 hours',date_trunc('hour',now())+interval '5 hours');
select set_config('request.jwt.claim.sub','41000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select public.create_open_match('43000000-0000-4000-8000-000000000001',0);
do $$ begin
  if public.list_community_players()<>'[]'::jsonb then raise exception 'Discovery must be opt-in'; end if;
  perform public.update_community_profile('Ready to play',array['football'],true,true);
  if jsonb_array_length(public.list_community_players())<>1 then raise exception 'Opted-in player missing'; end if;
  if public.get_player_profile('test_host') ?| array['email','student_id','identity_status','role'] then raise exception 'Private identity leaked'; end if;
  if (public.get_player_profile('test_host')->>'available_until')::timestamptz > now()+interval '4 hours 1 second' then raise exception 'Availability must expire'; end if;
  begin perform count(*) from public.community_messages; raise exception 'Direct reads allowed'; exception when insufficient_privilege then null; end;
  begin perform public.hide_community_message(1); raise exception 'Student moderated messages'; exception when raise_exception then if sqlerrm<>'admin_required' then raise; end if; end;
end $$;
select public.send_community_message('Who wants to play?','44000000-0000-4000-8000-000000000001',null,'43000000-0000-4000-8000-000000000001');
select public.send_community_message('Who wants to play?','44000000-0000-4000-8000-000000000001',null,'43000000-0000-4000-8000-000000000001');
do $$ begin
  if jsonb_array_length(public.list_community_messages())<>1 then raise exception 'Retry duplicated a message'; end if;
  if public.list_community_messages()->0->'shared_match'->>'spots_left'<>'9' then raise exception 'Shared capacity incorrect'; end if;
  begin perform public.send_community_message('Changed','44000000-0000-4000-8000-000000000001'); raise exception 'Nonce reused with a different message'; exception when raise_exception then if sqlerrm<>'community_retry_mismatch' then raise; end if; end;
end $$;
reset role;
select set_config('uneem.test.match_id',(select id::text from public.matches where booking_id='43000000-0000-4000-8000-000000000001'),true);
select set_config('request.jwt.claim.sub','41000000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$ begin
  begin perform public.get_community_room('43000000-0000-4000-8000-000000000001'); raise exception 'Outsider accessed match chat'; exception when raise_exception then if sqlerrm<>'community_access_required' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','41000000-0000-4000-8000-000000000002',true);
select public.join_open_match(current_setting('uneem.test.match_id')::uuid);
select public.set_community_block('41000000-0000-4000-8000-000000000001',true);
do $$ begin
  if not exists(select 1 from public.get_booking_details('43000000-0000-4000-8000-000000000001') where participant_by_me)
    then raise exception 'Blocking changed match participation'; end if;
end $$;
select public.set_community_block('41000000-0000-4000-8000-000000000001',false);
select public.send_community_message('See you there','44000000-0000-4000-8000-000000000002','43000000-0000-4000-8000-000000000001');
select public.update_community_read('43000000-0000-4000-8000-000000000001',9223372036854775807,false);
do $$ begin
  if public.list_community_chats()->0->>'unread'<>'0' then raise exception 'Read marker incorrect'; end if;
  if public.list_community_chats()->0->>'last_read' is null then raise exception 'Chat summary omitted the read cursor'; end if;
  if jsonb_array_length(public.list_community_messages('43000000-0000-4000-8000-000000000001'))<>1 then raise exception 'Member message missing'; end if;
end $$;
select public.leave_open_match(current_setting('uneem.test.match_id')::uuid);
do $$ begin
  if public.get_community_message(2) is not null then raise exception 'Former player read private history'; end if;
end $$;
select public.set_community_block('41000000-0000-4000-8000-000000000001',true);
do $$ begin
  if jsonb_array_length(public.list_community_messages())<>0 then raise exception 'Blocked messages remain visible'; end if;
end $$;
select public.set_community_block('41000000-0000-4000-8000-000000000001',false);
select set_config('request.jwt.claim.sub','41000000-0000-4000-8000-000000000004',true);
do $$ begin
  begin perform public.list_community_messages(); raise exception 'Unverified player accessed lobby'; exception when raise_exception then if sqlerrm<>'community_access_required' then raise; end if; end;
end $$;
reset role;
-- Events never contain private text, even if an old socket retains channel access.
do $$ begin
  if exists(select 1 from realtime.test_events where payload ? 'body' or payload ? 'sender_id' or not private) then raise exception 'Broadcast leaked message content'; end if;
end $$;
select set_config('request.jwt.claim.sub','41000000-0000-4000-8000-000000000005',true);
set local role authenticated;
select public.hide_community_message(1);
select set_config('request.jwt.claim.sub','41000000-0000-4000-8000-000000000001',true);
do $$ begin
  if public.get_community_message(1) is not null then raise exception 'Hidden message is still visible'; end if;
  begin perform public.send_community_message('  ',gen_random_uuid()); raise exception 'Blank message accepted'; exception when raise_exception then if sqlerrm<>'community_invalid_message' then raise; end if; end;
end $$;
reset role;
insert into public.community_messages(sender_id,client_id,body)
  select '41000000-0000-4000-8000-000000000003',gen_random_uuid(),'Fictional page fixture' from generate_series(1,40);
set local role authenticated;
do $$ declare v_recent jsonb; v_old jsonb; v_catchup jsonb; begin
  v_recent:=public.list_community_messages(null,null,null,5);
  v_old:=public.list_community_messages(null,(v_recent->0->>'id')::bigint,null,5);
  v_catchup:=public.list_community_messages(null,null,(v_old->4->>'id')::bigint,5);
  if jsonb_array_length(v_recent)<>5 or jsonb_array_length(v_old)<>5 then raise exception 'Message pagination is unbounded'; end if;
  if v_catchup<>v_recent then raise exception 'Reconnect cursor skipped or reordered messages'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
  begin perform public.list_community_players(); raise exception 'Anonymous discovery allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
