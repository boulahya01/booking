-- UNEEM V2 open-match contract tests.
-- Run against the final V2 schema through layer 024. Transactional; rolls back fixtures.
-- Synthetic confirmed Supabase Auth rows are paired with profile fixtures so the
-- confirmation-aware match authorization contract is exercised explicitly.
-- The final schema keeps matches/match_participants RPC-only for browser roles;
-- authenticated test steps therefore never read those tables directly.
\set ON_ERROR_STOP on
begin;
set local timezone='UTC';
set local session_replication_role=replica;

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
    'authenticated', 'authenticated', 'match-organizer@usmba.ac.ma', '', now(),
    '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '81000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'match-player1@usmba.ac.ma', '', now(),
    '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '81000000-0000-4000-8000-000000000003',
    'authenticated', 'authenticated', 'match-player2@usmba.ac.ma', '', now(),
    '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '81000000-0000-4000-8000-000000000004',
    'authenticated', 'authenticated', 'match-restricted@example.com', '', now(),
    '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.profiles(id,student_id,full_name,username,role,status,email_kind,identity_status)
values
('81000000-0000-4000-8000-000000000001','M000000001','Organizer','organizer','student','approved','academic','verified'),
('81000000-0000-4000-8000-000000000002','M000000002','Player One','player_one','student','approved','academic','verified'),
('81000000-0000-4000-8000-000000000003','M000000003','Player Two','player_two','student','approved','academic','verified'),
('81000000-0000-4000-8000-000000000004','M000000004','Restricted','restricted','student','pending','personal','pending');
set local session_replication_role=origin;

insert into public.pitches(id,name,location,sport_type,capacity,timezone,open_time,close_time,slot_duration_minutes,booking_window_hours,is_active)
values('82000000-0000-4000-8000-000000000001','Match pitch','Campus','football',4,'UTC','00:00','23:59',60,168,true);
insert into public.bookings(id,user_id,pitch_id,starts_at,ends_at,status)
values
('83000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001',date_trunc('hour',now())+interval '4 hours',date_trunc('hour',now())+interval '5 hours','scheduled'),
('83000000-0000-4000-8000-000000000002','81000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001',date_trunc('hour',now())+interval '6 hours',date_trunc('hour',now())+interval '7 hours','scheduled');

-- Organizer opens the existing booking with one offline/reserved friend.
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select public.create_open_match('83000000-0000-4000-8000-000000000001',1);
reset role;

-- Capture fixture ids while privileged. Browser-role steps use only these opaque ids
-- and public RPCs, matching the production RPC-only table contract.
select set_config(
  'uneem.test.match1_id',
  (select id::text from public.matches where booking_id='83000000-0000-4000-8000-000000000001'),
  true
);

do $$ begin
 if (select count(*) from public.matches where booking_id='83000000-0000-4000-8000-000000000001')<>1 then raise exception 'FAIL: open match missing'; end if;
 if (select count(*) from public.bookings where id='83000000-0000-4000-8000-000000000001')<>1 then raise exception 'FAIL: match created another booking'; end if;
end $$;

-- An empty organizer-owned match can move private and be reopened safely.
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select public.create_open_match('83000000-0000-4000-8000-000000000002',0);
reset role;

select set_config(
  'uneem.test.match2_id',
  (select id::text from public.matches where booking_id='83000000-0000-4000-8000-000000000002'),
  true
);

select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select public.set_match_visibility(current_setting('uneem.test.match2_id')::uuid,'private');
select public.create_open_match('83000000-0000-4000-8000-000000000002',2);
reset role;

do $$ begin
 if not exists(
   select 1 from public.matches
   where id=current_setting('uneem.test.match2_id')::uuid
     and booking_id='83000000-0000-4000-8000-000000000002'
     and visibility='open' and reserved_spots=2 and status='active'
 ) then raise exception 'FAIL: empty private match did not reopen'; end if;
end $$;

-- Keep the second fixture out of public discovery for the capacity assertions below.
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select public.set_match_visibility(current_setting('uneem.test.match2_id')::uuid,'private');
reset role;

-- First public player joins. Capacity math is organizer + reserved + joined.
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000002',true);
set local role authenticated;
select public.join_open_match(current_setting('uneem.test.match1_id')::uuid);
reset role;

-- Organizer cannot make it private after a public player joined.
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ begin
 begin
   perform public.set_match_visibility(current_setting('uneem.test.match1_id')::uuid,'private');
   raise exception 'FAIL: match became private with public player';
 exception when others then
   if sqlerrm<>'match_has_public_players' then raise; end if;
 end;
end $$;
reset role;

-- Increasing reserved spots cannot displace joined players.
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ begin
 begin
   perform public.update_match_reserved_spots(current_setting('uneem.test.match1_id')::uuid,3);
   raise exception 'FAIL: reserved spots exceeded capacity';
 exception when others then
   if sqlerrm<>'reserved_spots_exceed_capacity' then raise; end if;
 end;
end $$;
reset role;

-- One remaining public spot can be taken, then discovery reports the match full.
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000003',true);
set local role authenticated;
select public.join_open_match(current_setting('uneem.test.match1_id')::uuid);
do $$ begin
 if (select spots_left from public.list_open_matches() where match_id=current_setting('uneem.test.match1_id')::uuid)<>0 then
   raise exception 'FAIL: spots_left is not zero at capacity';
 end if;
end $$;
reset role;

-- Restricted account cannot join even though its Auth email is confirmed.
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000004',true);
set local role authenticated;
do $$ begin
 begin
   perform public.join_open_match(current_setting('uneem.test.match1_id')::uuid);
   raise exception 'FAIL: restricted user joined';
 exception when others then
   if sqlerrm<>'account_not_approved' then raise; end if;
 end;
end $$;
reset role;

-- Direct participant writes remain closed; this specifically tests INSERT privilege
-- without first touching the RPC-only matches table.
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ begin
 begin
   insert into public.match_participants(match_id,user_id)
   values(current_setting('uneem.test.match1_id')::uuid,'81000000-0000-4000-8000-000000000004');
   raise exception 'FAIL: direct participant write succeeded';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;

-- Cancelling the authoritative booking closes its match for everyone and keeps history.
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select public.cancel_booking('83000000-0000-4000-8000-000000000001');
do $$ begin
 if exists(select 1 from public.list_open_matches() where match_id=current_setting('uneem.test.match1_id')::uuid) then
   raise exception 'FAIL: cancelled booking remained in open match discovery';
 end if;
end $$;
reset role;

do $$ begin
 if (select status from public.matches where id=current_setting('uneem.test.match1_id')::uuid)<>'cancelled' then
   raise exception 'FAIL: cancelled booking left active match';
 end if;
 if (select count(*) from public.match_participants where match_id=current_setting('uneem.test.match1_id')::uuid)<>2 then
   raise exception 'FAIL: cancellation destroyed match participant history';
 end if;
end $$;

rollback;
\echo 'UNEEM V2 final-schema match contract tests passed.'
