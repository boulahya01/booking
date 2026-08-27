-- UNEEM V2 authoritative backend read/session contract.
-- Apply after 017_admin_operations.sql.
--
-- Mutations are already RPC-owned. This layer closes the remaining high-value
-- read gaps so lifecycle/status logic and sensitive directory filtering stay in
-- PostgreSQL instead of being reconstructed in the browser.

begin;

create or replace function public.get_my_session_context()
returns table(
  user_id uuid,
  student_id text,
  full_name text,
  username text,
  role text,
  access_status text,
  email_kind text,
  identity_status text,
  restriction_reason text,
  verified_student_id_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  can_use_sports boolean,
  needs_identity_action boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    p.id,
    p.student_id,
    p.full_name,
    p.username,
    p.role,
    p.status,
    p.email_kind,
    p.identity_status,
    p.restriction_reason,
    p.verified_student_id_at,
    p.created_at,
    p.updated_at,
    p.status = 'approved',
    p.identity_status in ('required', 'rejected', 'conflict')
  from public.profiles p
  where p.id = auth.uid();
$$;

revoke all on function public.get_my_session_context() from public, anon;
grant execute on function public.get_my_session_context() to authenticated;

create or replace function public.list_my_bookings(
  p_limit integer default 100
)
returns table(
  booking_id uuid,
  pitch_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  booking_status text,
  lifecycle_status text,
  cancelled_at timestamptz,
  created_at timestamptz,
  pitch_name text,
  pitch_location text,
  pitch_capacity integer
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 200);
begin
  if v_uid is null then
    raise exception 'authentication_required';
  end if;

  return query
  select
    b.id,
    b.pitch_id,
    b.starts_at,
    b.ends_at,
    b.status,
    case
      when b.status = 'cancelled' then 'cancelled'
      when b.ends_at <= now() then 'completed'
      when b.starts_at <= now() then 'in_progress'
      else 'upcoming'
    end,
    b.cancelled_at,
    b.created_at,
    p.name,
    p.location,
    p.capacity
  from public.bookings b
  join public.pitches p on p.id = b.pitch_id
  where b.user_id = v_uid
  order by b.starts_at desc
  limit v_limit;
end;
$$;

revoke all on function public.list_my_bookings(integer) from public, anon;
grant execute on function public.list_my_bookings(integer) to authenticated;

create or replace function public.get_next_booking()
returns table(
  booking_id uuid,
  pitch_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  booking_status text,
  lifecycle_status text,
  cancelled_at timestamptz,
  created_at timestamptz,
  pitch_name text,
  pitch_location text,
  pitch_capacity integer
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'authentication_required';
  end if;

  return query
  select
    b.id,
    b.pitch_id,
    b.starts_at,
    b.ends_at,
    b.status,
    case
      when b.starts_at <= now() then 'in_progress'
      else 'upcoming'
    end,
    b.cancelled_at,
    b.created_at,
    p.name,
    p.location,
    p.capacity
  from public.bookings b
  join public.pitches p on p.id = b.pitch_id
  where b.user_id = v_uid
    and b.status = 'scheduled'
    and b.ends_at > now()
  order by b.starts_at asc
  limit 1;
end;
$$;

revoke all on function public.get_next_booking() from public, anon;
grant execute on function public.get_next_booking() to authenticated;

create or replace function public.list_my_support_threads(
  p_limit integer default 30
)
returns table(
  thread_id uuid,
  kind text,
  status text,
  subject text,
  created_at timestamptz,
  updated_at timestamptz,
  last_message_id uuid,
  last_sender_role text,
  last_body text,
  last_message_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 30), 1), 100);
begin
  if v_uid is null then
    raise exception 'authentication_required';
  end if;

  return query
  select
    t.id,
    t.kind,
    t.status,
    t.subject,
    t.created_at,
    t.updated_at,
    lm.id,
    lm.sender_role,
    lm.body,
    lm.created_at
  from public.support_threads t
  left join lateral (
    select m.id, m.sender_role, m.body, m.created_at
    from public.support_messages m
    where m.thread_id = t.id
    order by m.created_at desc, m.id desc
    limit 1
  ) lm on true
  where t.user_id = v_uid
  order by t.updated_at desc, t.id desc
  limit v_limit;
end;
$$;

revoke all on function public.list_my_support_threads(integer) from public, anon;
grant execute on function public.list_my_support_threads(integer) to authenticated;

create or replace function public.get_my_support_thread(
  p_thread_id uuid
)
returns table(
  thread_id uuid,
  kind text,
  status text,
  subject text,
  thread_created_at timestamptz,
  thread_updated_at timestamptz,
  message_id uuid,
  sender_role text,
  body text,
  message_created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'authentication_required';
  end if;

  if not exists (
    select 1
    from public.support_threads t
    where t.id = p_thread_id
      and t.user_id = v_uid
  ) then
    raise exception 'support_thread_not_found';
  end if;

  return query
  select
    t.id,
    t.kind,
    t.status,
    t.subject,
    t.created_at,
    t.updated_at,
    m.id,
    m.sender_role,
    m.body,
    m.created_at
  from public.support_threads t
  join public.support_messages m on m.thread_id = t.id
  where t.id = p_thread_id
    and t.user_id = v_uid
  order by m.created_at asc, m.id asc;
end;
$$;

revoke all on function public.get_my_support_thread(uuid) from public, anon;
grant execute on function public.get_my_support_thread(uuid) to authenticated;

create or replace function public.get_my_latest_identity_verification()
returns table(
  attempt_id uuid,
  user_id uuid,
  claimed_student_id text,
  card_storage_path text,
  status text,
  reason_code text,
  submitted_at timestamptz,
  reviewed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'authentication_required';
  end if;

  return query
  select
    a.id,
    a.user_id,
    a.claimed_student_id,
    a.card_storage_path,
    a.status,
    a.reason_code,
    a.submitted_at,
    a.reviewed_at
  from public.identity_verification_attempts a
  where a.user_id = v_uid
  order by a.submitted_at desc, a.id desc
  limit 1;
end;
$$;

revoke all on function public.get_my_latest_identity_verification() from public, anon;
grant execute on function public.get_my_latest_identity_verification() to authenticated;

create or replace function public.admin_list_users(
  p_query text default null,
  p_status text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table(
  user_id uuid,
  student_id text,
  full_name text,
  username text,
  role text,
  access_status text,
  email_kind text,
  identity_status text,
  restriction_reason text,
  created_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_query text := nullif(lower(btrim(coalesce(p_query, ''))), '');
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if not private.is_admin() then
    raise exception 'admin_required';
  end if;

  if p_status is not null and p_status not in ('pending', 'approved', 'suspended') then
    raise exception 'invalid_user_status';
  end if;

  return query
  with filtered as (
    select p.*
    from public.profiles p
    where (p_status is null or p.status = p_status)
      and (
        v_query is null
        or lower(p.full_name) like '%' || v_query || '%'
        or lower(coalesce(p.username, '')) like '%' || v_query || '%'
        or lower(coalesce(p.student_id, '')) like '%' || v_query || '%'
      )
  )
  select
    p.id,
    p.student_id,
    p.full_name,
    p.username,
    p.role,
    p.status,
    p.email_kind,
    p.identity_status,
    p.restriction_reason,
    p.created_at,
    count(*) over ()::bigint
  from filtered p
  order by p.created_at desc, p.id desc
  limit v_limit
  offset v_offset;
end;
$$;

revoke all on function public.admin_list_users(text, text, integer, integer) from public, anon;
grant execute on function public.admin_list_users(text, text, integer, integer) to authenticated;

commit;
