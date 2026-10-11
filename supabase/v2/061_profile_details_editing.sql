-- v2.1 account editing. Identity, role and access remain outside profile updates.
begin;
create or replace function public.update_my_profile(p_full_name text, p_username text)
returns public.profiles
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := btrim(coalesce(p_full_name, ''));
  v_username text := lower(btrim(coalesce(p_username, '')));
  v_profile public.profiles%rowtype;
begin
  if v_uid is null then raise exception 'authentication_required'; end if;
  if char_length(v_name) < 2 or char_length(v_name) > 120 then raise exception 'invalid_full_name'; end if;
  if v_username !~ '^[a-z0-9_]{3,24}$' then raise exception 'invalid_username'; end if;
  update public.profiles set full_name = v_name, username = v_username, updated_at = now()
    where id = v_uid returning * into v_profile;
  if not found then raise exception 'profile_not_found'; end if;
  return v_profile;
exception when unique_violation then raise exception 'username_taken';
end;
$$;
revoke all on function public.update_my_profile(text, text) from public, anon;
grant execute on function public.update_my_profile(text, text) to authenticated;
commit;
