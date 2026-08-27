create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
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

  -- Supabase may internally attempt an insert while handling a repeat signup.
  -- If a real Auth user already owns this normalized email, do not let the
  -- profile trigger turn Supabase's duplicate-account handling into a 500.
  if exists (
    select 1
    from auth.users u
    where u.id <> new.id
      and lower(btrim(coalesce(u.email, ''))) = v_email
  ) then
    return new;
  end if;

  v_email_kind := case
    when split_part(v_email, '@', 2) = 'usmba.ac.ma' then 'academic'
    else 'personal'
  end;

  v_full_name := btrim(coalesce(new.raw_user_meta_data->>'full_name', ''));
  if char_length(v_full_name) < 2 or char_length(v_full_name) > 120 then
    raise exception 'invalid_full_name';
  end if;

  v_username := lower(btrim(coalesce(new.raw_user_meta_data->>'username', '')));
  if v_username !~ '^[a-z0-9_]{3,24}$' then
    raise exception 'invalid_username';
  end if;

  v_student_id := upper(regexp_replace(coalesce(new.raw_user_meta_data->>'student_id', ''), '\s+', '', 'g'));
  if v_student_id = '' then
    v_student_id := null;
  elsif v_student_id !~ '^[A-Z][0-9]{9}$' then
    raise exception 'invalid_student_id';
  end if;

  if v_email_kind = 'personal' and v_student_id is null then
    raise exception 'student_id_required_for_personal_email';
  end if;

  insert into public.profiles (
    id, student_id, full_name, username, role, status, email_kind, identity_status
  ) values (
    new.id, v_student_id, v_full_name, v_username,
    'student', 'pending', v_email_kind, 'required'
  );

  return new;
exception
  when unique_violation then
    raise exception 'registration_conflict';
end;
$$;

create or replace function public.registration_username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = 'public', 'pg_temp'
as $$
  select case
    when lower(btrim(coalesce(p_username, ''))) !~ '^[a-z0-9_]{3,24}$' then false
    else not exists (
      select 1
      from public.profiles p
      where lower(p.username) = lower(btrim(p_username))
    )
  end;
$$;

revoke all on function public.registration_username_available(text) from public;
grant execute on function public.registration_username_available(text) to anon, authenticated;
