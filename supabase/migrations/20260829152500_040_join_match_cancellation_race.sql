-- Serialize joining an open match with booking cancellation.
--
-- Cancellation locks the booking first and then updates the backing match through
-- the booking lifecycle trigger. Joining previously locked only the match and
-- read the booking without a row lock, so a concurrent cancellation could pass
-- the joiner's lifecycle check and still allow a participant insert before the
-- cancellation finished. Use the established booking -> match lock order.

create or replace function public.join_open_match(p_match_id uuid)
returns public.match_participants
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_booking_id uuid;
  v_booking public.bookings%rowtype;
  v_match public.matches%rowtype;
  v_capacity integer;
  v_joined integer;
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
    from public.match_participants
    where match_id = p_match_id
      and user_id = v_uid
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

  if 1 + v_match.reserved_spots + v_joined >= v_capacity then
    raise exception 'match_full';
  end if;

  insert into public.match_participants(match_id, user_id)
  values (p_match_id, v_uid)
  returning * into v_participant;

  return v_participant;
end;
$function$;

revoke all on function public.join_open_match(uuid) from public, anon;
grant execute on function public.join_open_match(uuid) to authenticated;
