-- Unify UNEEM bookings and matches around the booking timeline.
-- Every scheduled booking is visible to approved students by @username.
-- A match remains optional metadata on a booking and is only public when opened.
-- Named reservations are additive to the legacy reserved_spots counter so existing matches keep their capacity semantics.

begin;

create table if not exists public.match_reservations (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  guest_name text,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint match_reservations_one_identity check (
    (profile_id is not null and guest_name is null)
    or (profile_id is null and guest_name is not null)
  ),
  constraint match_reservations_guest_name_length check (
    guest_name is null or char_length(btrim(guest_name)) between 2 and 80
  )
);

create unique index if not exists match_reservations_profile_unique
  on public.match_reservations(match_id, profile_id)
  where profile_id is not null;

create index if not exists match_reservations_match_idx
  on public.match_reservations(match_id, created_at);

alter table public.match_reservations enable row level security;
revoke all on public.match_reservations from anon, authenticated;

drop function if exists public.get_pitch_availability(uuid);

create function public.get_pitch_availability(p_pitch_id uuid)
returns table (
  booking_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  timezone text,
  is_available boolean,
  booked_by_me boolean,
  booker_name text,
  booker_username text,
  match_id uuid,
  match_open boolean,
  capacity integer,
  reserved_spots integer,
  joined_count integer,
  spots_left integer
)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_pitch public.pitches%rowtype;
  v_window_start timestamptz := now();
  v_window_end timestamptz;
  v_local_start timestamp;
  v_start_date date;
  v_end_date date;
  v_step interval;
  v_overnight boolean;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not private.has_app_access() then raise exception 'account_not_approved'; end if;

  select * into v_pitch from public.pitches p where p.id = p_pitch_id and p.is_active = true;
  if not found then raise exception 'pitch_not_found'; end if;

  v_window_end := v_window_start + make_interval(hours => least(coalesce(v_pitch.booking_window_hours, 24), 24));
  v_local_start := v_window_start at time zone v_pitch.timezone;
  v_overnight := v_pitch.close_time < v_pitch.open_time;
  v_start_date := v_local_start::date;
  if v_overnight and v_local_start::time < v_pitch.close_time then v_start_date := v_start_date - 1; end if;
  v_end_date := (v_window_end at time zone v_pitch.timezone)::date;
  v_step := make_interval(mins => v_pitch.slot_duration_minutes);

  return query
  with local_days as (
    select day_value::date as local_day
    from generate_series(v_start_date, v_end_date, interval '1 day') day_value
  ), generated as (
    select gs as generated_start, gs + v_step as generated_end
    from local_days d
    cross join lateral generate_series(
      (d.local_day::timestamp + v_pitch.open_time) at time zone v_pitch.timezone,
      (d.local_day::timestamp + v_pitch.close_time + case when v_overnight then interval '1 day' else interval '0 day' end) at time zone v_pitch.timezone - v_step,
      v_step
    ) gs
    where gs >= v_window_start and gs < v_window_end
  )
  select
    b.id,
    g.generated_start,
    g.generated_end,
    v_pitch.timezone,
    b.id is null,
    coalesce(b.user_id = auth.uid(), false),
    booker.full_name,
    booker.username,
    m.id,
    coalesce(m.status = 'active' and m.visibility = 'open', false),
    v_pitch.capacity,
    coalesce(m.reserved_spots, 0) + coalesce(reservation_stats.named_reserved, 0),
    coalesce(participant_stats.joined_count, 0),
    case when m.status = 'active' and m.visibility = 'open' then greatest(
      v_pitch.capacity - 1 - coalesce(m.reserved_spots, 0) - coalesce(reservation_stats.named_reserved, 0) - coalesce(participant_stats.joined_count, 0), 0
    ) else 0 end
  from generated g
  left join public.bookings b on b.pitch_id = p_pitch_id and b.status = 'scheduled'
    and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(g.generated_start, g.generated_end, '[)')
  left join public.profiles booker on booker.id = b.user_id
  left join public.matches m on m.booking_id = b.id and m.status = 'active'
  left join lateral (
    select count(*)::integer as joined_count from public.match_participants mp where mp.match_id = m.id
  ) participant_stats on true
  left join lateral (
    select count(*)::integer as named_reserved from public.match_reservations mr where mr.match_id = m.id
  ) reservation_stats on true
  order by g.generated_start;
