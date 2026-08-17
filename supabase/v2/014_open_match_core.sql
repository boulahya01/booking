-- UNEEM V2 open-match core. Apply after 013_public_username_identity.sql.
-- A match references one existing booking; joining never creates another booking.
begin;

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  organizer_id uuid not null references public.profiles(id) on delete restrict,
  visibility text not null default 'open' check (visibility in ('private','open')),
  reserved_spots integer not null default 0 check (reserved_spots >= 0),
  status text not null default 'active' check (status in ('active','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.match_participants (
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (match_id,user_id)
);

create index matches_open_idx on public.matches (created_at desc) where status='active' and visibility='open';
create index match_participants_user_idx on public.match_participants (user_id,joined_at desc);
create trigger matches_set_updated_at before update on public.matches for each row execute function private.set_updated_at();

alter table public.matches enable row level security;
alter table public.match_participants enable row level security;
revoke all on public.matches from anon,authenticated;
revoke all on public.match_participants from anon,authenticated;

create or replace function private.require_sports_access(p_user_id uuid)
returns void language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  if p_user_id is null then raise exception 'authentication_required'; end if;
  if not exists(select 1 from public.profiles p where p.id=p_user_id and p.status='approved') then
    raise exception 'account_not_approved';
  end if;
end;$$;
revoke all on function private.require_sports_access(uuid) from public,anon,authenticated;

create or replace function public.create_open_match(p_booking_id uuid,p_reserved_spots integer default 0)
returns public.matches language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_uid uuid:=auth.uid(); v_booking public.bookings%rowtype; v_capacity integer; v_joined integer; v_match public.matches;
begin
  perform private.require_sports_access(v_uid);
  select b,p.capacity into v_booking,v_capacity from public.bookings b join public.pitches p on p.id=b.pitch_id where b.id=p_booking_id for update of b;
  if not found then raise exception 'booking_not_found'; end if;
  if v_booking.user_id<>v_uid then raise exception 'booking_not_owned'; end if;
  if v_booking.status<>'scheduled' or v_booking.starts_at<=now() then raise exception 'booking_not_matchable'; end if;
  if v_capacity<2 then raise exception 'match_capacity_too_small'; end if;
  if p_reserved_spots<0 or p_reserved_spots>v_capacity-1 then raise exception 'invalid_reserved_spots'; end if;

  select count(*) into v_joined from public.matches m left join public.match_participants mp on mp.match_id=m.id where m.booking_id=p_booking_id;
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

create or replace function public.update_match_reserved_spots(p_match_id uuid,p_reserved_spots integer)
returns public.matches language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_uid uuid:=auth.uid(); v_match public.matches%rowtype; v_capacity integer; v_joined integer;
begin
  perform private.require_sports_access(v_uid);
  select m,p.capacity into v_match,v_capacity from public.matches m join public.bookings b on b.id=m.booking_id join public.pitches p on p.id=b.pitch_id where m.id=p_match_id for update of m;
  if not found then raise exception 'match_not_found'; end if;
  if v_match.organizer_id<>v_uid then raise exception 'organizer_required'; end if;
  if v_match.status<>'active' then raise exception 'match_not_active'; end if;
  select count(*) into v_joined from public.match_participants where match_id=p_match_id;
  if p_reserved_spots<0 or 1+v_joined+p_reserved_spots>v_capacity then raise exception 'reserved_spots_exceed_capacity'; end if;
  update public.matches set reserved_spots=p_reserved_spots,updated_at=now() where id=p_match_id returning * into v_match;
  return v_match;
end;$$;
revoke all on function public.update_match_reserved_spots(uuid,integer) from public,anon;
grant execute on function public.update_match_reserved_spots(uuid,integer) to authenticated;

create or replace function public.set_match_visibility(p_match_id uuid,p_visibility text)
returns public.matches language plpgsql security definer set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_match public.matches%rowtype;
begin
  perform private.require_sports_access(v_uid);
  if p_visibility not in('private','open') then raise exception 'invalid_match_visibility'; end if;
  select * into v_match from public.matches where id=p_match_id for update;
  if not found then raise exception 'match_not_found'; end if;
  if v_match.organizer_id<>v_uid then raise exception 'organizer_required'; end if;
  if p_visibility='private' and exists(select 1 from public.match_participants where match_id=p_match_id) then raise exception 'match_has_public_players'; end if;
  update public.matches set visibility=p_visibility,updated_at=now() where id=p_match_id returning * into v_match;
  return v_match;
end;$$;
revoke all on function public.set_match_visibility(uuid,text) from public,anon;
grant execute on function public.set_match_visibility(uuid,text) to authenticated;

create or replace function public.join_open_match(p_match_id uuid)
returns public.match_participants language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_uid uuid:=auth.uid(); v_match public.matches%rowtype; v_start timestamptz; v_booking_status text; v_capacity integer; v_joined integer; v_participant public.match_participants;
begin
  perform private.require_sports_access(v_uid);
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

create or replace function public.leave_open_match(p_match_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_start timestamptz;
begin
  perform private.require_sports_access(v_uid);
  select b.starts_at into v_start from public.matches m join public.bookings b on b.id=m.booking_id where m.id=p_match_id;
  if not found then raise exception 'match_not_found'; end if;
  if v_start<=now() then raise exception 'match_started'; end if;
  delete from public.match_participants where match_id=p_match_id and user_id=v_uid;
  if not found then raise exception 'not_joined'; end if;
end;$$;
revoke all on function public.leave_open_match(uuid) from public,anon;
grant execute on function public.leave_open_match(uuid) to authenticated;

commit;
