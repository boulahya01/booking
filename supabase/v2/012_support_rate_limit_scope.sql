-- UNEEM V2 support throttle scope correction.
-- Apply after 011_guest_support_optional_contact.sql.
-- Opening several recent threads must not prevent a student from replying to an
-- existing conversation. Thread creation and message activity are limited separately.

create or replace function private.enforce_authenticated_thread_rate_limit(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent_threads integer;
begin
  select count(*) into v_recent_threads
  from public.support_threads
  where user_id = p_user_id
    and created_at >= now() - interval '30 minutes';

  if v_recent_threads >= 3 then
    raise exception 'support_rate_limited';
  end if;
end;
$$;

create or replace function private.enforce_authenticated_message_rate_limit(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent_messages integer;
begin
  select count(*) into v_recent_messages
  from public.support_messages m
  join public.support_threads t on t.id = m.thread_id
  where t.user_id = p_user_id
    and m.sender_role = 'user'
    and m.created_at >= now() - interval '10 minutes';

  if v_recent_messages >= 20 then
    raise exception 'support_rate_limited';
  end if;
end;
$$;

create or replace function public.create_my_support_thread(
  p_kind text,
  p_subject text,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, private
as $$
declare
  v_uid uuid := auth.uid();
  v_thread_id uuid;
begin
  if v_uid is null then
    raise exception 'authentication_required';
  end if;
  if p_kind not in ('support', 'appeal') then
    raise exception 'invalid_support_kind';
  end if;
  if char_length(trim(coalesce(p_body, ''))) not between 1 and 4000 then
    raise exception 'invalid_support_message';
  end if;

  perform private.enforce_authenticated_thread_rate_limit(v_uid);
  perform private.enforce_authenticated_message_rate_limit(v_uid);

  insert into public.support_threads (user_id, kind, subject)
  values (v_uid, p_kind, nullif(left(trim(coalesce(p_subject, '')), 120), ''))
  returning id into v_thread_id;

  insert into public.support_messages (thread_id, sender_user_id, sender_role, body)
  values (v_thread_id, v_uid, 'user', trim(p_body));

  return v_thread_id;
end;
$$;

create or replace function public.create_my_report_thread(
  p_target_type text,
  p_target_id uuid,
  p_reason_code text,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, private
as $$
declare
  v_uid uuid := auth.uid();
  v_thread_id uuid;
begin
  if v_uid is null then
    raise exception 'authentication_required';
  end if;
  if p_target_type not in ('user', 'match', 'booking', 'facility', 'other') then
    raise exception 'invalid_report_target';
  end if;
  if p_target_id is null then
    raise exception 'invalid_report_target';
  end if;
  if p_reason_code not in (
    'harassment', 'unsafe_behavior', 'spam', 'fake_identity',
    'booking_issue', 'match_issue', 'facility_issue', 'other'
  ) then
    raise exception 'invalid_report_reason';
  end if;
  if char_length(trim(coalesce(p_body, ''))) not between 1 and 4000 then
    raise exception 'invalid_support_message';
  end if;

  perform private.enforce_authenticated_thread_rate_limit(v_uid);
  perform private.enforce_authenticated_message_rate_limit(v_uid);

  if p_target_type = 'user' and p_target_id = v_uid then
    raise exception 'invalid_report_target';
  end if;

  insert into public.support_threads (
    user_id, kind, subject, target_type, target_id, reason_code
  )
  values (
    v_uid,
    'report',
    left('Report: ' || replace(p_reason_code, '_', ' '), 120),
    p_target_type,
    p_target_id,
    p_reason_code
  )
  returning id into v_thread_id;

  insert into public.support_messages (thread_id, sender_user_id, sender_role, body)
  values (v_thread_id, v_uid, 'user', trim(p_body));

  return v_thread_id;
end;
$$;

create or replace function public.add_my_support_message(
  p_thread_id uuid,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, private
as $$
declare
  v_uid uuid := auth.uid();
  v_message_id uuid;
begin
  if v_uid is null then
    raise exception 'authentication_required';
  end if;
  if char_length(trim(coalesce(p_body, ''))) not between 1 and 4000 then
    raise exception 'invalid_support_message';
  end if;
  if not exists (
    select 1 from public.support_threads
    where id = p_thread_id and user_id = v_uid
  ) then
    raise exception 'support_thread_not_found';
  end if;

  perform private.enforce_authenticated_message_rate_limit(v_uid);

  insert into public.support_messages (thread_id, sender_user_id, sender_role, body)
  values (p_thread_id, v_uid, 'user', trim(p_body))
  returning id into v_message_id;

  update public.support_threads
  set status = 'open', updated_at = now(), resolved_at = null
  where id = p_thread_id;

  return v_message_id;
end;
$$;

revoke all on function private.enforce_authenticated_thread_rate_limit(uuid) from public;
revoke all on function private.enforce_authenticated_message_rate_limit(uuid) from public;
