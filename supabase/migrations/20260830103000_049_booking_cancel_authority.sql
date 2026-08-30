-- UNEEM V2 booking cancellation authority.
-- Keep student self-service cancellation separate from reasoned admin cancellation.

begin;

create or replace function public.cancel_booking(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_cutoff_minutes integer;
begin
  if v_user_id is null then
    raise exception 'authentication_required';
  end if;

  -- Administrative cancellations must use admin_cancel_booking(), which requires
  -- a structured reason and writes the corresponding admin audit record.
  if private.is_admin() then
    raise exception 'admin_booking_cancel_requires_reason';
  end if;

  select b.*
  into v_booking
  from public.bookings b
  where b.id = p_booking_id
  for update;

  if not found then
    raise exception 'booking_not_found';
  end if;

  if v_booking.user_id <> v_user_id then
    raise exception 'booking_not_owned';
  end if;

  if v_booking.status <> 'scheduled' then
    raise exception 'booking_not_cancellable';
  end if;

  select p.cancellation_cutoff_minutes
  into v_cutoff_minutes
  from public.pitches p
  where p.id = v_booking.pitch_id;

  if v_booking.starts_at <= now() + make_interval(mins => v_cutoff_minutes) then
    raise exception 'cancellation_window_closed';
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
