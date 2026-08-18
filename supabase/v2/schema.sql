-- UNEEM V2 clean database baseline.
--
-- Fresh-project source of truth. Do not replay historical V1 migrations.
-- Apply the complete V2 stack before accepting real registrations or traffic.

begin;

create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  -- A Student ID claim is private identity data and is not authoritative until
  -- identity_status='verified'. Academic-email accounts may leave it null.
  student_id text,
  full_name text not null,
  role text not null default 'student' check (role in ('student', 'admin')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'suspended')),
  email_kind text not null default 'personal' check (email_kind in ('academic', 'personal')),
  identity_status text not null default 'required'
    check (identity_status in ('required', 'pending', 'verified', 'rejected', 'conflict')),
  restriction_reason text,
  verified_student_id_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_student_id_not_blank check (student_id is null or btrim(student_id) <> ''),
  constraint profiles_full_name_not_blank check (btrim(full_name) <> '')
);

-- Only verified ownership reserves a Student ID globally. Unverified claims may
-- collide until an administrator resolves ownership from private evidence.
create unique index profiles_verified_student_id_unique_idx
  on public.profiles (student_id)
  where identity_status = 'verified' and student_id is not null;

create table public.pitches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text not null,
  sport_type text,
  capacity integer not null default 1 check (capacity > 0),
  timezone text not null default 'Africa/Casablanca',
  open_time time not null default time '08:00',
  close_time time not null default time '22:00',
  slot_duration_minutes integer not null default 60 check (slot_duration_minutes between 15 and 240),
  booking_window_hours integer not null default 24 check (booking_window_hours between 1 and 720),
  booking_frequency_enabled boolean not null default false,
  booking_frequency_days integer not null default 1 check (booking_frequency_days between 1 and 365),
  cancellation_cutoff_minutes integer not null default 60 check (cancellation_cutoff_minutes between 0 and 1440),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pitches_name_not_blank check (btrim(name) <> ''),
  constraint pitches_location_not_blank check (btrim(location) <> ''),
  constraint pitches_same_day_hours check (close_time > open_time)
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  pitch_id uuid not null references public.pitches(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'cancelled')),
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint bookings_positive_duration check (ends_at > starts_at),
  constraint bookings_cancellation_state check (
    (status = 'scheduled' and cancelled_at is null)
    or
    (status = 'cancelled' and cancelled_at is not null)
  ),
  constraint bookings_no_pitch_overlap exclude using gist (
    pitch_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status = 'scheduled')
);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title_en text not null,
  title_ar text not null,
  body_en text not null,
  body_ar text not null,
  published_at timestamptz not null default now(),
  expires_at timestamptz,
  is_active boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint announcements_expiry_after_publish check (expires_at is null or expires_at > published_at)
);

create table public.announcement_dismissals (
  user_id uuid not null references public.profiles(id) on delete cascade,
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  dismissed_at timestamptz not null default now(),
  primary key (user_id, announcement_id)
);

create index bookings_user_starts_idx
  on public.bookings (user_id, starts_at desc);

create index bookings_pitch_starts_scheduled_idx
  on public.bookings (pitch_id, starts_at)
  where status = 'scheduled';

create index pitches_active_sort_idx
  on public.pitches (sort_order, id)
  where is_active = true;

create index announcements_published_idx
  on public.announcements (published_at desc)
  where is_active = true;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger pitches_set_updated_at
before update on public.pitches
for each row execute function private.set_updated_at();

create trigger announcements_set_updated_at
before update on public.announcements
for each row execute function private.set_updated_at();

create or replace function private.is_admin()
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
      and p.role = 'admin'
      and p.status = 'approved'
  );
$$;

revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

-- Baseline signup is already compatible with the academic/personal identity
-- split. Layer 013 later replaces this function to additionally require the
-- public username. The complete stack must be installed before real signup.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_student_id text;
  v_full_name text;
  v_email text := lower(btrim(coalesce(new.email, '')));
  v_email_kind text;
