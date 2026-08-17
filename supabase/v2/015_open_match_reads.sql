-- UNEEM V2 open-match discovery/admin read model. Apply after 014_open_match_core.sql.
begin;

create or replace function public.list_open_matches()
returns table(
  match_id uuid, booking_id uuid, pitch_id uuid, pitch_name text, location text, sport_type text,
  starts_at timestamptz, ends_at timestamptz, organizer_id uuid, organizer_name text,
  organizer_username text, capacity integer, reserved_spots integer, joined_count integer,
  spots_left integer, joined_by_me boolean, organized_by_me boolean
)
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid();
begin
  perform private.require_sports_access(v_uid);
  return query
  select m.id,b.id,p.id,p.name,p.location,p.sport_type,b.starts_at,b.ends_at,m.organizer_id,
         o.full_name,o.username,p.capacity,m.reserved_spots,count(mp.user_id)::integer,
         greatest(p.capacity-1-m.reserved_spots-count(mp.user_id)::integer,0),
         coalesce(bool_or(mp.user_id=v_uid),false),m.organizer_id=v_uid
  from public.matches m
  join public.bookings b on b.id=m.booking_id
  join public.pitches p on p.id=b.pitch_id
  join public.profiles o on o.id=m.organizer_id
  left join public.match_participants mp on mp.match_id=m.id
  where m.status='active' and m.visibility='open' and b.status='scheduled' and b.starts_at>now()
  group by m.id,b.id,p.id,o.id
  order by b.starts_at,m.created_at;
end;$$;
revoke all on function public.list_open_matches() from public,anon;
grant execute on function public.list_open_matches() to authenticated;

create or replace function public.get_match_roster(p_match_id uuid)
returns table(user_id uuid,full_name text,username text,member_role text,joined_at timestamptz)
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_match public.matches%rowtype;
begin
  perform private.require_sports_access(v_uid);
  select * into v_match from public.matches where id=p_match_id;
  if not found then raise exception 'match_not_found'; end if;
  if v_match.visibility<>'open' and v_match.organizer_id<>v_uid and not private.is_admin() then raise exception 'match_not_visible'; end if;
  return query
    select v_match.organizer_id,p.full_name,p.username,'organizer'::text,v_match.created_at
    from public.profiles p where p.id=v_match.organizer_id
    union all
    select mp.user_id,p.full_name,p.username,'player'::text,mp.joined_at
    from public.match_participants mp join public.profiles p on p.id=mp.user_id
    where mp.match_id=p_match_id
    order by joined_at;
end;$$;
revoke all on function public.get_match_roster(uuid) from public,anon;
grant execute on function public.get_match_roster(uuid) to authenticated;

create or replace function public.list_my_matches()
returns table(
  match_id uuid, booking_id uuid, pitch_name text, location text, sport_type text,
  starts_at timestamptz, ends_at timestamptz, organizer_name text, capacity integer,
  reserved_spots integer, joined_count integer, member_role text, visibility text
)
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid();
begin
  perform private.require_sports_access(v_uid);
  return query
  select m.id,b.id,p.name,p.location,p.sport_type,b.starts_at,b.ends_at,o.full_name,p.capacity,
         m.reserved_spots,(select count(*)::integer from public.match_participants x where x.match_id=m.id),
         case when m.organizer_id=v_uid then 'organizer' else 'player' end,m.visibility
  from public.matches m
  join public.bookings b on b.id=m.booking_id
  join public.pitches p on p.id=b.pitch_id
  join public.profiles o on o.id=m.organizer_id
  where m.status='active' and b.status='scheduled'
    and (m.organizer_id=v_uid or exists(select 1 from public.match_participants mp where mp.match_id=m.id and mp.user_id=v_uid))
  order by b.starts_at desc;
end;$$;
revoke all on function public.list_my_matches() from public,anon;
grant execute on function public.list_my_matches() to authenticated;

create or replace function public.admin_list_matches()
returns table(match_id uuid,booking_id uuid,pitch_name text,starts_at timestamptz,organizer_name text,
  visibility text,status text,reserved_spots integer,joined_count integer,capacity integer)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  if not private.is_admin() then raise exception 'admin_required'; end if;
  return query
  select m.id,b.id,p.name,b.starts_at,o.full_name,m.visibility,m.status,m.reserved_spots,
         count(mp.user_id)::integer,p.capacity
  from public.matches m
  join public.bookings b on b.id=m.booking_id
  join public.pitches p on p.id=b.pitch_id
  join public.profiles o on o.id=m.organizer_id
  left join public.match_participants mp on mp.match_id=m.id
  group by m.id,b.id,p.id,o.id
  order by b.starts_at desc;
end;$$;
revoke all on function public.admin_list_matches() from public,anon;
grant execute on function public.admin_list_matches() to authenticated;

commit;
