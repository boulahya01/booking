-- Make support rate limits authoritative under concurrent requests.
--
-- The previous helpers used COUNT -> decide without a transaction lock. Two or
-- more concurrent requests could therefore observe the same pre-limit count and
-- all proceed. Serialize each logical rate-limit identity before counting.

create or replace function private.enforce_authenticated_thread_rate_limit(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_recent_threads integer;
begin
  if p_user_id is null then
    raise exception 'authentication_required';
  end if;

  -- Shared by authenticated thread/message limiters so creating a thread and
  -- replying cannot race each other's counters for the same user.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 41));

  select count(*)
  into v_recent_threads
  from public.support_threads
  where user_id = p_user_id
    and created_at >= now() - interval '30 minutes';

  if v_recent_threads >= 3 then
    raise exception 'support_rate_limited';
  end if;
end;
$function$;

create or replace function private.enforce_authenticated_message_rate_limit(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_recent_messages integer;
begin
  if p_user_id is null then
    raise exception 'authentication_required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 41));

  select count(*)
  into v_recent_messages
  from public.support_messages m
  join public.support_threads t on t.id = m.thread_id
  where t.user_id = p_user_id
    and m.sender_role = 'user'
    and m.created_at >= now() - interval '10 minutes';

  if v_recent_messages >= 20 then
    raise exception 'support_rate_limited';
  end if;
end;
$function$;

create or replace function private.enforce_authenticated_support_rate_limit(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_recent_threads integer;
  v_recent_messages integer;
begin
  if p_user_id is null then
    raise exception 'authentication_required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 41));

  select count(*)
  into v_recent_threads
  from public.support_threads
  where user_id = p_user_id
    and created_at >= now() - interval '30 minutes';

  if v_recent_threads >= 3 then
    raise exception 'support_rate_limited';
  end if;

  select count(*)
  into v_recent_messages
  from public.support_messages m
  join public.support_threads t on t.id = m.thread_id
  where t.user_id = p_user_id
    and m.sender_role = 'user'
    and m.created_at >= now() - interval '10 minutes';

  if v_recent_messages >= 20 then
    raise exception 'support_rate_limited';
  end if;
end;
$function$;

create or replace function private.enforce_guest_message_rate_limit(p_thread_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_recent integer;
begin
  if p_thread_id is null then
    raise exception 'support_thread_not_found';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_thread_id::text, 42));

  select count(*)
  into v_recent
  from public.support_messages
  where thread_id = p_thread_id
    and sender_role = 'guest'
    and created_at >= now() - interval '10 minutes';

  if v_recent >= 20 then
    raise exception 'support_rate_limited';
  end if;
end;
$function$;

create or replace function private.enforce_guest_thread_rate_limit(p_contact_email text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_email text := lower(trim(coalesce(p_contact_email, '')));
  v_email_recent integer;
  v_global_recent integer;
begin
  -- The global gate is acquired first for every caller, giving this helper a
  -- single lock order and making the 30/minute cap race-safe.
  perform pg_advisory_xact_lock(hashtextextended('guest-support-global', 43));

  if v_email <> '' then
    perform pg_advisory_xact_lock(hashtextextended(v_email, 44));

    select count(*)
    into v_email_recent
    from public.support_threads
    where user_id is null
      and lower(contact_email) = v_email
      and created_at >= now() - interval '30 minutes';

    if v_email_recent >= 2 then
      raise exception 'support_rate_limited';
    end if;
  end if;

  select count(*)
  into v_global_recent
  from public.support_threads
  where user_id is null
    and created_at >= now() - interval '1 minute';

  if v_global_recent >= 30 then
    raise exception 'support_temporarily_busy';
  end if;
end;
$function$;
