-- Serialize match departure with booking cancellation and preserve cancelled-match roster history.
begin;

create or replace function public.leave_open_match(p_match_id uuid)
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

  -- Use the same booking -> match lock order as cancellation and the other
  -- match mutations so departure cannot race the authoritative lifecycle.
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

  if v_match.status <> 'active' then
    raise exception 'match_not_active';
  end if;

  if v_booking.status <> 'scheduled' or v_booking.starts_at <= now() then
    raise exception 'match_started';
  end if;

  delete from public.match_participants
  where match_id = p_match_id
    and user_id = v_uid;

  if not found then
    raise exception 'not_joined';
  end if;
end;
$$;

revoke all on function public.leave_open_match(uuid) from public, anon;
grant execute on function public.leave_open_match(uuid) to authenticated;

commit;