end;
$$;
revoke all on function public.get_pitch_availability(uuid) from public, anon;
grant execute on function public.get_pitch_availability(uuid) to authenticated;

create or replace function public.get_booking_details(p_booking_id uuid)
returns table (
  booking_id uuid, pitch_id uuid, pitch_name text, location text, timezone text, sport_type text,
  starts_at timestamptz, ends_at timestamptz, booking_status text,
  booker_id uuid, booker_name text, booker_username text, capacity integer,
  booked_by_me boolean, match_id uuid, match_visibility text, match_open boolean,
  reserved_spots integer, joined_count integer, spots_left integer,
  participant_by_me boolean, reserved_by_me boolean
)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid();
begin
  perform private.require_sports_access(v_uid);
  return query
  select
    b.id, p.id, p.name, p.location, p.timezone, p.sport_type,
    b.starts_at, b.ends_at, b.status,
    owner.id, owner.full_name, owner.username, p.capacity,
    b.user_id = v_uid,
    case when m.visibility = 'open' or b.user_id = v_uid then m.id else null end,
    coalesce(m.visibility, 'private'),
    coalesce(m.status = 'active' and m.visibility = 'open', false),
    coalesce(m.reserved_spots, 0) + coalesce(reservation_stats.named_reserved, 0),
    coalesce(participant_stats.joined_count, 0),
    case when m.status = 'active' and m.visibility = 'open' then greatest(
      p.capacity - 1 - coalesce(m.reserved_spots, 0) - coalesce(reservation_stats.named_reserved, 0) - coalesce(participant_stats.joined_count, 0), 0
    ) else 0 end,
    coalesce(participant_stats.joined_by_me, false),
    coalesce(reservation_stats.reserved_by_me, false)
  from public.bookings b
  join public.pitches p on p.id = b.pitch_id
  join public.profiles owner on owner.id = b.user_id
  left join public.matches m on m.booking_id = b.id and m.status = 'active'
  left join lateral (
    select count(*)::integer as joined_count,
      coalesce(bool_or(mp.user_id = v_uid), false) as joined_by_me
    from public.match_participants mp where mp.match_id = m.id
  ) participant_stats on true
  left join lateral (
    select count(*)::integer as named_reserved,
      coalesce(bool_or(mr.profile_id = v_uid), false) as reserved_by_me
    from public.match_reservations mr where mr.match_id = m.id
  ) reservation_stats on true
  where b.id = p_booking_id and (b.status = 'scheduled' or b.user_id = v_uid)
  limit 1;
end;
$$;
revoke all on function public.get_booking_details(uuid) from public, anon;
grant execute on function public.get_booking_details(uuid) to authenticated;

