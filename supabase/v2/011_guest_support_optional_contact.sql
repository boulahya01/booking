-- UNEEM V2 guest-support accessibility correction.
-- Apply after 010_support_report_admin_context.sql.
-- A guest must be able to ask for help even when email/account access itself is the
-- problem. Contact email therefore stays optional. When supplied it gets a tighter
-- per-contact throttle; every anonymous creation is still covered by a global burst
-- ceiling. Add an IP-aware edge/server control before public launch for stronger abuse
-- resistance without sacrificing the no-auth recovery path.

create or replace function private.enforce_guest_thread_rate_limit(p_contact_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_contact_email, '')));
  v_email_recent integer;
  v_global_recent integer;
begin
  if v_email <> '' then
    select count(*) into v_email_recent
    from public.support_threads
    where user_id is null
      and lower(contact_email) = v_email
      and created_at >= now() - interval '30 minutes';

    if v_email_recent >= 2 then
      raise exception 'support_rate_limited';
    end if;
  end if;

  select count(*) into v_global_recent
  from public.support_threads
  where user_id is null
    and created_at >= now() - interval '1 minute';

  if v_global_recent >= 30 then
    raise exception 'support_temporarily_busy';
  end if;
end;
$$;

create or replace function public.create_guest_support_thread(
  p_contact_email text,
  p_subject text,
  p_body text
)
returns table(thread_id uuid, access_token text)
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_thread_id uuid;
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_email text := lower(trim(coalesce(p_contact_email, '')));
begin
  if char_length(trim(coalesce(p_body, ''))) not between 1 and 4000 then
    raise exception 'invalid_support_message';
  end if;
  if v_email <> '' and (char_length(v_email) > 254 or position('@' in v_email) < 2) then
    raise exception 'invalid_contact_email';
  end if;

  perform private.enforce_guest_thread_rate_limit(v_email);

  insert into public.support_threads (contact_email, kind, subject, guest_token_hash)
  values (
    nullif(v_email, ''),
    'support',
    nullif(left(trim(coalesce(p_subject, '')), 120), ''),
    extensions.digest(v_token, 'sha256')
  )
  returning id into v_thread_id;

  insert into public.support_messages (thread_id, sender_role, body)
  values (v_thread_id, 'guest', trim(p_body));

  return query select v_thread_id, v_token;
end;
$$;
