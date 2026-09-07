-- Preserve the established booking -> match serialization order for every named
-- reservation mutation and make facility capacity reductions account for the
-- new reservation rows. This keeps cancellation/capacity races safe while the
-- unified booking UI is introduced.

begin;

create or replace function public.add_match_reservation(
  p_match_id uuid,
  p_username text default null,
  p_guest_name text default null
)
returns public.match_reservations
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_booking_id uuid;
  v_booking public.bookings%rowtype;
  v_match public.matches%rowtype;
  v_capacity integer;
  v_profile_id uuid;
  v_username text;
  v_guest_name text;
  v_joined integer;
  v_named_reserved integer;
  v_reservation public.match_reservations;
begin
  perform private.require_sports_access(v_uid);

  select m.booking_id
  into v_booking_id
  from public.matches m
  where m.id = p_match_id;

  if not found then
    raise exception 'match_not_found';
  end if;

  -- Match every existing lifecycle mutation: booking first, then match.
  select b.*
  into v_booking
  from public.bookings b
  where b.id = v_booking_id
  for update;

  if not found then
    raise exception 'booking_not_found';
  end if;

  select m.*
  into v_match
  from public.matches m
  where m.id = p_match_id
    and m.booking_id = v_booking.id
  for update;

  if not found then
    raise exception 'match_not_found';
  end if;

  if v_match.organizer_id <> v_uid then
    raise exception 'organizer_required';
  end if;

  if v_match.status <> 'active' or v_match.visibility <> 'open' then
    raise exception 'match_not_open';
  end if;

  if v_booking.status <> 'scheduled' or v_booking.starts_at <= now() then
    raise exception 'match_started';
  end if;

  select p.capacity
  into v_capacity
  from public.pitches p
  where p.id = v_booking.pitch_id;

  if (nullif(btrim(coalesce(p_username, '')), '') is null)
     = (nullif(btrim(coalesce(p_guest_name, '')), '') is null) then
    raise exception 'invalid_reserved_name';
  end if;

  if nullif(btrim(coalesce(p_username, '')), '') is not null then
    v_username := lower(ltrim(btrim(p_username), '@'));

    if v_username = '' then
      raise exception 'invalid_reserved_name';
    end if;

    select p.id
    into v_profile_id
    from public.profiles p
    where lower(p.username) = v_username
    limit 1;

    if v_profile_id is null then
      raise exception 'reserved_user_not_found';
    end if;

    if v_profile_id = v_match.organizer_id then
      raise exception 'invalid_reserved_name';
    end if;

    if exists (
      select 1
      from public.match_participants mp
      where mp.match_id = p_match_id
        and mp.user_id = v_profile_id
    ) then
      raise exception 'reserved_user_already_in_match';
    end if;

    if exists (
      select 1
      from public.match_reservations mr
      where mr.match_id = p_match_id
        and mr.profile_id = v_profile_id
    ) then
      raise exception 'reserved_user_already_reserved';
    end if;
  else
    v_guest_name := btrim(p_guest_name);

    if char_length(v_guest_name) < 2 or char_length(v_guest_name) > 80 then
      raise exception 'invalid_reserved_name';
    end if;

    if exists (
      select 1
      from public.match_reservations mr
      where mr.match_id = p_match_id
        and mr.guest_name is not null
        and lower(btrim(mr.guest_name)) = lower(v_guest_name)
    ) then
      raise exception 'reserved_user_already_reserved';
    end if;
  end if;

  select count(*)::integer
  into v_joined
  from public.match_participants
  where match_id = p_match_id;

  select count(*)::integer
  into v_named_reserved
  from public.match_reservations
  where match_id = p_match_id;

  if 1 + v_match.reserved_spots + v_named_reserved + v_joined >= v_capacity then
    raise exception 'match_full';
  end if;

  insert into public.match_reservations(match_id, profile_id, guest_name, created_by)
  values (p_match_id, v_profile_id, v_guest_name, v_uid)
  returning * into v_reservation;

  return v_reservation;