create or replace function public.list_booking_roster(p_booking_id uuid)
returns table (
  entry_id text, reservation_id uuid, user_id uuid, display_name text, username text,
  member_role text, source text, joined_at timestamptz
)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid();
begin
  perform private.require_sports_access(v_uid);
  return query
  with context as (
    select b.id as booking_id, b.user_id as organizer_id, b.status as booking_status, m.id as match_id, m.visibility
    from public.bookings b
    left join public.matches m on m.booking_id = b.id and m.status = 'active'
    where b.id = p_booking_id and (b.status = 'scheduled' or b.user_id = v_uid)
  )
  select roster.entry_id, roster.reservation_id, roster.user_id, roster.display_name, roster.username,
    roster.member_role, roster.source, roster.joined_at
  from (
    select 'organizer:' || o.id::text as entry_id, null::uuid as reservation_id, o.id as user_id,
      o.full_name as display_name, o.username, 'organizer'::text as member_role, 'account'::text as source,
      b.created_at as joined_at, 0 as sort_order
    from public.bookings b join context c on c.booking_id = b.id join public.profiles o on o.id = b.user_id
    union all
    select 'player:' || mp.user_id::text, null::uuid, player.id, player.full_name, player.username,
      'player'::text, 'joined'::text, mp.joined_at, 1
    from context c join public.match_participants mp on mp.match_id = c.match_id join public.profiles player on player.id = mp.user_id
    where c.visibility = 'open' or c.organizer_id = v_uid
    union all
    select 'reservation:' || mr.id::text, mr.id, reserved_profile.id,
      coalesce(reserved_profile.full_name, mr.guest_name), reserved_profile.username,
      'reserved'::text, case when mr.profile_id is null then 'guest' else 'registered' end,
      mr.created_at, 2
    from context c join public.match_reservations mr on mr.match_id = c.match_id
    left join public.profiles reserved_profile on reserved_profile.id = mr.profile_id
    where c.visibility = 'open' or c.organizer_id = v_uid
  ) roster
  order by sort_order, joined_at, display_name;
end;
$$;
revoke all on function public.list_booking_roster(uuid) from public, anon;
grant execute on function public.list_booking_roster(uuid) to authenticated;

create or replace function public.add_match_reservation(p_match_id uuid, p_username text default null, p_guest_name text default null)
returns public.match_reservations
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_match public.matches%rowtype;
  v_booking public.bookings%rowtype;
  v_capacity integer;
  v_profile_id uuid;
  v_username text;
  v_guest_name text;
  v_joined integer;
  v_named_reserved integer;
  v_reservation public.match_reservations;
begin
  perform private.require_sports_access(v_uid);
  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'match_not_found'; end if;
  if v_match.organizer_id <> v_uid then raise exception 'organizer_required'; end if;
  if v_match.status <> 'active' or v_match.visibility <> 'open' then raise exception 'match_not_open'; end if;

  select b.* into v_booking from public.bookings b where b.id = v_match.booking_id;
  if not found then raise exception 'booking_not_found'; end if;
  select p.capacity into v_capacity from public.pitches p where p.id = v_booking.pitch_id;

  if v_booking.status <> 'scheduled' or v_booking.starts_at <= now() then raise exception 'match_started'; end if;
  if (nullif(btrim(p_username), '') is null) = (nullif(btrim(p_guest_name), '') is null) then raise exception 'invalid_reserved_name'; end if;

  if nullif(btrim(p_username), '') is not null then
    v_username := lower(ltrim(btrim(p_username), '@'));
    select p.id into v_profile_id from public.profiles p where lower(p.username) = v_username limit 1;
    if v_profile_id is null then raise exception 'reserved_user_not_found'; end if;
    if v_profile_id = v_match.organizer_id then raise exception 'invalid_reserved_name'; end if;
    if exists(select 1 from public.match_participants mp where mp.match_id = p_match_id and mp.user_id = v_profile_id) then raise exception 'reserved_user_already_in_match'; end if;
    if exists(select 1 from public.match_reservations mr where mr.match_id = p_match_id and mr.profile_id = v_profile_id) then raise exception 'reserved_user_already_reserved'; end if;
  else
    v_guest_name := btrim(p_guest_name);
    if char_length(v_guest_name) < 2 or char_length(v_guest_name) > 80 then raise exception 'invalid_reserved_name'; end if;
    if exists(select 1 from public.match_reservations mr where mr.match_id = p_match_id and mr.guest_name is not null and lower(btrim(mr.guest_name)) = lower(v_guest_name)) then raise exception 'reserved_user_already_reserved'; end if;
  end if;

  select count(*)::integer into v_joined from public.match_participants where match_id = p_match_id;
  select count(*)::integer into v_named_reserved from public.match_reservations where match_id = p_match_id;
  if 1 + v_match.reserved_spots + v_named_reserved + v_joined >= v_capacity then raise exception 'match_full'; end if;

  insert into public.match_reservations(match_id, profile_id, guest_name, created_by)
  values(p_match_id, v_profile_id, v_guest_name, v_uid)
  returning * into v_reservation;
  return v_reservation;
