-- UNEEM V2 open-match contract tests. Transactional; rolls back fixtures.
\set ON_ERROR_STOP on
begin;
set local timezone='UTC';
set local session_replication_role=replica;
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
values('83000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001',date_trunc('hour',now())+interval '4 hours',date_trunc('hour',now())+interval '5 hours','scheduled');

-- Organizer opens the existing booking with one offline/reserved friend.
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000001',true); set local role authenticated;
select public.create_open_match('83000000-0000-4000-8000-000000000001',1);
reset role;

do $$ begin
 if (select count(*) from public.matches where booking_id='83000000-0000-4000-8000-000000000001')<>1 then raise exception 'FAIL: open match missing'; end if;
 if (select count(*) from public.bookings where pitch_id='82000000-0000-4000-8000-000000000001')<>1 then raise exception 'FAIL: match created another booking'; end if;
end $$;

-- First public player joins. Capacity math is organizer + reserved + joined.
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000002',true); set local role authenticated;
select public.join_open_match((select id from public.matches where booking_id='83000000-0000-4000-8000-000000000001'));
reset role;

-- Organizer cannot make it private after a public player joined.
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000001',true); set local role authenticated;
do $$ begin
 begin perform public.set_match_visibility((select id from public.matches where booking_id='83000000-0000-4000-8000-000000000001'),'private'); raise exception 'FAIL: match became private with public player';
 exception when others then if sqlerrm<>'match_has_public_players' then raise; end if; end;
end $$;
reset role;

-- Increasing reserved spots cannot displace joined players.
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000001',true); set local role authenticated;
do $$ begin
 begin perform public.update_match_reserved_spots((select id from public.matches where booking_id='83000000-0000-4000-8000-000000000001'),3); raise exception 'FAIL: reserved spots exceeded capacity';
 exception when others then if sqlerrm<>'reserved_spots_exceed_capacity' then raise; end if; end;
end $$;
reset role;

-- One remaining public spot can be taken, then the match is full.
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000003',true); set local role authenticated;
select public.join_open_match((select id from public.matches where booking_id='83000000-0000-4000-8000-000000000001'));
reset role;

do $$ begin
 if (select spots_left from public.list_open_matches() limit 1)<>0 then raise exception 'FAIL: spots_left is not zero at capacity'; end if;
end $$;

-- Restricted account cannot join.
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000004',true); set local role authenticated;
do $$ begin
 begin perform public.join_open_match((select id from public.matches where booking_id='83000000-0000-4000-8000-000000000001')); raise exception 'FAIL: restricted user joined';
 exception when others then if sqlerrm<>'account_not_approved' then raise; end if; end;
end $$;
reset role;

-- Direct table writes remain closed to students.
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000002',true); set local role authenticated;
do $$ begin
 begin insert into public.match_participants(match_id,user_id) values((select id from public.matches limit 1),'81000000-0000-4000-8000-000000000004'); raise exception 'FAIL: direct participant write succeeded';
 exception when insufficient_privilege then null; end;
end $$;
reset role;

rollback;
\echo 'UNEEM V2 match contract tests passed.'
