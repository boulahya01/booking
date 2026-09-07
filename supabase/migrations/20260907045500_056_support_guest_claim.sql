-- Preserve a guest support conversation when the guest later signs in or registers.
-- The guest access token is a capability. Claiming it attaches the thread to the
-- authenticated profile and permanently invalidates anonymous access to that token.

begin;

create or replace function public.claim_guest_support_thread(p_access_token text)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_thread_id uuid;
  v_identity text;
begin
  if v_uid is null then
    raise exception 'authentication_required';
  end if;

  if coalesce(p_access_token, '') = '' then
    raise exception 'support_thread_not_found';
  end if;

  select t.id
  into v_thread_id
  from public.support_threads t
  where t.user_id is null
    and t.guest_token_hash = extensions.digest(p_access_token, 'sha256')
  for update;

  if v_thread_id is null then
    raise exception 'support_thread_not_found';
  end if;

  select coalesce(
    case when nullif(trim(p.username), '') is not null then '@' || trim(p.username) end,
    nullif(trim(p.full_name), '')
  )
  into v_identity
  from public.profiles p
  where p.id = v_uid;

  update public.support_threads
  set user_id = v_uid,
      guest_token_hash = null,
      subject = coalesce(v_identity, subject),
      updated_at = now()
  where id = v_thread_id;

  return v_thread_id;
end;
$$;

revoke all on function public.claim_guest_support_thread(text)
  from public, anon, authenticated, service_role;
grant execute on function public.claim_guest_support_thread(text)
  to authenticated;

commit;
