-- Keep match visibility mutations inside the authoritative booking lifecycle.
-- Cancellation locks the booking and then updates its match through the lifecycle
-- trigger, so use the same booking -> match lock order to avoid races/deadlocks.

create or replace function public.set_match_visibility(
  p_match_id uuid,
  p_visibility text
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
begin
  perform private.require_sports_access(v_uid);

  if p_visibility not in ('private', 'open') then
    raise exception 'invalid_match_visibility';
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

  if p_visibility = 'private' and exists (
    select 1
    from public.match_participants mp
    where mp.match_id = p_match_id
  ) then
    raise exception 'match_has_public_players';
  end if;

  update public.matches
  set visibility = p_visibility,
      updated_at = now()
  where id = p_match_id
  returning * into v_match;

  return v_match;
end;
$function$;

revoke all on function public.set_match_visibility(uuid, text) from public, anon;
grant execute on function public.set_match_visibility(uuid, text) to authenticated;
