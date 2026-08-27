-- UNEEM V2 admin operations for Help & Reports.
-- Apply after 007_support_threads.sql.

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id) on delete restrict,
  action text not null,
  target_type text not null,
  target_id uuid,
  reason_code text,
  previous_state jsonb,
  new_state jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_audit_log enable row level security;
revoke all on public.admin_audit_log from anon, authenticated;

create or replace function public.admin_list_support_threads(
  p_status text default null,
  p_limit integer default 50
)
returns table(
  id uuid,
  user_id uuid,
  contact_email text,
  kind text,
  status text,
  subject text,
  created_at timestamptz,
  updated_at timestamptz,
  message_count bigint,
  last_message_at timestamptz
)
language plpgsql
security definer
set search_path = public, private, auth
as $$
begin
  if not private.is_admin() then
    raise exception 'admin_required';
  end if;
  if p_status is not null and p_status not in ('open', 'waiting', 'resolved') then
    raise exception 'invalid_support_status';
  end if;

  return query
  select t.id, t.user_id, t.contact_email, t.kind, t.status, t.subject,
         t.created_at, t.updated_at,
         count(m.id)::bigint,
         max(m.created_at)
  from public.support_threads t
  left join public.support_messages m on m.thread_id = t.id
  where p_status is null or t.status = p_status
  group by t.id
  order by coalesce(max(m.created_at), t.created_at) desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
end;
$$;

create or replace function public.admin_get_support_messages(p_thread_id uuid)
returns table(
  id uuid,
  sender_role text,
  body text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, private, auth
as $$
begin
  if not private.is_admin() then
    raise exception 'admin_required';
  end if;

  return query
  select m.id, m.sender_role, m.body, m.created_at
  from public.support_messages m
  where m.thread_id = p_thread_id
  order by m.created_at asc;
end;
$$;

create or replace function public.admin_reply_support_thread(
  p_thread_id uuid,
  p_body text,
  p_next_status text default 'waiting'
)
returns uuid
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_message_id uuid;
  v_previous text;
begin
  if not private.is_admin() then
    raise exception 'admin_required';
  end if;
  if p_next_status not in ('open', 'waiting', 'resolved') then
    raise exception 'invalid_support_status';
  end if;
  if char_length(trim(coalesce(p_body, ''))) not between 1 and 4000 then
    raise exception 'invalid_support_message';
  end if;

  select status into v_previous from public.support_threads where id = p_thread_id for update;
  if v_previous is null then
    raise exception 'support_thread_not_found';
  end if;

  insert into public.support_messages (thread_id, sender_user_id, sender_role, body)
  values (p_thread_id, v_actor, 'admin', trim(p_body))
  returning id into v_message_id;

  update public.support_threads
  set status = p_next_status,
      updated_at = now(),
      resolved_at = case when p_next_status = 'resolved' then now() else null end
  where id = p_thread_id;

  insert into public.admin_audit_log (
    actor_id, action, target_type, target_id, previous_state, new_state
  ) values (
    v_actor, 'support_reply', 'support_thread', p_thread_id,
    jsonb_build_object('status', v_previous),
    jsonb_build_object('status', p_next_status, 'message_id', v_message_id)
  );

  return v_message_id;
end;
$$;

create or replace function public.admin_set_support_status(
  p_thread_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_previous text;
begin
  if not private.is_admin() then
    raise exception 'admin_required';
  end if;
  if p_status not in ('open', 'waiting', 'resolved') then
    raise exception 'invalid_support_status';
  end if;

  select status into v_previous from public.support_threads where id = p_thread_id for update;
  if v_previous is null then
    raise exception 'support_thread_not_found';
  end if;

  update public.support_threads
  set status = p_status,
      updated_at = now(),
      resolved_at = case when p_status = 'resolved' then now() else null end
  where id = p_thread_id;

  insert into public.admin_audit_log (
    actor_id, action, target_type, target_id, previous_state, new_state
  ) values (
    v_actor, 'support_status_changed', 'support_thread', p_thread_id,
    jsonb_build_object('status', v_previous),
    jsonb_build_object('status', p_status)
  );
end;
$$;

revoke all on function public.admin_list_support_threads(text, integer) from public;
revoke all on function public.admin_get_support_messages(uuid) from public;
revoke all on function public.admin_reply_support_thread(uuid, text, text) from public;
revoke all on function public.admin_set_support_status(uuid, text) from public;

grant execute on function public.admin_list_support_threads(text, integer) to authenticated;
grant execute on function public.admin_get_support_messages(uuid) to authenticated;
grant execute on function public.admin_reply_support_thread(uuid, text, text) to authenticated;
grant execute on function public.admin_set_support_status(uuid, text) to authenticated;
