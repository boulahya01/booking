-- Keep facility archival consistent with outstanding booking commitments.
--
-- create_booking() takes a shared lock on the pitch before validating and
-- inserting a booking. admin_archive_pitch() already takes an exclusive lock on
-- that same row, so checking scheduled bookings while holding the pitch lock
-- serializes archival against concurrent booking creation without changing the
-- existing authority boundary.

create or replace function public.admin_archive_pitch(
  p_pitch_id uuid,
  p_reason_code text
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
begin
  if not private.is_admin() then
    raise exception 'admin_required';
  end if;

  if p_reason_code not in ('maintenance', 'retired', 'duplicate', 'other') then
    raise exception 'invalid_facility_archive_reason';
  end if;

  select *
  into v_previous
  from public.pitches
  where id = p_pitch_id
  for update;

  if not found then
    raise exception 'facility_not_found';
  end if;

  if not v_previous.is_active then
    raise exception 'facility_already_inactive';
  end if;

  if exists (
    select 1
    from public.bookings b
    where b.pitch_id = p_pitch_id
      and b.status = 'scheduled'
      and b.ends_at > now()
  ) then
    raise exception 'facility_has_scheduled_bookings';
  end if;

  update public.pitches
  set is_active = false
  where id = p_pitch_id
  returning * into v_result;

  insert into public.admin_audit_log(
    actor_id,
    action,
    target_type,
    target_id,
    reason_code,
    previous_state,
    new_state
  ) values (
    v_actor,
    'facility_archived',
    'facility',
    p_pitch_id,
    p_reason_code,
    to_jsonb(v_previous),
    to_jsonb(v_result) || jsonb_build_object('capability', 'facility_management')
  );

  return v_result;
end;
$function$;
