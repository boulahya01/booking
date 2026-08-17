-- UNEEM V2 public username identity contract.
-- Apply after 012_support_rate_limit_scope.sql.
--
-- Username is the public student handle used for discovery/invites.
-- It is intentionally separate from private Student ID identity.

begin;

alter table public.profiles
  add column if not exists username text;

alter table public.profiles
  drop constraint if exists profiles_username_format;

alter table public.profiles
  add constraint profiles_username_format
  check (
    username is null
    or username ~ '^[a-z0-9_]{3,24}$'
  );

create unique index if not exists profiles_username_unique_idx
  on public.profiles (lower(username))
  where username is not null;

-- New registrations must always claim a valid public username. We intentionally
-- do not provide an availability preflight RPC: signup errors stay generic so
-- registration cannot be used as a high-confidence account enumeration surface.
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
    'pending',
    v_email_kind,
    'required'
  );

  return new;
exception
  when unique_violation then
    -- Never disclose whether the collision was a username or another identity
    -- attribute. Frontend maps this to the generic registration recovery path.
    raise exception 'registration_conflict';
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

commit;