end;
$$;

revoke all on function public.add_match_reservation(uuid, text, text) from public, anon;
grant execute on function public.add_match_reservation(uuid, text, text) to authenticated;

create or replace function public.remove_match_reservation(
  p_match_id uuid,
  p_reservation_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_booking_id uuid;
  v_booking public.bookings%rowtype;
  v_match public.matches%rowtype;
begin
  perform private.require_sports_access(v_uid);

  select m.booking_id
  into v_booking_id
  from public.matches m
  where m.id = p_match_id;

  if not found then
    raise exception 'match_not_found';
  end if;

  select b.*
  into v_booking
  from public.bookings b
  where b.id = v_booking_id
  for update;

  if not found then
    raise exception 'booking_not_found';
  end if;

  select m.*
  into v_match
  from public.matches m
  where m.id = p_match_id
    and m.booking_id = v_booking.id
  for update;

  if not found then
    raise exception 'match_not_found';
  end if;

  if v_match.organizer_id <> v_uid then
    raise exception 'organizer_required';
  end if;

  if v_match.status <> 'active' then
    raise exception 'match_not_active';
  end if;

  if v_booking.status <> 'scheduled' or v_booking.starts_at <= now() then
    raise exception 'match_started';
  end if;

  delete from public.match_reservations
  where id = p_reservation_id
    and match_id = p_match_id;

  if not found then
    raise exception 'reservation_not_found';
  end if;
end;
$$;

revoke all on function public.remove_match_reservation(uuid, uuid) from public, anon;
grant execute on function public.remove_match_reservation(uuid, uuid) to authenticated;

create or replace function public.join_open_match(p_match_id uuid)
returns public.match_participants
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_booking_id uuid;
  v_booking public.bookings%rowtype;
  v_match public.matches%rowtype;
  v_capacity integer;
  v_joined integer;
  v_named_reserved integer;
  v_participant public.match_participants;
begin
  perform private.require_sports_access(v_uid);

  select m.booking_id
  into v_booking_id
  from public.matches m
  where m.id = p_match_id;

  if not found then
    raise exception 'match_not_found';
  end if;

  select b.*
  into v_booking
  from public.bookings b
  where b.id = v_booking_id
  for update;

  if not found then
    raise exception 'booking_not_found';
  end if;

  select m.*
  into v_match
  from public.matches m
  where m.id = p_match_id
    and m.booking_id = v_booking.id
  for update;

  if not found then
    raise exception 'match_not_found';
  end if;

  if v_match.visibility <> 'open' or v_match.status <> 'active' then
    raise exception 'match_not_open';
  end if;

  if v_booking.status <> 'scheduled' or v_booking.starts_at <= now() then
    raise exception 'match_started';
  end if;

  if v_match.organizer_id = v_uid then
    raise exception 'organizer_already_in_match';
  end if;

  if exists (
    select 1
    from public.match_participants mp
    where mp.match_id = p_match_id
      and mp.user_id = v_uid
  ) then
    raise exception 'already_joined';
  end if;

  -- A registered reservation already owns a seat and must not consume another.
  if exists (
    select 1
    from public.match_reservations mr
    where mr.match_id = p_match_id
      and mr.profile_id = v_uid
  ) then
    raise exception 'already_joined';
  end if;

  select p.capacity
  into v_capacity
  from public.pitches p
  where p.id = v_booking.pitch_id;

  select count(*)::integer
  into v_joined
  from public.match_participants
  where match_id = p_match_id;

  select count(*)::integer
  into v_named_reserved
  from public.match_reservations
  where match_id = p_match_id;

  if 1 + v_match.reserved_spots + v_named_reserved + v_joined >= v_capacity then
    raise exception 'match_full';
  end if;

  insert into public.match_participants(match_id, user_id)
  values (p_match_id, v_uid)
  returning * into v_participant;

  return v_participant;
end;
$$;

revoke all on function public.join_open_match(uuid) from public, anon;
grant execute on function public.join_open_match(uuid) to authenticated;

create or replace function public.update_match_reserved_spots(
  p_match_id uuid,
  p_reserved_spots integer
)
returns public.matches
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_booking_id uuid;
  v_booking public.bookings%rowtype;
  v_match public.matches%rowtype;
  v_capacity integer;
  v_joined integer;
  v_named_reserved integer;
begin
  perform private.require_sports_access(v_uid);

  if p_reserved_spots is null then
    raise exception 'invalid_reserved_spots';
  end if;

  select m.booking_id
  into v_booking_id
  from public.matches m
  where m.id = p_match_id;

  if not found then
    raise exception 'match_not_found';
  end if;

  select b.*
  into v_booking
  from public.bookings b
  where b.id = v_booking_id
  for update;

  if not found then
    raise exception 'booking_not_found';
  end if;

  select m.*
  into v_match
  from public.matches m
  where m.id = p_match_id
    and m.booking_id = v_booking.id
  for update;

  if not found then
    raise exception 'match_not_found';
  end if;

  if v_match.organizer_id <> v_uid then
    raise exception 'organizer_required';
  end if;

  if v_match.status <> 'active' then
    raise exception 'match_not_active';
  end if;

  if v_booking.status <> 'scheduled' or v_booking.starts_at <= now() then
    raise exception 'match_started';
  end if;

  select p.capacity
  into v_capacity
  from public.pitches p
  where p.id = v_booking.pitch_id;

  select count(*)::integer
  into v_joined
  from public.match_participants
  where match_id = p_match_id;

  select count(*)::integer
  into v_named_reserved
  from public.match_reservations
  where match_id = p_match_id;

  if p_reserved_spots < 0
     or 1 + v_joined + v_named_reserved + p_reserved_spots > v_capacity then
    raise exception 'reserved_spots_exceed_capacity';
  end if;

  update public.matches
  set reserved_spots = p_reserved_spots,
      updated_at = now()
  where id = p_match_id
  returning * into v_match;

  return v_match;
end;
$$;

revoke all on function public.update_match_reserved_spots(uuid, integer) from public, anon;
grant execute on function public.update_match_reserved_spots(uuid, integer) to authenticated;

-- Admin facility capacity changes already serialize pitch -> bookings -> matches.
-- A pitch-level guard makes the new named reservations part of the same invariant
-- and also protects any future privileged capacity update path.
create or replace function private.enforce_named_match_capacity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.capacity is null or old.capacity is null or new.capacity >= old.capacity then
    return new;
  end if;

  perform 1
  from public.bookings b
  where b.pitch_id = old.id
    and b.status = 'scheduled'
    and b.starts_at > now()
  order by b.id
  for update;

  perform 1
  from public.matches m
  join public.bookings b on b.id = m.booking_id
  where b.pitch_id = old.id
    and b.status = 'scheduled'
    and b.starts_at > now()
    and m.status = 'active'
  order by m.id
  for update of m;

  if exists (
    select 1
    from public.matches m
    join public.bookings b on b.id = m.booking_id
    where b.pitch_id = old.id
      and b.status = 'scheduled'
      and b.starts_at > now()
      and m.status = 'active'
      and (
        1
        + m.reserved_spots
        + (select count(*)::integer from public.match_participants mp where mp.match_id = m.id)
        + (select count(*)::integer from public.match_reservations mr where mr.match_id = m.id)
      ) > new.capacity
  ) then
    raise exception 'facility_capacity_below_active_match';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_named_match_capacity() from public, anon, authenticated;

drop trigger if exists pitches_named_match_capacity_guard on public.pitches;
create trigger pitches_named_match_capacity_guard
before update of capacity on public.pitches
for each row
when (new.capacity < old.capacity)
execute function private.enforce_named_match_capacity();

commit;
