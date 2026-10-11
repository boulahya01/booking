-- Protect self-joined players from organizer cancellation.
-- App-admin cancellation remains governed by its separate RPC.
begin;

create or replace function public.cancel_booking(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_pitch_id uuid;
  v_booking public.bookings%rowtype;
  v_cutoff_minutes integer;
begin
  if auth.uid() is not null and not exists (
    select 1 from public.profiles p where p.id = auth.uid()
      and p.identity_status = 'verified' and private.is_email_confirmed(p.id)
  ) then raise exception 'account_not_approved'; end if;
  if v_user_id is null then
    raise exception 'authentication_required';
  end if;

  select b.pitch_id
  into v_pitch_id
  from public.bookings b
  where b.id = p_booking_id;

  if not found then
    raise exception 'booking_not_found';
  end if;

  select p.cancellation_cutoff_minutes
  into v_cutoff_minutes
  from public.pitches p
  where p.id = v_pitch_id
  for share;

  if not found then
    raise exception 'facility_not_found';
  end if;

  select b.*
  into v_booking
  from public.bookings b
  where b.id = p_booking_id
    and b.pitch_id = v_pitch_id
  for update;

  if not found then
    raise exception 'booking_not_found';
  end if;

  -- This RPC is always self-service, even when the account also has the admin
  -- role. Ownership prevents it from being used to cancel another user's booking.
  if v_booking.user_id <> v_user_id then
    raise exception 'booking_not_owned';
  end if;

  if v_booking.status <> 'scheduled' then
    raise exception 'booking_not_cancellable';
  end if;

  if v_booking.starts_at <= now() + make_interval(mins => v_cutoff_minutes) then
    raise exception 'cancellation_window_closed';
  end if;

  -- join_open_match locks this booking first, so the participant check and
  -- cancellation serialize with joins. Organizer-only cancellation must not
  -- displace players who joined themselves. Reservations remain owner-managed.
  if exists (
    select 1 from public.matches m
    join public.match_participants mp on mp.match_id = m.id
    where m.booking_id = p_booking_id
  ) then
    raise exception 'match_has_public_players';
  end if;

  update public.bookings
  set status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = v_user_id
  where id = p_booking_id
  returning * into v_booking;

  return v_booking;
end;
$$;

revoke all on function public.cancel_booking(uuid) from public, anon;
grant execute on function public.cancel_booking(uuid) to authenticated;

commit;
