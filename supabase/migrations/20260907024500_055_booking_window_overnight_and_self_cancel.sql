-- Make the student booking model match the product rules:
-- - only starts within the next 24 hours are bookable;
-- - facilities may operate across midnight (for example 08:00 -> 01:00);
-- - admins using the normal student UI may cancel their own bookings, while
--   administrative cancellation of somebody else's booking still requires the
--   audited admin_cancel_booking() RPC.

begin;

alter table public.pitches
  drop constraint if exists pitches_same_day_hours;

alter table public.pitches
  drop constraint if exists pitches_distinct_hours;

alter table public.pitches
  add constraint pitches_distinct_hours check (close_time <> open_time);

create or replace function public.get_pitch_availability(
  p_pitch_id uuid
)
returns table (
  booking_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  timezone text,
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
  v_local_start timestamp;
  v_start_date date;
  v_end_date date;
  v_step interval;
  v_overnight boolean;
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

  v_window_end := v_window_start + make_interval(hours => least(coalesce(v_pitch.booking_window_hours, 24), 24));
  v_local_start := v_window_start at time zone v_pitch.timezone;
  v_overnight := v_pitch.close_time < v_pitch.open_time;
  v_start_date := v_local_start::date;

  -- When it is after midnight but before an overnight facility closes, the
  -- current operating day is the previous calendar date.
  if v_overnight and v_local_start::time < v_pitch.close_time then
    v_start_date := v_start_date - 1;
  end if;

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
      (
        d.local_day::timestamp
        + v_pitch.close_time
        + case when v_overnight then interval '1 day' else interval '0 day' end
      ) at time zone v_pitch.timezone - v_step,
      v_step
    ) gs
    where gs >= v_window_start
      and gs < v_window_end
  )
  select
    case when b.user_id = auth.uid() then b.id else null end as booking_id,
    g.generated_start,
    g.generated_end,
    v_pitch.timezone,
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
   and b.user_id = auth.uid()
  order by g.generated_start;
end;
$$;

