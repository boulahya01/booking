-- UNEEM V2 recoverable capability-specific restrictions.
-- Apply after 018_backend_read_contract.sql.
--
-- Behavioral moderation should restrict only the affected capability where
-- possible. Identity verification remains a separate authoritative workflow.

begin;

create table public.user_capability_restrictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  capability text not null check (capability in ('sports', 'matches', 'support')),
  reason_code text not null check (reason_code in ('behavior', 'harassment', 'spam', 'safety', 'policy', 'security_review')),
  status text not null default 'active' check (status in ('active', 'lifted')),
  expires_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  lifted_by uuid references public.profiles(id),
  lifted_at timestamptz,
  lift_reason_code text,
  check (expires_at is null or expires_at > created_at),
  check (
    (status = 'active' and lifted_at is null and lifted_by is null)
    or (status = 'lifted' and lifted_at is not null and lifted_by is not null)
  )
);

create unique index user_capability_restrictions_one_active
  on public.user_capability_restrictions(user_id, capability)
  where status = 'active';
create index user_capability_restrictions_user_history
  on public.user_capability_restrictions(user_id, created_at desc);

alter table public.user_capability_restrictions enable row level security;
revoke all on public.user_capability_restrictions from anon, authenticated;

create or replace function private.has_active_restriction(p_user_id uuid, p_capability text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.user_capability_restrictions r
    where r.user_id = p_user_id
      and r.capability = p_capability
      and r.status = 'active'
      and (r.expires_at is null or r.expires_at > now())
  );
$$;
revoke all on function private.has_active_restriction(uuid, text) from public, anon, authenticated;

-- One caller-scoped read model gives the shell enough information to explain
-- restrictions without exposing moderation notes or another student's state.
create or replace function public.get_my_capability_state()
returns table(
  sports_allowed boolean,
  matches_allowed boolean,
  support_allowed boolean,
  sports_reason text,
  matches_reason text,
  support_reason text,
  sports_expires_at timestamptz,
  matches_expires_at timestamptz,
  support_expires_at timestamptz
)
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  with me as (select auth.uid() as uid),
  active as (
    select distinct on (r.capability) r.capability, r.reason_code, r.expires_at
    from public.user_capability_restrictions r, me
    where r.user_id = me.uid
      and r.status = 'active'
      and (r.expires_at is null or r.expires_at > now())
    order by r.capability, r.created_at desc
  )
  select
    not exists (select 1 from active where capability = 'sports'),
    not exists (select 1 from active where capability in ('sports', 'matches')),
    not exists (select 1 from active where capability = 'support'),
    (select reason_code from active where capability = 'sports'),
    coalesce((select reason_code from active where capability = 'matches'), (select reason_code from active where capability = 'sports')),
    (select reason_code from active where capability = 'support'),
    (select expires_at from active where capability = 'sports'),
    coalesce((select expires_at from active where capability = 'matches'), (select expires_at from active where capability = 'sports')),
    (select expires_at from active where capability = 'support');
$$;
revoke all on function public.get_my_capability_state() from public, anon;
grant execute on function public.get_my_capability_state() to authenticated;

create or replace function public.admin_list_user_restrictions(p_user_id uuid)
returns table(
  restriction_id uuid,
  capability text,
  reason_code text,
  status text,
  expires_at timestamptz,
  created_by uuid,
  created_at timestamptz,
  lifted_by uuid,
  lifted_at timestamptz,
  lift_reason_code text
)
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
begin
  if not private.is_admin() then raise exception 'admin_required'; end if;
  return query
  select r.id, r.capability, r.reason_code, r.status, r.expires_at,
         r.created_by, r.created_at, r.lifted_by, r.lifted_at, r.lift_reason_code
  from public.user_capability_restrictions r
  where r.user_id = p_user_id
  order by r.created_at desc;
end;
$$;

