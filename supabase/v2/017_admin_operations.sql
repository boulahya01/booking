-- UNEEM V2 audited admin booking and facility operations.
-- Apply after 016_match_lifecycle_integrity.sql.
--
-- Admin clients must not mutate bookings or facilities directly. These narrow
-- security-definer RPCs own authorization, validation and audit history.

begin;

-- Facilities stay readable to authenticated students, but all client-side
-- mutations are closed. Admin writes go through the audited RPCs below.
revoke insert, update, delete on public.pitches from authenticated;
grant select on public.pitches to authenticated;

create or replace function public.admin_list_bookings(
  p_query text default null,
  p_pitch_id uuid default null,
  p_lifecycle text default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_limit integer default 30,
  p_offset integer default 0
)
returns table(
  booking_id uuid,
  user_id uuid,
  pitch_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  booking_status text,
  lifecycle_status text,
  created_at timestamptz,
  full_name text,
  student_id text,
  email text,
  pitch_name text,
  pitch_location text,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public, private, auth, pg_temp
as $$
declare
  v_query text := nullif(lower(btrim(coalesce(p_query, ''))), '');
  v_limit integer := least(greatest(coalesce(p_limit, 30), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if not private.is_admin() then
    raise exception 'admin_required';
  end if;

  if p_lifecycle is not null and p_lifecycle not in ('upcoming', 'in_progress', 'completed', 'cancelled') then
    raise exception 'invalid_booking_lifecycle';
  end if;

  return query
  with scoped as (
    select
      b.id,
      b.user_id,
      b.pitch_id,
      b.starts_at,
      b.ends_at,
      b.status,
      case
        when b.status = 'cancelled' then 'cancelled'
        when b.ends_at <= now() then 'completed'
        when b.starts_at <= now() then 'in_progress'
        else 'upcoming'
      end as lifecycle,
      b.created_at,
      p.full_name,
      p.student_id,
      u.email,
      f.name as facility_name,
      f.location as facility_location
    from public.bookings b
    join public.profiles p on p.id = b.user_id
    join auth.users u on u.id = b.user_id
    join public.pitches f on f.id = b.pitch_id
    where (p_pitch_id is null or b.pitch_id = p_pitch_id)
      and (p_from is null or b.starts_at >= p_from)
      and (p_to is null or b.starts_at < p_to)
      and (
        v_query is null
        or lower(p.full_name) like '%' || v_query || '%'
        or lower(coalesce(p.student_id, '')) like '%' || v_query || '%'
        or lower(coalesce(u.email, '')) like '%' || v_query || '%'
        or lower(f.name) like '%' || v_query || '%'
      )
  ), filtered as (
    select *
    from scoped s
    where p_lifecycle is null or s.lifecycle = p_lifecycle
  )
  select
    s.id,
    s.user_id,
    s.pitch_id,
    s.starts_at,
    s.ends_at,
    s.status,
    s.lifecycle,
    s.created_at,
    s.full_name,
    s.student_id,
    s.email,
    s.facility_name,
    s.facility_location,
    count(*) over ()::bigint
  from filtered s
  order by s.starts_at desc
  limit v_limit
  offset v_offset;
end;
$$;

create or replace function public.admin_cancel_booking(
  p_booking_id uuid,
  p_reason_code text
)
returns public.bookings
language plpgsql
security definer
set search_path = public, private, auth, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_result public.bookings%rowtype;
begin
  if not private.is_admin() then
    raise exception 'admin_required';
  end if;

  if p_reason_code not in ('maintenance', 'safety', 'scheduling_error', 'university_event', 'policy', 'other') then
    raise exception 'invalid_admin_booking_cancel_reason';
  end if;

  select * into v_booking
  from public.bookings
  where id = p_booking_id
  for update;

  if not found then
    raise exception 'booking_not_found';
  end if;
  if v_booking.status = 'cancelled' then
    raise exception 'booking_already_cancelled';
  end if;
  if v_booking.ends_at <= now() then
    raise exception 'booking_already_finished';
  end if;

  update public.bookings
  set status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = v_actor
  where id = p_booking_id
  returning * into v_result;

  insert into public.admin_audit_log (
    actor_id, action, target_type, target_id, reason_code, previous_state, new_state
  ) values (
    v_actor,
    'booking_cancelled',
    'booking',
    p_booking_id,
    p_reason_code,
    jsonb_build_object(
      'status', v_booking.status,
      'starts_at', v_booking.starts_at,
      'ends_at', v_booking.ends_at,
      'pitch_id', v_booking.pitch_id,
      'user_id', v_booking.user_id
    ),
    jsonb_build_object(
      'status', 'cancelled',
      'capability', 'booking',
      'cancelled_at', v_result.cancelled_at,
      'cancelled_by', v_actor
    )
  );

  return v_result;
end;
$$;

create or replace function public.admin_save_pitch(
  p_pitch_id uuid,
  p_name text,
  p_location text,
  p_sport_type text,
  p_capacity integer,
  p_open_time time,
  p_close_time time,
  p_slot_duration_minutes integer,
  p_booking_window_hours integer,
  p_booking_frequency_enabled boolean,
  p_booking_frequency_days integer,
  p_cancellation_cutoff_minutes integer,
  p_is_active boolean,
  p_sort_order integer,
  p_timezone text default 'Africa/Casablanca'
)
returns public.pitches
language plpgsql
security definer
set search_path = public, private, auth, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_previous public.pitches%rowtype;
  v_result public.pitches%rowtype;
  v_name text := btrim(coalesce(p_name, ''));
  v_location text := btrim(coalesce(p_location, ''));
  v_sport text := nullif(btrim(coalesce(p_sport_type, '')), '');
  v_timezone text := btrim(coalesce(p_timezone, 'Africa/Casablanca'));
begin
  if not private.is_admin() then
    raise exception 'admin_required';
  end if;

  if v_name = '' or char_length(v_name) > 120 then raise exception 'invalid_facility_name'; end if;
  if v_location = '' or char_length(v_location) > 180 then raise exception 'invalid_facility_location'; end if;
  if p_capacity is null or p_capacity < 1 or p_capacity > 200 then raise exception 'invalid_facility_capacity'; end if;
  if p_open_time is null or p_close_time is null or p_close_time <= p_open_time then raise exception 'invalid_facility_hours'; end if;
  if p_slot_duration_minutes not between 15 and 240 then raise exception 'invalid_slot_duration'; end if;
  if p_booking_window_hours not between 1 and 720 then raise exception 'invalid_booking_window'; end if;
  if p_booking_frequency_days not between 1 and 365 then raise exception 'invalid_booking_frequency'; end if;
  if p_cancellation_cutoff_minutes not between 0 and 1440 then raise exception 'invalid_cancellation_cutoff'; end if;
  if v_timezone = '' then raise exception 'invalid_timezone'; end if;

  if p_pitch_id is null then
    insert into public.pitches (
      name, location, sport_type, capacity, timezone, open_time, close_time,
      slot_duration_minutes, booking_window_hours, booking_frequency_enabled,
      booking_frequency_days, cancellation_cutoff_minutes, is_active, sort_order
    ) values (
      v_name, v_location, v_sport, p_capacity, v_timezone, p_open_time, p_close_time,
      p_slot_duration_minutes, p_booking_window_hours, coalesce(p_booking_frequency_enabled, false),
      p_booking_frequency_days, p_cancellation_cutoff_minutes, coalesce(p_is_active, true), coalesce(p_sort_order, 0)
    )
    returning * into v_result;

    insert into public.admin_audit_log (
      actor_id, action, target_type, target_id, new_state
    ) values (
      v_actor, 'facility_created', 'facility', v_result.id,
      to_jsonb(v_result) || jsonb_build_object('capability', 'facility_management')
    );
  else
    select * into v_previous
    from public.pitches
    where id = p_pitch_id
    for update;

    if not found then raise exception 'facility_not_found'; end if;

    update public.pitches
    set name = v_name,
        location = v_location,
        sport_type = v_sport,
        capacity = p_capacity,
        timezone = v_timezone,
        open_time = p_open_time,
        close_time = p_close_time,
        slot_duration_minutes = p_slot_duration_minutes,
        booking_window_hours = p_booking_window_hours,
        booking_frequency_enabled = coalesce(p_booking_frequency_enabled, false),
        booking_frequency_days = p_booking_frequency_days,
        cancellation_cutoff_minutes = p_cancellation_cutoff_minutes,
        is_active = coalesce(p_is_active, true),
        sort_order = coalesce(p_sort_order, 0)
    where id = p_pitch_id
    returning * into v_result;

    insert into public.admin_audit_log (
      actor_id, action, target_type, target_id, previous_state, new_state
    ) values (
      v_actor, 'facility_updated', 'facility', p_pitch_id,
      to_jsonb(v_previous),
      to_jsonb(v_result) || jsonb_build_object('capability', 'facility_management')
    );
  end if;

  return v_result;
end;
$$;

create or replace function public.admin_archive_pitch(
  p_pitch_id uuid,
  p_reason_code text
)
returns public.pitches
language plpgsql
security definer
set search_path = public, private, auth, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_previous public.pitches%rowtype;
  v_result public.pitches%rowtype;
begin
  if not private.is_admin() then
    raise exception 'admin_required';
  end if;
  if p_reason_code not in ('maintenance', 'retired', 'duplicate', 'other') then
    raise exception 'invalid_facility_archive_reason';
  end if;

  select * into v_previous
  from public.pitches
  where id = p_pitch_id
  for update;

  if not found then raise exception 'facility_not_found'; end if;
  if not v_previous.is_active then raise exception 'facility_already_inactive'; end if;

  update public.pitches
  set is_active = false
  where id = p_pitch_id
  returning * into v_result;

  insert into public.admin_audit_log (
    actor_id, action, target_type, target_id, reason_code, previous_state, new_state
  ) values (
    v_actor, 'facility_archived', 'facility', p_pitch_id, p_reason_code,
    to_jsonb(v_previous),
    to_jsonb(v_result) || jsonb_build_object('capability', 'facility_management')
  );

  return v_result;
end;
$$;

revoke all on function public.admin_list_bookings(text, uuid, text, timestamptz, timestamptz, integer, integer) from public;
revoke all on function public.admin_cancel_booking(uuid, text) from public;
revoke all on function public.admin_save_pitch(uuid, text, text, text, integer, time, time, integer, integer, boolean, integer, integer, boolean, integer, text) from public;
revoke all on function public.admin_archive_pitch(uuid, text) from public;

grant execute on function public.admin_list_bookings(text, uuid, text, timestamptz, timestamptz, integer, integer) to authenticated;
grant execute on function public.admin_cancel_booking(uuid, text) to authenticated;
grant execute on function public.admin_save_pitch(uuid, text, text, text, integer, time, time, integer, integer, boolean, integer, integer, boolean, integer, text) to authenticated;
grant execute on function public.admin_archive_pitch(uuid, text) to authenticated;

commit;
