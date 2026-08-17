-- UNEEM V2 capability enforcement bridge. Apply after 019.
-- Keep legacy approved-account semantics while making moderation restrictions
-- authoritative for booking/match operations.
begin;

create or replace function private.require_sports_access(p_user_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
begin
  if p_user_id is null then raise exception 'authentication_required'; end if;
  if not exists(select 1 from public.profiles p where p.id=p_user_id and p.status='approved') then
    raise exception 'account_not_approved';
  end if;
  if private.has_active_restriction(p_user_id, 'sports') then
    raise exception 'sports_restricted';
  end if;
end;
$$;
revoke all on function private.require_sports_access(uuid) from public, anon, authenticated;

create or replace function private.require_match_access(p_user_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
begin
  perform private.require_sports_access(p_user_id);
  if private.has_active_restriction(p_user_id, 'matches') then
    raise exception 'matches_restricted';
  end if;
end;
$$;
revoke all on function private.require_match_access(uuid) from public, anon, authenticated;

-- Match mutations need the narrower match capability, not merely booking access.
-- Re-declare only the access guard at function entry while preserving the
-- existing race-safe row locks/capacity invariants.
create or replace function public.join_open_match(p_match_id uuid)
returns public.match_participants language plpgsql security definer set search_path=public,private,pg_temp as $$
declare
  v_uid uuid:=auth.uid(); v_match public.matches%rowtype; v_start timestamptz; v_booking_status text; v_capacity integer; v_joined integer; v_participant public.match_participants;
begin
  perform private.require_match_access(v_uid);
  select m,b.starts_at,b.status,p.capacity into v_match,v_start,v_booking_status,v_capacity
  from public.matches m join public.bookings b on b.id=m.booking_id join public.pitches p on p.id=b.pitch_id where m.id=p_match_id for update of m;
  if not found then raise exception 'match_not_found'; end if;
  if v_match.visibility<>'open' or v_match.status<>'active' then raise exception 'match_not_open'; end if;
  if v_booking_status<>'scheduled' or v_start<=now() then raise exception 'match_started'; end if;
  if v_match.organizer_id=v_uid then raise exception 'organizer_already_in_match'; end if;
  if exists(select 1 from public.match_participants where match_id=p_match_id and user_id=v_uid) then raise exception 'already_joined'; end if;
  select count(*) into v_joined from public.match_participants where match_id=p_match_id;
  if 1+v_match.reserved_spots+v_joined>=v_capacity then raise exception 'match_full'; end if;
  insert into public.match_participants(match_id,user_id) values(p_match_id,v_uid) returning * into v_participant;
  return v_participant;
end;$$;
revoke all on function public.join_open_match(uuid) from public,anon;
grant execute on function public.join_open_match(uuid) to authenticated;

create or replace function public.create_open_match(p_booking_id uuid,p_reserved_spots integer default 0)
returns public.matches language plpgsql security definer set search_path=public,private,pg_temp as $$
declare
  v_uid uuid:=auth.uid(); v_booking public.bookings%rowtype; v_capacity integer; v_joined integer; v_match public.matches;
begin
  perform private.require_match_access(v_uid);
  select b,p.capacity into v_booking,v_capacity from public.bookings b join public.pitches p on p.id=b.pitch_id where b.id=p_booking_id for update of b;
  if not found then raise exception 'booking_not_found'; end if;
  if v_booking.user_id<>v_uid then raise exception 'booking_not_owned'; end if;
  if v_booking.status<>'scheduled' or v_booking.starts_at<=now() then raise exception 'booking_not_matchable'; end if;
  if v_capacity<2 then raise exception 'match_capacity_too_small'; end if;
  if p_reserved_spots<0 or p_reserved_spots>v_capacity-1 then raise exception 'invalid_reserved_spots'; end if;
  select count(mp.user_id) into v_joined from public.matches m left join public.match_participants mp on mp.match_id=m.id where m.booking_id=p_booking_id;
  if v_joined>0 then raise exception 'match_has_public_players'; end if;
  insert into public.matches(booking_id,organizer_id,visibility,reserved_spots,status)
  values(v_booking.id,v_uid,'open',p_reserved_spots,'active')
  on conflict(booking_id) do update set visibility='open',reserved_spots=excluded.reserved_spots,status='active',updated_at=now()
    where public.matches.organizer_id=v_uid
  returning * into v_match;
  if v_match.id is null then raise exception 'organizer_required'; end if;
  return v_match;
end;$$;
revoke all on function public.create_open_match(uuid,integer) from public,anon;
grant execute on function public.create_open_match(uuid,integer) to authenticated;

commit;
