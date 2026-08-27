-- Booking V2 security hardening layer.
--
-- Apply after supabase/v2/schema.sql in a disposable/local database.
-- This file remains outside supabase/migrations until the V2 contract is validated.

begin;

-- Central app-access predicate used by read paths that are only available to
-- approved users. Admins are approved profiles too, so one rule covers both.
create or replace function private.has_app_access()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.status = 'approved'
  );
$$;

revoke all on function private.has_app_access() from public, anon;
grant execute on function private.has_app_access() to authenticated;

-- Pending/suspended users can still read their own profile for onboarding and
-- account-state UX, but facility browsing begins only after approval.
drop policy if exists pitches_select on public.pitches;

create policy pitches_select
on public.pitches
for select
to authenticated
using ((select private.has_app_access()));

-- Do not add a permissive "update own profile" policy. That would allow a
-- student to submit protected role/status/student_id columns again. This RPC is
-- intentionally the only self-service mutation path and updates full_name only.
create or replace function public.update_my_profile(
  p_full_name text
)
returns public.profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_full_name text := btrim(coalesce(p_full_name, ''));
  v_profile public.profiles%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication_required';
  end if;

  if char_length(v_full_name) < 2 or char_length(v_full_name) > 120 then
    raise exception 'invalid_full_name';
  end if;

  update public.profiles
  set full_name = v_full_name
  where id = v_user_id
  returning * into v_profile;

  if not found then
    raise exception 'profile_not_found';
  end if;

  return v_profile;
end;
$$;

revoke all on function public.update_my_profile(text) from public, anon;
grant execute on function public.update_my_profile(text) to authenticated;

-- Shared schedule visibility is intentional, including the peer display name,
-- but only approved users should be able to query it.
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
  v_open := (p_local_date::timestamp + v_pitch.open_time) at time zone v_pitch.timezone;
  v_close := (p_local_date::timestamp + v_pitch.close_time) at time zone v_pitch.timezone;

  return query
  with generated as (
    select
      gs as generated_start,
      gs + v_step as generated_end
    from generate_series(v_open, v_close - v_step, v_step) gs
    where gs >= now()
      and gs < now() + make_interval(hours => v_pitch.booking_window_hours)
  )
  select
    g.generated_start,
    g.generated_end,
    b.id is null,
    p.full_name
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

revoke all on function public.get_pitch_availability(uuid, date) from public, anon;
grant execute on function public.get_pitch_availability(uuid, date) to authenticated;

commit;
