-- UNEEM V2 support / appeal contract.
-- Apply after 006_identity_verification_storage.sql.
-- Guest access is capability-based: possession of a high-entropy thread token grants
-- access only to that thread. Raw tokens are never stored.

create extension if not exists pgcrypto;

create table if not exists public.support_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  contact_email text,
  kind text not null default 'support' check (kind in ('support', 'appeal', 'report')),
  status text not null default 'open' check (status in ('open', 'waiting', 'resolved')),
  guest_token_hash bytea,
  subject text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint support_thread_identity check (user_id is not null or guest_token_hash is not null)
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.support_threads(id) on delete cascade,
  sender_user_id uuid references auth.users(id) on delete set null,
  sender_role text not null check (sender_role in ('user', 'guest', 'admin')),
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists support_threads_user_created_idx
  on public.support_threads (user_id, created_at desc)
  where user_id is not null;

create index if not exists support_threads_status_updated_idx
  on public.support_threads (status, updated_at desc);

create index if not exists support_messages_thread_created_idx
  on public.support_messages (thread_id, created_at asc);

alter table public.support_threads enable row level security;
alter table public.support_messages enable row level security;

-- Authenticated students can read only their own support threads/messages.
drop policy if exists "support threads read own" on public.support_threads;
create policy "support threads read own"
  on public.support_threads for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "support messages read own thread" on public.support_messages;
create policy "support messages read own thread"
  on public.support_messages for select
  to authenticated
  using (
    exists (
      select 1 from public.support_threads t
      where t.id = support_messages.thread_id
        and t.user_id = auth.uid()
    )
  );

-- Mutations are intentionally RPC-only. No direct INSERT/UPDATE policies are granted.

create or replace function public.create_my_support_thread(
  p_kind text,
  p_subject text,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_thread_id uuid;
begin
  if v_uid is null then
    raise exception 'authentication_required';
  end if;
  if p_kind not in ('support', 'appeal', 'report') then
    raise exception 'invalid_support_kind';
  end if;
  if char_length(trim(coalesce(p_body, ''))) not between 1 and 4000 then
    raise exception 'invalid_support_message';
  end if;

  insert into public.support_threads (user_id, kind, subject)
  values (v_uid, p_kind, nullif(left(trim(coalesce(p_subject, '')), 120), ''))
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
set search_path = public, auth
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
set search_path = public, auth
as $$
declare
  v_thread_id uuid;
  v_token text := encode(gen_random_bytes(32), 'hex');
  v_email text := lower(trim(coalesce(p_contact_email, '')));
begin
  if char_length(trim(coalesce(p_body, ''))) not between 1 and 4000 then
    raise exception 'invalid_support_message';
  end if;
  if v_email <> '' and (char_length(v_email) > 254 or position('@' in v_email) < 2) then
    raise exception 'invalid_contact_email';
  end if;

  insert into public.support_threads (contact_email, kind, subject, guest_token_hash)
  values (
    nullif(v_email, ''),
    'support',
    nullif(left(trim(coalesce(p_subject, '')), 120), ''),
    digest(v_token, 'sha256')
  )
  returning id into v_thread_id;

  insert into public.support_messages (thread_id, sender_role, body)
  values (v_thread_id, 'guest', trim(p_body));

  return query select v_thread_id, v_token;
end;
$$;

create or replace function public.get_guest_support_thread(p_access_token text)
returns table(
  thread_id uuid,
  kind text,
  status text,
  subject text,
  created_at timestamptz,
  message_id uuid,
  sender_role text,
  body text,
  message_created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select t.id, t.kind, t.status, t.subject, t.created_at,
         m.id, m.sender_role, m.body, m.created_at
  from public.support_threads t
  join public.support_messages m on m.thread_id = t.id
  where t.guest_token_hash = digest(coalesce(p_access_token, ''), 'sha256')
  order by m.created_at asc;
$$;

create or replace function public.add_guest_support_message(
  p_access_token text,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = public
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
  where guest_token_hash = digest(coalesce(p_access_token, ''), 'sha256');

  if v_thread_id is null then
    raise exception 'support_thread_not_found';
  end if;

  insert into public.support_messages (thread_id, sender_role, body)
  values (v_thread_id, 'guest', trim(p_body))
  returning id into v_message_id;

  update public.support_threads
  set status = 'open', updated_at = now(), resolved_at = null
  where id = v_thread_id;

  return v_message_id;
end;
$$;

revoke all on function public.create_my_support_thread(text, text, text) from public;
revoke all on function public.add_my_support_message(uuid, text) from public;
revoke all on function public.create_guest_support_thread(text, text, text) from public;
revoke all on function public.get_guest_support_thread(text) from public;
revoke all on function public.add_guest_support_message(text, text) from public;

grant execute on function public.create_my_support_thread(text, text, text) to authenticated;
grant execute on function public.add_my_support_message(uuid, text) to authenticated;
grant execute on function public.create_guest_support_thread(text, text, text) to anon, authenticated;
grant execute on function public.get_guest_support_thread(text) to anon, authenticated;
grant execute on function public.add_guest_support_message(text, text) to anon, authenticated;
