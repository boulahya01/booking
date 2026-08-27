-- Booking V2 availability window API.
--
-- Adds the application-facing one-argument availability RPC. The earlier
-- date-scoped overload remains available for contract compatibility while this
-- integration slice migrates the frontend.

begin;

create or replace function public.get_pitch_availability(
  p_pitch_id uuid
)
returns table (
  booking_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  is_available boolean,
  booked_by_me boolean,
  booker_name text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_pitch public.pitches%rowtype;
  v_window_start timestamptz := now();
  v_window_end timestamptz;
  v_start_date date;
  v_end_date date;
  v_step interval;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  if not private.has_app_access() then
    raise exception 'account_not_approved';
  end if;

  select * into v_pitch
  from public.pitches p
  where p.id = p_pitch_id
    and p.is_active = true;

  if not found then
    raise exception 'pitch_not_found';
  end if;

  v_window_end := v_window_start + make_interval(hours => v_pitch.booking_window_hours);
  v_start_date := (v_window_start at time zone v_pitch.timezone)::date;
  v_end_date := (v_window_end at time zone v_pitch.timezone)::date;
  v_step := make_interval(mins => v_pitch.slot_duration_minutes);

  return query
  with local_days as (
    select day_value::date as local_day
    from generate_series(v_start_date, v_end_date, interval '1 day') day_value
  ),
  generated as (
    select
      gs as generated_start,
      gs + v_step as generated_end
    from local_days d
    cross join lateral generate_series(
      (d.local_day::timestamp + v_pitch.open_time) at time zone v_pitch.timezone,
      ((d.local_day::timestamp + v_pitch.close_time) at time zone v_pitch.timezone) - v_step,
      v_step
    ) gs
    where gs >= v_window_start
      and gs < v_window_end
  )
  select
    case when b.user_id = auth.uid() then b.id else null end as booking_id,
    g.generated_start,
    g.generated_end,
    b.id is null as is_available,
    coalesce(b.user_id = auth.uid(), false) as booked_by_me,
    p.full_name as booker_name
  from generated g
  left join public.bookings b
    on b.pitch_id = p_pitch_id
   and b.status = 'scheduled'
   and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(g.generated_start, g.generated_end, '[)')
  left join public.profiles p
    on p.id = b.user_id
  order by g.generated_start;
end;
$$;

revoke all on function public.get_pitch_availability(uuid) from public, anon;
grant execute on function public.get_pitch_availability(uuid) to authenticated;

commit;
