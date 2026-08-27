-- UNEEM V2 booking guardrails.
--
-- Apply after schema.sql and 002_security_contract.sql.
-- Identity onboarding is intentionally NOT defined in this layer. The complete
-- academic/personal verification contract is owned by layers 005 and 013 and
-- the application must not accept real registrations until the full V2 stack is
-- applied. This file owns only booking invariants.

begin;

create or replace function public.create_booking(
  p_pitch_id uuid,
  p_starts_at timestamptz
)
returns public.bookings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_pitch public.pitches%rowtype;
  v_duration interval;
  v_ends_at timestamptz;
  v_local_date date;
  v_open timestamptz;
  v_close timestamptz;
  v_offset_seconds bigint;
  v_booking public.bookings;
begin
  if v_user_id is null then
    raise exception 'authentication_required';
  end if;

  if p_starts_at is null then
    raise exception 'invalid_slot';
  end if;

  -- Serialize booking attempts per user. Without this lock, the same user can
  -- race requests for different facilities and bypass the one-active rule.
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  select * into v_profile
  from public.profiles p
  where p.id = v_user_id;

  if not found or v_profile.status <> 'approved' then
    raise exception 'account_not_approved';
  end if;

  -- Lifecycle is derived from timestamps. A scheduled row whose end is still
  -- in the future is the one authoritative active/upcoming reservation.
  if exists (
    select 1
    from public.bookings b
    where b.user_id = v_user_id
      and b.status = 'scheduled'
      and b.ends_at > now()
  ) then
    raise exception 'active_booking_exists';
  end if;

  select * into v_pitch
  from public.pitches p
  where p.id = p_pitch_id
    and p.is_active = true;

  if not found then
    raise exception 'pitch_not_found';
  end if;

  v_duration := make_interval(mins => v_pitch.slot_duration_minutes);
  v_ends_at := p_starts_at + v_duration;

  if p_starts_at < now() then
    raise exception 'slot_in_past';
  end if;

  if p_starts_at >= now() + make_interval(hours => v_pitch.booking_window_hours) then
    raise exception 'outside_booking_window';
  end if;

  v_local_date := (p_starts_at at time zone v_pitch.timezone)::date;
  v_open := (v_local_date::timestamp + v_pitch.open_time) at time zone v_pitch.timezone;
  v_close := (v_local_date::timestamp + v_pitch.close_time) at time zone v_pitch.timezone;

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
    insert into public.bookings (user_id, pitch_id, starts_at, ends_at, status)
    values (v_user_id, p_pitch_id, p_starts_at, v_ends_at, 'scheduled')
    returning * into v_booking;
  exception
    when exclusion_violation then
      raise exception 'slot_unavailable';
  end;

  return v_booking;
end;
$$;

revoke all on function public.create_booking(uuid, timestamptz) from public, anon;
grant execute on function public.create_booking(uuid, timestamptz) to authenticated;

commit;