begin
  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'invalid_email';
  end if;

  v_email_kind := case
    when split_part(v_email, '@', 2) = 'usmba.ac.ma' then 'academic'
    else 'personal'
  end;

  v_full_name := btrim(coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  if char_length(v_full_name) < 2 or char_length(v_full_name) > 120 then
    raise exception 'invalid_full_name';
  end if;

  v_student_id := upper(regexp_replace(coalesce(new.raw_user_meta_data ->> 'student_id', ''), '\s+', '', 'g'));
  if v_student_id = '' then
    v_student_id := null;
  elsif v_student_id !~ '^[A-Z][0-9]{9}$' then
    raise exception 'invalid_student_id';
  end if;

  if v_email_kind = 'personal' and v_student_id is null then
    raise exception 'student_id_required_for_personal_email';
  end if;

  insert into public.profiles (
    id, student_id, full_name, role, status, email_kind, identity_status
  ) values (
    new.id, v_student_id, v_full_name, 'student', 'pending', v_email_kind, 'required'
  );

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger auth_user_created_create_profile
after insert on auth.users
for each row execute function private.handle_new_user();

create or replace function private.handle_email_confirmation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    update public.profiles
    set status = case
          when email_kind = 'academic' and status = 'pending' then 'approved'
          else status
        end,
        updated_at = now()
    where id = new.id;
  end if;

  return new;
end;
$$;

revoke all on function private.handle_email_confirmation() from public, anon, authenticated;

create trigger auth_email_confirmed_approve_profile
after update of email_confirmed_at on auth.users
for each row execute function private.handle_email_confirmation();

alter table public.profiles enable row level security;
alter table public.pitches enable row level security;
alter table public.bookings enable row level security;
alter table public.announcements enable row level security;
alter table public.announcement_dismissals enable row level security;

revoke all on public.profiles from anon, authenticated;
revoke all on public.pitches from anon, authenticated;
revoke all on public.bookings from anon, authenticated;
revoke all on public.announcements from anon, authenticated;
revoke all on public.announcement_dismissals from anon, authenticated;

grant select, update on public.profiles to authenticated;

create policy profiles_select
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or (select private.is_admin())
);

create policy profiles_update_admin
on public.profiles
for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

grant select, insert, update, delete on public.pitches to authenticated;

create policy pitches_select
on public.pitches
for select
to authenticated
using (true);

create policy pitches_insert_admin
on public.pitches
for insert
to authenticated
with check ((select private.is_admin()));

create policy pitches_update_admin
on public.pitches
for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy pitches_delete_admin
on public.pitches
for delete
to authenticated
using ((select private.is_admin()));

-- Direct client booking writes are intentionally disabled. RPCs own the mutation path.
grant select on public.bookings to authenticated;

create policy bookings_select
on public.bookings
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select private.is_admin())
);

grant select, insert, update, delete on public.announcements to authenticated;

create policy announcements_select
on public.announcements
for select
to authenticated
using (
  (select private.is_admin())
  or (
    is_active = true
    and published_at <= now()
    and (expires_at is null or expires_at > now())
  )
);

create policy announcements_insert_admin
on public.announcements
for insert
to authenticated
with check ((select private.is_admin()));

create policy announcements_update_admin
on public.announcements
for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy announcements_delete_admin
on public.announcements
for delete
to authenticated
using ((select private.is_admin()));

grant select, insert, delete on public.announcement_dismissals to authenticated;

create policy announcement_dismissals_select
on public.announcement_dismissals
for select
to authenticated
using (user_id = (select auth.uid()));

create policy announcement_dismissals_insert
on public.announcement_dismissals
for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy announcement_dismissals_delete
on public.announcement_dismissals
for delete
to authenticated
using (user_id = (select auth.uid()));

-- Time-based lifecycle is derived, so no completion cron/job is required.
create view public.booking_timeline
with (security_invoker = true)
as
select
  b.*,
  case
    when b.status = 'cancelled' then 'cancelled'
    when b.ends_at <= now() then 'completed'
    when b.starts_at <= now() then 'in_progress'
    else 'upcoming'
  end as lifecycle_status
from public.bookings b;

grant select on public.booking_timeline to authenticated;

-- Peer display names are intentionally visible because shared booking visibility
-- is a product requirement. No extra profile fields are returned here.
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

-- Layer 003 replaces this baseline implementation with the serialized one-active
-- booking invariant. Keeping the baseline operation here makes the schema
-- self-contained while the ordered V2 stack remains the deployable contract.
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

  select * into v_profile
  from public.profiles p
  where p.id = v_user_id;

  if not found or v_profile.status <> 'approved' then
    raise exception 'account_not_approved';
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

create or replace function public.cancel_booking(
  p_booking_id uuid
)
returns public.bookings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_cutoff_minutes integer;
  v_is_admin boolean;
begin
  if v_user_id is null then
    raise exception 'authentication_required';
  end if;

  v_is_admin := private.is_admin();
  select b.*
  into v_booking
  from public.bookings b
  where b.id = p_booking_id
  for update;

  if not found then
    raise exception 'booking_not_found';
  end if;

  select p.cancellation_cutoff_minutes
  into v_cutoff_minutes
  from public.pitches p
  where p.id = v_booking.pitch_id;

  if v_booking.user_id <> v_user_id and not v_is_admin then
    raise exception 'booking_not_owned';
  end if;

  if v_booking.status <> 'scheduled' then
    raise exception 'booking_not_cancellable';
  end if;

  if not v_is_admin
     and v_booking.starts_at <= now() + make_interval(mins => v_cutoff_minutes) then
    raise exception 'cancellation_window_closed';
  end if;

  update public.bookings
  set
    status = 'cancelled',
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
