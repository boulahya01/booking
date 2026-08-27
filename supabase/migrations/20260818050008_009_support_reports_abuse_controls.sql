-- UNEEM V2 support/report hardening.
-- Apply after 008_support_admin_ops.sql.
-- Adds structured report context and zero-cost database throttles that are actually
-- authoritative for authenticated users and guest capability-token replies.
-- Guest thread creation is additionally throttled by normalized contact email + a
-- conservative global ceiling; this reduces abuse but does not replace an IP-aware
-- server/edge control before public launch.

alter table public.support_threads
  add column if not exists target_type text,
  add column if not exists target_id uuid,
  add column if not exists reason_code text;

alter table public.support_threads
  drop constraint if exists support_threads_target_type_check;
alter table public.support_threads
  add constraint support_threads_target_type_check
  check (target_type is null or target_type in ('user', 'match', 'booking', 'facility', 'other'));

alter table public.support_threads
  drop constraint if exists support_threads_reason_code_check;
alter table public.support_threads
  add constraint support_threads_reason_code_check
  check (
    reason_code is null or reason_code in (
      'harassment',
      'unsafe_behavior',
      'spam',
      'fake_identity',
      'booking_issue',
      'match_issue',
      'facility_issue',
      'other'
    )
  );

alter table public.support_threads
  drop constraint if exists support_report_context_check;
alter table public.support_threads
  add constraint support_report_context_check
  check (
    kind <> 'report'
    or (
      user_id is not null
      and target_type is not null
      and target_id is not null
      and reason_code is not null
    )
  );

create index if not exists support_threads_user_recent_idx
  on public.support_threads (user_id, created_at desc)
  where user_id is not null;

create index if not exists support_threads_guest_email_recent_idx
  on public.support_threads (lower(contact_email), created_at desc)
  where user_id is null and contact_email is not null;

create index if not exists support_threads_report_target_idx
  on public.support_threads (target_type, target_id, created_at desc)
  where kind = 'report';

create or replace function private.enforce_authenticated_support_rate_limit(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent_threads integer;
  v_recent_messages integer;
begin
  select count(*) into v_recent_threads
  from public.support_threads
  where user_id = p_user_id
    and created_at >= now() - interval '30 minutes';

  if v_recent_threads >= 3 then
    raise exception 'support_rate_limited';
  end if;

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
  if v_email = '' then
    raise exception 'guest_contact_email_required';
  end if;

  select count(*) into v_email_recent
  from public.support_threads
  where user_id is null
    and lower(contact_email) = v_email
    and created_at >= now() - interval '30 minutes';

  if v_email_recent >= 2 then
    raise exception 'support_rate_limited';
  end if;

  -- Protect the free database from a burst even when an attacker rotates addresses.
  -- This intentionally fails closed for anonymous creation during a large burst.
  select count(*) into v_global_recent
  from public.support_threads
  where user_id is null
    and created_at >= now() - interval '1 minute';

  if v_global_recent >= 30 then
    raise exception 'support_temporarily_busy';
  end if;
end;
$$;

create or replace function private.enforce_guest_message_rate_limit(p_thread_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent integer;
begin
  select count(*) into v_recent
  from public.support_messages
  where thread_id = p_thread_id
    and sender_role = 'guest'
    and created_at >= now() - interval '10 minutes';

  if v_recent >= 20 then
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

  perform private.enforce_authenticated_support_rate_limit(v_uid);

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

  perform private.enforce_authenticated_support_rate_limit(v_uid);

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

  perform private.enforce_authenticated_support_rate_limit(v_uid);

  insert into public.support_messages (thread_id, sender_user_id, sender_role, body)
  values (p_thread_id, v_uid, 'user', trim(p_body))
  returning id into v_message_id;

  update public.support_threads
  set status = 'open', updated_at = now(), resolved_at = null
  where id = p_thread_id;

  return v_message_id;
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
  if v_email = '' then
    raise exception 'guest_contact_email_required';
  end if;
  if char_length(v_email) > 254 or position('@' in v_email) < 2 then
    raise exception 'invalid_contact_email';
  end if;

  perform private.enforce_guest_thread_rate_limit(v_email);

  insert into public.support_threads (contact_email, kind, subject, guest_token_hash)
  values (
    v_email,
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

create or replace function public.add_guest_support_message(
  p_access_token text,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_thread_id uuid;
  v_message_id uuid;
begin
  if char_length(trim(coalesce(p_body, ''))) not between 1 and 4000 then
    raise exception 'invalid_support_message';
  end if;

  select id into v_thread_id
  from public.support_threads
  where guest_token_hash = extensions.digest(coalesce(p_access_token, ''), 'sha256');

  if v_thread_id is null then
    raise exception 'support_thread_not_found';
  end if;

  perform private.enforce_guest_message_rate_limit(v_thread_id);

  insert into public.support_messages (thread_id, sender_role, body)
  values (v_thread_id, 'guest', trim(p_body))
  returning id into v_message_id;

  update public.support_threads
  set status = 'open', updated_at = now(), resolved_at = null
  where id = v_thread_id;

  return v_message_id;
end;
$$;

revoke all on function private.enforce_authenticated_support_rate_limit(uuid) from public;
revoke all on function private.enforce_guest_thread_rate_limit(text) from public;
revoke all on function private.enforce_guest_message_rate_limit(uuid) from public;

revoke all on function public.create_my_report_thread(text, uuid, text, text) from public;
grant execute on function public.create_my_report_thread(text, uuid, text, text) to authenticated;
