create or replace function public.update_match_reserved_spots(
  p_match_id uuid,
  p_reserved_spots integer
)
returns public.matches
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
begin
  perform private.require_sports_access(v_uid);

  select m.booking_id
  into v_booking_id
  from public.matches m
  where m.id = p_match_id;

  if not found then
    raise exception 'match_not_found';
  end if;

  -- Booking lifecycle mutations lock the booking first and may then update the
  -- match through bookings_cancel_match. Use the same lock order here so a
  -- concurrent cancellation cannot race this mutation or deadlock with it.
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

  if p_reserved_spots < 0 or 1 + v_joined + p_reserved_spots > v_capacity then
    raise exception 'reserved_spots_exceed_capacity';
  end if;

  update public.matches
  set reserved_spots = p_reserved_spots,
      updated_at = now()
  where id = p_match_id
  returning * into v_match;

  return v_match;
end;
$function$;
