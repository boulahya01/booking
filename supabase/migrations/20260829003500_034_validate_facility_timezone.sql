-- Keep facility timezone writes authoritative and canonical.
-- Invalid timezone identifiers would otherwise be persisted by admin_save_pitch()
-- and later make availability / booking RPCs fail when they use AT TIME ZONE.

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
begin
  if not private.is_admin() then raise exception 'admin_required'; end if;
  if v_name = '' or char_length(v_name) > 120 then raise exception 'invalid_facility_name'; end if;
  if v_location = '' or char_length(v_location) > 180 then raise exception 'invalid_facility_location'; end if;
  if p_capacity is null or p_capacity < 1 or p_capacity > 200 then raise exception 'invalid_facility_capacity'; end if;
  if p_open_time is null or p_close_time is null or p_close_time <= p_open_time then raise exception 'invalid_facility_hours'; end if;
  if p_slot_duration_minutes not between 15 and 240 then raise exception 'invalid_slot_duration'; end if;
  if p_booking_window_hours not between 1 and 720 then raise exception 'invalid_booking_window'; end if;
  if p_booking_frequency_days not between 1 and 365 then raise exception 'invalid_booking_frequency'; end if;
  if p_cancellation_cutoff_minutes not between 0 and 1440 then raise exception 'invalid_cancellation_cutoff'; end if;

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
      p_slot_duration_minutes, p_booking_window_hours, coalesce(p_booking_frequency_enabled, false),
      p_booking_frequency_days, p_cancellation_cutoff_minutes, coalesce(p_is_active, true),
      coalesce(p_sort_order, 0)
    ) returning * into v_result;

    insert into public.admin_audit_log(actor_id, action, target_type, target_id, new_state)
    values (
      v_actor, 'facility_created', 'facility', v_result.id,
      to_jsonb(v_result) || jsonb_build_object('capability', 'facility_management')
    );
  else
    select * into v_previous from public.pitches where id = p_pitch_id for update;
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

revoke all on function public.admin_save_pitch(uuid,text,text,text,integer,time without time zone,time without time zone,integer,integer,boolean,integer,integer,boolean,integer,text) from public, anon;
grant execute on function public.admin_save_pitch(uuid,text,text,text,integer,time without time zone,time without time zone,integer,integer,boolean,integer,integer,boolean,integer,text) to authenticated;
