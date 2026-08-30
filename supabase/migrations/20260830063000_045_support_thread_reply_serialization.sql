-- Serialize student/guest replies with admin support status transitions.
--
-- Admin reply/status RPCs already lock support_threads before mutating status. User
-- and guest replies also reopen the thread, so they must participate in the same
-- row-level serialization boundary. Without this lock, a concurrent admin resolve
-- and user reply can commit in either physical update order rather than the logical
-- transaction order, leaving a new unanswered message on a resolved thread.

create or replace function public.add_my_support_message(
  p_thread_id uuid,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'auth', 'private'
as $function$
declare
  v_uid uuid := auth.uid();
  v_message_id uuid;
  v_thread_id uuid;
begin
  if v_uid is null then
    raise exception 'authentication_required';
  end if;

  if char_length(trim(coalesce(p_body, ''))) not between 1 and 4000 then
    raise exception 'invalid_support_message';
  end if;

  select t.id
  into v_thread_id
  from public.support_threads t
  where t.id = p_thread_id
    and t.user_id = v_uid
  for update;

  if not found then
    raise exception 'support_thread_not_found';
  end if;

  perform private.enforce_authenticated_message_rate_limit(v_uid);

  insert into public.support_messages(thread_id, sender_user_id, sender_role, body)
  values (v_thread_id, v_uid, 'user', trim(p_body))
  returning id into v_message_id;

  update public.support_threads
  set status = 'open',
      updated_at = now(),
      resolved_at = null
  where id = v_thread_id;

  return v_message_id;
end;
$function$;

create or replace function public.add_guest_support_message(
  p_access_token text,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'private', 'extensions'
as $function$
declare
  v_thread_id uuid;
  v_message_id uuid;
begin
  if char_length(trim(coalesce(p_body, ''))) not between 1 and 4000 then
    raise exception 'invalid_support_message';
  end if;

  select t.id
  into v_thread_id
  from public.support_threads t
  where t.guest_token_hash = extensions.digest(coalesce(p_access_token, ''), 'sha256')
  for update;

  if not found then
    raise exception 'support_thread_not_found';
  end if;

  perform private.enforce_guest_message_rate_limit(v_thread_id);

  insert into public.support_messages(thread_id, sender_role, body)
  values (v_thread_id, 'guest', trim(p_body))
  returning id into v_message_id;

  update public.support_threads
  set status = 'open',
      updated_at = now(),
      resolved_at = null
  where id = v_thread_id;

  return v_message_id;
end;
$function$;