create or replace function public.get_pitch_availability(
  p_pitch_id uuid,
  p_local_date date
)
returns table (
  starts_at timestamptz,
  ends_at timestamptz,
  is_available boolean,
  booker_name text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_pitch public.pitches%rowtype;
  v_open timestamptz;
  v_close timestamptz;
  v_step interval;
  v_overnight boolean;
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

  v_step := make_interval(mins => v_pitch.slot_duration_minutes);
  v_overnight := v_pitch.close_time < v_pitch.open_time;
  v_open := (p_local_date::timestamp + v_pitch.open_time) at time zone v_pitch.timezone;
  v_close := (
    p_local_date::timestamp
    + v_pitch.close_time
    + case when v_overnight then interval '1 day' else interval '0 day' end
  ) at time zone v_pitch.timezone;

  return query
  with generated as (
    select gs as generated_start, gs + v_step as generated_end
    from generate_series(v_open, v_close - v_step, v_step) gs
    where gs >= now()
      and gs < now() + make_interval(hours => least(coalesce(v_pitch.booking_window_hours, 24), 24))
  )
  select
    g.generated_start,
    g.generated_end,
    b.id is null as is_available,
    p.full_name as booker_name
  from generated g
  left join public.bookings b
    on b.pitch_id = p_pitch_id
   and b.status = 'scheduled'
   and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(g.generated_start, g.generated_end, '[)')
  left join public.profiles p
    on p.id = b.user_id
   and b.user_id = auth.uid()
  order by g.generated_start;
end;
$$;

create or replace function public.create_booking(
  p_pitch_id uuid,
  p_starts_at timestamp with time zone
)
returns public.bookings
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_pitch public.pitches%rowtype;
  v_duration interval;
  v_ends_at timestamptz;
  v_local_start timestamp;
  v_service_date date;
  v_open timestamptz;
  v_close timestamptz;
  v_offset_seconds bigint;
  v_booking public.bookings;
  v_overnight boolean;
begin
  if v_user_id is null then
    raise exception 'authentication_required';
  end if;

  if p_starts_at is null then
    raise exception 'invalid_slot';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  select *
  into v_profile
  from public.profiles p
  where p.id = v_user_id;

  if not found or v_profile.status <> 'approved' then
    raise exception 'account_not_approved';
  end if;

  if exists (
    select 1
    from public.bookings b
    where b.user_id = v_user_id
      and b.status = 'scheduled'
      and b.ends_at > now()
  ) then
    raise exception 'active_booking_exists';
  end if;

  select *
  into v_pitch
  from public.pitches p
  where p.id = p_pitch_id
    and p.is_active = true
  for share;

  if not found then
    raise exception 'pitch_not_found';
  end if;

  v_duration := make_interval(mins => v_pitch.slot_duration_minutes);
  v_ends_at := p_starts_at + v_duration;

  if p_starts_at < now() then
    raise exception 'slot_in_past';
  end if;

  if p_starts_at >= now() + make_interval(hours => least(coalesce(v_pitch.booking_window_hours, 24), 24)) then
    raise exception 'outside_booking_window';
  end if;

  v_local_start := p_starts_at at time zone v_pitch.timezone;
  v_service_date := v_local_start::date;
  v_overnight := v_pitch.close_time < v_pitch.open_time;

  if v_overnight and v_local_start::time < v_pitch.close_time then
    v_service_date := v_service_date - 1;
  end if;

  v_open := (v_service_date::timestamp + v_pitch.open_time) at time zone v_pitch.timezone;
  v_close := (
    v_service_date::timestamp
    + v_pitch.close_time
    + case when v_overnight then interval '1 day' else interval '0 day' end
  ) at time zone v_pitch.timezone;

  if p_starts_at < v_open or v_ends_at > v_close then
    raise exception 'invalid_slot';
  end if;

  v_offset_seconds := extract(epoch from (p_starts_at - v_open))::bigint;
  if mod(v_offset_seconds, (v_pitch.slot_duration_minutes * 60)::bigint) <> 0 then
    raise exception 'invalid_slot';
  end if;

  if v_pitch.booking_frequency_enabled and exists (
    select 1
    from public.bookings b
    where b.user_id = v_user_id
      and b.pitch_id = p_pitch_id
      and b.status = 'scheduled'
      and b.starts_at >= p_starts_at - make_interval(days => v_pitch.booking_frequency_days)
      and b.starts_at < p_starts_at + make_interval(days => v_pitch.booking_frequency_days)
  ) then
    raise exception 'booking_frequency_limited';
  end if;

  begin
    insert into public.bookings(user_id, pitch_id, starts_at, ends_at, status)
    values (v_user_id, p_pitch_id, p_starts_at, v_ends_at, 'scheduled')
    returning * into v_booking;
  exception
    when exclusion_violation then
      raise exception 'slot_unavailable';
  end;

  return v_booking;
end;
$function$;

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

  update public.bookings
  set status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = v_user_id
  where id = p_booking_id
  returning * into v_booking;

  return v_booking;
end;
$$;

create or replace function public.admin_save_pitch(
  p_pitch_id uuid,
  p_name text,
  p_location text,
  p_sport_type text,
  p_capacity integer,
  p_open_time time without time zone,
  p_close_time time without time zone,
  p_slot_duration_minutes integer,
  p_booking_window_hours integer,
  p_booking_frequency_enabled boolean,
  p_booking_frequency_days integer,
  p_cancellation_cutoff_minutes integer,
  p_is_active boolean,
  p_sort_order integer,
  p_timezone text default 'Africa/Casablanca'::text
)
returns public.pitches
language plpgsql
security definer
set search_path to 'public', 'private', 'auth', 'pg_temp'
as $function$
declare
  v_actor uuid := auth.uid();
  v_previous public.pitches%rowtype;
  v_result public.pitches%rowtype;
  v_name text := btrim(coalesce(p_name, ''));
  v_location text := btrim(coalesce(p_location, ''));
  v_sport text := nullif(btrim(coalesce(p_sport_type, '')), '');
  v_timezone_input text := btrim(coalesce(p_timezone, 'Africa/Casablanca'));
  v_timezone text;
  v_effective_window integer;
begin
  if not private.is_admin() then raise exception 'admin_required'; end if;
  if v_name = '' or char_length(v_name) > 120 then raise exception 'invalid_facility_name'; end if;
  if v_location = '' or char_length(v_location) > 180 then raise exception 'invalid_facility_location'; end if;
  if p_capacity is null or p_capacity < 1 or p_capacity > 200 then raise exception 'invalid_facility_capacity'; end if;
  if p_open_time is null or p_close_time is null or p_close_time = p_open_time then raise exception 'invalid_facility_hours'; end if;
  if p_slot_duration_minutes not between 15 and 240 then raise exception 'invalid_slot_duration'; end if;
  if p_booking_window_hours not between 1 and 720 then raise exception 'invalid_booking_window'; end if;
  if p_booking_frequency_days not between 1 and 365 then raise exception 'invalid_booking_frequency'; end if;
  if p_cancellation_cutoff_minutes not between 0 and 1440 then raise exception 'invalid_cancellation_cutoff'; end if;

  -- The product exposes at most the next 24 hours. Smaller admin windows remain
  -- useful, while old values such as 168 are normalized on the next save.
  v_effective_window := least(p_booking_window_hours, 24);

  select z.name
  into v_timezone
  from pg_catalog.pg_timezone_names z
  where lower(z.name) = lower(v_timezone_input)
  limit 1;

  if v_timezone is null then raise exception 'invalid_timezone'; end if;

  if p_pitch_id is null then
    insert into public.pitches(
      name, location, sport_type, capacity, timezone, open_time, close_time,
      slot_duration_minutes, booking_window_hours, booking_frequency_enabled,
      booking_frequency_days, cancellation_cutoff_minutes, is_active, sort_order
    ) values (
      v_name, v_location, v_sport, p_capacity, v_timezone, p_open_time, p_close_time,
      p_slot_duration_minutes, v_effective_window, coalesce(p_booking_frequency_enabled, false),
      p_booking_frequency_days, p_cancellation_cutoff_minutes, coalesce(p_is_active, true),
      coalesce(p_sort_order, 0)
    ) returning * into v_result;

    insert into public.admin_audit_log(actor_id, action, target_type, target_id, new_state)
    values (
      v_actor, 'facility_created', 'facility', v_result.id,
      to_jsonb(v_result) || jsonb_build_object('capability', 'facility_management')
    );
  else
    select *
    into v_previous
    from public.pitches
    where id = p_pitch_id
    for update;

    if not found then raise exception 'facility_not_found'; end if;

    if v_previous.is_active and not coalesce(p_is_active, true) then
      raise exception 'facility_archive_requires_reason';
    end if;

    if v_timezone <> v_previous.timezone
      or p_open_time <> v_previous.open_time
      or p_close_time <> v_previous.close_time
    then
      if exists (
        select 1
        from public.bookings b
        where b.pitch_id = p_pitch_id
          and b.status = 'scheduled'
          and b.ends_at > now()
          and (
            b.starts_at < (
              (
                (
                  case
                    when p_close_time < p_open_time
                      and (b.starts_at at time zone v_timezone)::time < p_close_time
                    then ((b.starts_at at time zone v_timezone)::date - 1)::timestamp
                    else (b.starts_at at time zone v_timezone)::date::timestamp
                  end
                ) + p_open_time
              ) at time zone v_timezone
            )
            or b.ends_at > (
              (
                (
                  case
                    when p_close_time < p_open_time
                      and (b.starts_at at time zone v_timezone)::time < p_close_time
                    then ((b.starts_at at time zone v_timezone)::date - 1)::timestamp
                    else (b.starts_at at time zone v_timezone)::date::timestamp
                  end
                )
                + p_close_time
                + case when p_close_time < p_open_time then interval '1 day' else interval '0 day' end
              ) at time zone v_timezone
            )
          )
      ) then
        raise exception 'facility_hours_conflict_with_scheduled_booking';
      end if;
    end if;

    if p_capacity < v_previous.capacity then
      perform 1
      from public.bookings b
      where b.pitch_id = p_pitch_id
        and b.status = 'scheduled'
        and b.starts_at > now()
      order by b.id
      for update;

      perform 1
      from public.matches m
      join public.bookings b on b.id = m.booking_id
      where b.pitch_id = p_pitch_id
        and b.status = 'scheduled'
        and b.starts_at > now()
        and m.status = 'active'
      order by m.id
      for update of m;

      if exists (
        select 1
        from public.matches m
        join public.bookings b on b.id = m.booking_id
        where b.pitch_id = p_pitch_id
          and b.status = 'scheduled'
          and b.starts_at > now()
          and m.status = 'active'
          and (
            1
            + m.reserved_spots
            + (select count(*)::integer from public.match_participants mp where mp.match_id = m.id)
          ) > p_capacity
      ) then
        raise exception 'facility_capacity_below_active_match';
      end if;
    end if;

    update public.pitches
    set name = v_name,
        location = v_location,
        sport_type = v_sport,
        capacity = p_capacity,
        timezone = v_timezone,
        open_time = p_open_time,
        close_time = p_close_time,
        slot_duration_minutes = p_slot_duration_minutes,
        booking_window_hours = v_effective_window,
        booking_frequency_enabled = coalesce(p_booking_frequency_enabled, false),
        booking_frequency_days = p_booking_frequency_days,
        cancellation_cutoff_minutes = p_cancellation_cutoff_minutes,
        is_active = coalesce(p_is_active, true),
        sort_order = coalesce(p_sort_order, 0)
    where id = p_pitch_id
    returning * into v_result;

    insert into public.admin_audit_log(actor_id, action, target_type, target_id, previous_state, new_state)
    values (
      v_actor, 'facility_updated', 'facility', p_pitch_id,
      to_jsonb(v_previous),
      to_jsonb(v_result) || jsonb_build_object('capability', 'facility_management')
    );
  end if;

  return v_result;
end;
$function$;

revoke all on function public.get_pitch_availability(uuid) from public, anon;
grant execute on function public.get_pitch_availability(uuid) to authenticated;
revoke all on function public.get_pitch_availability(uuid, date) from public, anon;
grant execute on function public.get_pitch_availability(uuid, date) to authenticated;
revoke all on function public.create_booking(uuid, timestamptz) from public, anon;
grant execute on function public.create_booking(uuid, timestamptz) to authenticated;
revoke all on function public.cancel_booking(uuid) from public, anon;
grant execute on function public.cancel_booking(uuid) to authenticated;

commit;