create or replace function public.admin_restrict_user_capability(
  p_user_id uuid,
  p_capability text,
  p_reason_code text,
  p_expires_at timestamptz default null
)
returns public.user_capability_restrictions
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_result public.user_capability_restrictions%rowtype;
begin
  if not private.is_admin() then raise exception 'admin_required'; end if;
  if p_user_id = v_actor then raise exception 'cannot_restrict_self'; end if;
  if p_capability not in ('sports', 'matches', 'support') then raise exception 'invalid_capability'; end if;
  if p_reason_code not in ('behavior', 'harassment', 'spam', 'safety', 'policy', 'security_review') then raise exception 'invalid_restriction_reason'; end if;
  if p_expires_at is not null and p_expires_at <= now() then raise exception 'invalid_restriction_expiry'; end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then raise exception 'user_not_found'; end if;

  -- Expired restrictions are retained as audit history but cease being active.
  update public.user_capability_restrictions
  set status = 'lifted', lifted_by = v_actor, lifted_at = now(), lift_reason_code = 'expired_replaced'
  where user_id = p_user_id and capability = p_capability and status = 'active'
    and expires_at is not null and expires_at <= now();

  if exists (
    select 1 from public.user_capability_restrictions
    where user_id = p_user_id and capability = p_capability and status = 'active'
  ) then raise exception 'capability_already_restricted'; end if;

  insert into public.user_capability_restrictions(user_id, capability, reason_code, expires_at, created_by)
  values (p_user_id, p_capability, p_reason_code, p_expires_at, v_actor)
  returning * into v_result;

  insert into public.admin_audit_log(actor_id, action, target_type, target_id, reason_code, new_state)
  values (
    v_actor, 'user_capability_restricted', 'user', p_user_id, p_reason_code,
    jsonb_build_object('restriction_id', v_result.id, 'capability', p_capability, 'expires_at', p_expires_at)
  );

  return v_result;
end;
$$;

create or replace function public.admin_lift_user_restriction(
  p_restriction_id uuid,
  p_reason_code text
)
returns public.user_capability_restrictions
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_previous public.user_capability_restrictions%rowtype;
  v_result public.user_capability_restrictions%rowtype;
begin
  if not private.is_admin() then raise exception 'admin_required'; end if;
  if p_reason_code not in ('appeal_approved', 'review_complete', 'restriction_expired', 'admin_correction') then
    raise exception 'invalid_lift_reason';
  end if;

  select * into v_previous from public.user_capability_restrictions
  where id = p_restriction_id for update;
  if not found then raise exception 'restriction_not_found'; end if;
  if v_previous.status <> 'active' then raise exception 'restriction_not_active'; end if;

  update public.user_capability_restrictions
  set status = 'lifted', lifted_by = v_actor, lifted_at = now(), lift_reason_code = p_reason_code
  where id = p_restriction_id returning * into v_result;

  insert into public.admin_audit_log(actor_id, action, target_type, target_id, reason_code, previous_state, new_state)
  values (
    v_actor, 'user_capability_restored', 'user', v_previous.user_id, p_reason_code,
    jsonb_build_object('restriction_id', v_previous.id, 'capability', v_previous.capability, 'reason_code', v_previous.reason_code, 'expires_at', v_previous.expires_at),
    jsonb_build_object('restriction_id', v_result.id, 'capability', v_result.capability, 'status', 'lifted', 'lifted_at', v_result.lifted_at)
  );

  return v_result;
end;
$$;

revoke all on function public.admin_list_user_restrictions(uuid) from public, anon;
revoke all on function public.admin_restrict_user_capability(uuid, text, text, timestamptz) from public, anon;
revoke all on function public.admin_lift_user_restriction(uuid, text) from public, anon;
grant execute on function public.admin_list_user_restrictions(uuid) to authenticated;
grant execute on function public.admin_restrict_user_capability(uuid, text, text, timestamptz) to authenticated;
grant execute on function public.admin_lift_user_restriction(uuid, text) to authenticated;

commit;
