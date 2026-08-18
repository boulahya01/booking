-- UNEEM V2 authentication lifecycle contract.
-- Apply after 020_first_admin_bootstrap.sql.
--
-- Supabase Auth owns credentials, email confirmation and recovery sessions.
-- PostgreSQL must still enforce that an application session belongs to a
-- confirmed email before sports/admin capabilities can be exercised. Profile
-- status alone is never enough authority.

begin;

create or replace function private.is_email_confirmed(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = auth, pg_temp
as $$
  select exists (
    select 1
    from auth.users u
    where u.id = p_user_id
      and u.email_confirmed_at is not null
  );
$$;

revoke all on function private.is_email_confirmed(uuid) from public, anon, authenticated, service_role;

create or replace function private.has_app_access()
returns boolean
language sql
stable
security definer
set search_path = public, private, auth, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.status = 'approved'
      and private.is_email_confirmed(p.id)
  );
$$;

revoke all on function private.has_app_access() from public, anon;
grant execute on function private.has_app_access() to authenticated;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, private, auth, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.status = 'approved'
      and private.is_email_confirmed(p.id)
  );
$$;

revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

-- Match reads/mutations all call this helper, so one confirmation-aware rule
-- protects create/open/join/leave/roster/discovery paths consistently.
create or replace function private.require_sports_access(p_user_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public, private, auth, pg_temp
as $$
begin
  if p_user_id is null or auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  if p_user_id <> auth.uid() or not private.has_app_access() then
    raise exception 'account_not_approved';
  end if;
end;
$$;

revoke all on function private.require_sports_access(uuid) from public, anon, authenticated, service_role;

-- Keep the final username-aware signup trigger, but make the initial access
-- state robust even if Auth confirmation settings are changed accidentally.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_student_id text;
  v_full_name text;
  v_username text;
  v_email text := lower(btrim(coalesce(new.email, '')));
  v_email_kind text;
  v_status text;
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

  v_username := lower(btrim(coalesce(new.raw_user_meta_data ->> 'username', '')));
  if v_username !~ '^[a-z0-9_]{3,24}$' then
    raise exception 'invalid_username';
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

  v_status := case
    when v_email_kind = 'academic' and new.email_confirmed_at is not null then 'approved'
    else 'pending'
  end;

  insert into public.profiles (
    id,
    student_id,
    full_name,
    username,
    role,
    status,
    email_kind,
    identity_status
  ) values (
    new.id,
    v_student_id,
    v_full_name,
    v_username,
    'student',
    v_status,
    v_email_kind,
    'required'
  );

  return new;
exception
  when unique_violation then
    raise exception 'registration_conflict';
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated, service_role;

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

revoke all on function private.handle_email_confirmation() from public, anon, authenticated, service_role;

create or replace function public.get_my_account_state()
returns table (
  user_id uuid,
  role text,
  access_status text,
  email_kind text,
  identity_status text,
  student_id text,
  restriction_reason text,
  can_use_sports boolean,
  needs_identity_action boolean
)
language sql
stable
security definer
set search_path = public, private, auth, pg_temp
as $$
  select
    p.id,
    p.role,
    p.status,
    p.email_kind,
    p.identity_status,
    p.student_id,
    case
      when not private.is_email_confirmed(p.id) then 'email_confirmation_required'
      when p.status = 'suspended' then p.access_restriction_reason
      else p.restriction_reason
    end,
    (p.status = 'approved' and private.is_email_confirmed(p.id)),
    (p.identity_status in ('required', 'rejected', 'conflict'))
  from public.profiles p
  where p.id = auth.uid();
$$;

revoke all on function public.get_my_account_state() from public, anon;
grant execute on function public.get_my_account_state() to authenticated;

create or replace function public.get_my_session_context()
returns table(
  user_id uuid,
  student_id text,
  full_name text,
  username text,
  role text,
  access_status text,
  email_kind text,
  identity_status text,
  restriction_reason text,
  verified_student_id_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  can_use_sports boolean,
  needs_identity_action boolean
)
language sql
stable
security definer
set search_path = public, private, auth, pg_temp
as $$
  select
    p.id,
    p.student_id,
    p.full_name,
    p.username,
    p.role,
    p.status,
    p.email_kind,
    p.identity_status,
    case
      when not private.is_email_confirmed(p.id) then 'email_confirmation_required'
      when p.status = 'suspended' then p.access_restriction_reason
      else p.restriction_reason
    end,
    p.verified_student_id_at,
    p.created_at,
    p.updated_at,
    p.status = 'approved' and private.is_email_confirmed(p.id),
    p.identity_status in ('required', 'rejected', 'conflict')
  from public.profiles p
  where p.id = auth.uid();
$$;

revoke all on function public.get_my_session_context() from public, anon;
grant execute on function public.get_my_session_context() to authenticated;

-- Booking creation already validates approved profile state. This trigger adds
-- the credential-side invariant so a recovery session or misconfigured Auth
-- project cannot insert a sports booking for an unconfirmed account.
create or replace function private.enforce_booking_actor_access()
returns trigger
language plpgsql
security definer
set search_path = public, private, auth, pg_temp
as $$
begin
  if auth.uid() is not null and not private.has_app_access() then
    raise exception 'account_not_approved';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_booking_actor_access() from public, anon, authenticated, service_role;

drop trigger if exists bookings_require_confirmed_actor on public.bookings;
create trigger bookings_require_confirmed_actor
before insert on public.bookings
for each row execute function private.enforce_booking_actor_access();

-- Student-card submission also requires a confirmed credential. This closes the
-- edge case where a temporary recovery session exists for an otherwise
-- unconfirmed account.
create or replace function private.enforce_identity_submission_actor()
returns trigger
language plpgsql
security definer
set search_path = public, private, auth, pg_temp
as $$
begin
  if auth.uid() is not null and not private.is_email_confirmed(auth.uid()) then
    raise exception 'email_confirmation_required';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_identity_submission_actor() from public, anon, authenticated, service_role;

drop trigger if exists identity_attempts_require_confirmed_actor on public.identity_verification_attempts;
create trigger identity_attempts_require_confirmed_actor
before insert on public.identity_verification_attempts
for each row execute function private.enforce_identity_submission_actor();

-- First-admin bootstrap stays database-owner-only and now additionally refuses
-- to promote an account whose Supabase email credential has not been confirmed.
create or replace function private.bootstrap_first_admin(p_user_id uuid)
returns public.profiles
language plpgsql
security definer
set search_path = public, private, auth, pg_temp
as $$
declare
  v_previous public.profiles%rowtype;
  v_result public.profiles%rowtype;
begin
  if p_user_id is null then
    raise exception 'bootstrap_user_required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('uneem:first-admin-bootstrap', 0));

  if exists (select 1 from public.profiles p where p.role = 'admin')
     or exists (select 1 from private.admin_bootstrap_log) then
    raise exception 'first_admin_already_exists';
  end if;

  select * into v_previous
  from public.profiles
  where id = p_user_id
  for update;

  if not found then raise exception 'profile_not_found'; end if;
  if v_previous.role <> 'student' then raise exception 'bootstrap_target_not_student'; end if;
  if not private.is_email_confirmed(p_user_id) then raise exception 'email_confirmation_required'; end if;

  update public.profiles
  set role = 'admin',
      status = 'approved',
      access_restriction_reason = null
  where id = p_user_id
  returning * into v_result;

  insert into private.admin_bootstrap_log (
    target_profile_id,
    previous_state,
    new_state
  ) values (
    p_user_id,
    jsonb_build_object(
      'role', v_previous.role,
      'status', v_previous.status,
      'email_kind', v_previous.email_kind,
      'identity_status', v_previous.identity_status
    ),
    jsonb_build_object(
      'role', v_result.role,
      'status', v_result.status,
      'email_kind', v_result.email_kind,
      'identity_status', v_result.identity_status
    )
  );

  return v_result;
end;
$$;

revoke all on function private.bootstrap_first_admin(uuid) from public, anon, authenticated, service_role;

commit;