end;
$$;
revoke all on function public.add_match_reservation(uuid, text, text) from public, anon;
grant execute on function public.add_match_reservation(uuid, text, text) to authenticated;

create or replace function public.remove_match_reservation(p_match_id uuid, p_reservation_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid(); v_match public.matches%rowtype; v_starts_at timestamptz;
begin
  perform private.require_sports_access(v_uid);
  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'match_not_found'; end if;
  if v_match.organizer_id <> v_uid then raise exception 'organizer_required'; end if;
  select b.starts_at into v_starts_at from public.bookings b where b.id = v_match.booking_id;
  if v_starts_at <= now() then raise exception 'match_started'; end if;
  delete from public.match_reservations where id = p_reservation_id and match_id = p_match_id;
  if not found then raise exception 'reservation_not_found'; end if;
end;
$$;
revoke all on function public.remove_match_reservation(uuid, uuid) from public, anon;
grant execute on function public.remove_match_reservation(uuid, uuid) to authenticated;

create or replace function public.join_open_match(p_match_id uuid)
returns public.match_participants language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid(); v_match public.matches%rowtype; v_start timestamptz; v_booking_status text;
  v_capacity integer; v_joined integer; v_named_reserved integer; v_participant public.match_participants;
begin
  perform private.require_sports_access(v_uid);
  select m.* into v_match from public.matches m where m.id = p_match_id for update;
  if not found then raise exception 'match_not_found'; end if;
  select b.starts_at, b.status, p.capacity into v_start, v_booking_status, v_capacity
  from public.bookings b join public.pitches p on p.id = b.pitch_id where b.id = v_match.booking_id;
  if v_match.visibility <> 'open' or v_match.status <> 'active' then raise exception 'match_not_open'; end if;
  if v_booking_status <> 'scheduled' or v_start <= now() then raise exception 'match_started'; end if;
  if v_match.organizer_id = v_uid then raise exception 'organizer_already_in_match'; end if;
  if exists(select 1 from public.match_participants where match_id = p_match_id and user_id = v_uid) then raise exception 'already_joined'; end if;
  if exists(select 1 from public.match_reservations where match_id = p_match_id and profile_id = v_uid) then raise exception 'already_joined'; end if;
  select count(*)::integer into v_joined from public.match_participants where match_id = p_match_id;
  select count(*)::integer into v_named_reserved from public.match_reservations where match_id = p_match_id;
  if 1 + v_match.reserved_spots + v_named_reserved + v_joined >= v_capacity then raise exception 'match_full'; end if;
  insert into public.match_participants(match_id, user_id) values(p_match_id, v_uid) returning * into v_participant;
  return v_participant;
end;
$$;

create or replace function public.update_match_reserved_spots(p_match_id uuid, p_reserved_spots integer)
returns public.matches language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid(); v_match public.matches%rowtype; v_capacity integer; v_joined integer; v_named_reserved integer;
begin
  perform private.require_sports_access(v_uid);
  select m.* into v_match from public.matches m where m.id = p_match_id for update;
  if not found then raise exception 'match_not_found'; end if;
  select p.capacity into v_capacity from public.bookings b join public.pitches p on p.id = b.pitch_id where b.id = v_match.booking_id;
  if v_match.organizer_id <> v_uid then raise exception 'organizer_required'; end if;
  if v_match.status <> 'active' then raise exception 'match_not_active'; end if;
  select count(*)::integer into v_joined from public.match_participants where match_id = p_match_id;
  select count(*)::integer into v_named_reserved from public.match_reservations where match_id = p_match_id;
  if p_reserved_spots < 0 or 1 + v_joined + v_named_reserved + p_reserved_spots > v_capacity then raise exception 'reserved_spots_exceed_capacity'; end if;
  update public.matches set reserved_spots = p_reserved_spots, updated_at = now() where id = p_match_id returning * into v_match;
  return v_match;
end;
$$;

create or replace function public.list_open_matches()
returns table(
  match_id uuid, booking_id uuid, pitch_id uuid, pitch_name text, location text, timezone text, sport_type text,
  starts_at timestamptz, ends_at timestamptz, organizer_id uuid, organizer_name text, organizer_username text,
  capacity integer, reserved_spots integer, joined_count integer, spots_left integer, joined_by_me boolean, organized_by_me boolean
)
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid();
begin
  perform private.require_sports_access(v_uid);
  return query
  select m.id, b.id, p.id, p.name, p.location, p.timezone, p.sport_type, b.starts_at, b.ends_at,
    m.organizer_id, o.full_name, o.username, p.capacity,
    m.reserved_spots + coalesce(reservation_stats.named_reserved, 0),
    coalesce(participant_stats.joined_count, 0),
    greatest(p.capacity - 1 - m.reserved_spots - coalesce(reservation_stats.named_reserved, 0) - coalesce(participant_stats.joined_count, 0), 0),
    coalesce(participant_stats.joined_by_me, false) or coalesce(reservation_stats.reserved_by_me, false),
    m.organizer_id = v_uid
  from public.matches m
  join public.bookings b on b.id = m.booking_id
  join public.pitches p on p.id = b.pitch_id
  join public.profiles o on o.id = m.organizer_id
  left join lateral (
    select count(*)::integer as joined_count, coalesce(bool_or(mp.user_id = v_uid), false) as joined_by_me
    from public.match_participants mp where mp.match_id = m.id
  ) participant_stats on true
  left join lateral (
    select count(*)::integer as named_reserved, coalesce(bool_or(mr.profile_id = v_uid), false) as reserved_by_me
    from public.match_reservations mr where mr.match_id = m.id
  ) reservation_stats on true
  where m.status = 'active' and m.visibility = 'open' and b.status = 'scheduled' and b.starts_at > now()
  order by b.starts_at, m.created_at;
end;
$$;

create or replace function public.list_my_matches()
returns table(
  match_id uuid, booking_id uuid, pitch_name text, location text, timezone text, sport_type text,
  starts_at timestamptz, ends_at timestamptz, organizer_name text, capacity integer,
  reserved_spots integer, joined_count integer, member_role text, visibility text
)
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid();
begin
  perform private.require_sports_access(v_uid);
  return query
  select m.id, b.id, p.name, p.location, p.timezone, p.sport_type, b.starts_at, b.ends_at, o.full_name, p.capacity,
    m.reserved_spots + (select count(*)::integer from public.match_reservations r where r.match_id = m.id),
    (select count(*)::integer from public.match_participants x where x.match_id = m.id),
    case when m.organizer_id = v_uid then 'organizer'
      when exists(select 1 from public.match_participants mp where mp.match_id = m.id and mp.user_id = v_uid) then 'player'
      else 'reserved' end,
    m.visibility
  from public.matches m
  join public.bookings b on b.id = m.booking_id
  join public.pitches p on p.id = b.pitch_id
  join public.profiles o on o.id = m.organizer_id
  where m.status = 'active' and b.status = 'scheduled' and (
    m.organizer_id = v_uid
    or exists(select 1 from public.match_participants mp where mp.match_id = m.id and mp.user_id = v_uid)
    or exists(select 1 from public.match_reservations mr where mr.match_id = m.id and mr.profile_id = v_uid)
  )
  order by b.starts_at desc;
end;
$$;

revoke all on function public.join_open_match(uuid) from public, anon;
grant execute on function public.join_open_match(uuid) to authenticated;
revoke all on function public.update_match_reserved_spots(uuid, integer) from public, anon;
grant execute on function public.update_match_reserved_spots(uuid, integer) to authenticated;
revoke all on function public.list_open_matches() from public, anon;
grant execute on function public.list_open_matches() to authenticated;
revoke all on function public.list_my_matches() from public, anon;
grant execute on function public.list_my_matches() to authenticated;

commit;
