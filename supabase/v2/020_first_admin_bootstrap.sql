-- UNEEM V2 one-time first-admin bootstrap.
-- Apply after 019_user_access_moderation.sql.
--
-- This operation is intentionally NOT an application RPC. It lives in the
-- private schema, is executable only by its database owner, and is used once
-- from the trusted Supabase SQL/owner context after the chosen Auth account has
-- been created and verified. Never expose this through browser/server API keys.

begin;

create table if not exists private.admin_bootstrap_log (
  singleton boolean primary key default true check (singleton),
  target_profile_id uuid not null references public.profiles(id) on delete restrict,
  previous_state jsonb not null,
  new_state jsonb not null,
  executed_at timestamptz not null default now()
);

revoke all on private.admin_bootstrap_log from public, anon, authenticated, service_role;

create or replace function private.bootstrap_first_admin(
  p_user_id uuid
)
returns public.profiles
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_previous public.profiles%rowtype;
  v_result public.profiles%rowtype;
begin
  if p_user_id is null then
    raise exception 'bootstrap_user_required';
  end if;

  -- Protect the zero-admin -> one-admin transition even if two owner sessions
  -- accidentally attempt bootstrap at the same time.
  perform pg_advisory_xact_lock(hashtextextended('uneem:first-admin-bootstrap', 0));

  if exists (select 1 from public.profiles p where p.role = 'admin')
     or exists (select 1 from private.admin_bootstrap_log) then
    raise exception 'first_admin_already_exists';
  end if;

  select * into v_previous
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception 'profile_not_found';
  end if;

  if v_previous.role <> 'student' then
    raise exception 'bootstrap_target_not_student';
  end if;

  update public.profiles
  set role = 'admin',
      status = 'approved',
      access_restriction_reason = null
  where id = p_user_id
  returning * into v_result;

  insert into private.admin_bootstrap_log (
    target_profile_id,
    previous_state,
    new_state
  ) values (
    p_user_id,
    jsonb_build_object(
      'role', v_previous.role,
      'status', v_previous.status,
      'email_kind', v_previous.email_kind,
      'identity_status', v_previous.identity_status
    ),
    jsonb_build_object(
      'role', v_result.role,
      'status', v_result.status,
      'email_kind', v_result.email_kind,
      'identity_status', v_result.identity_status
    )
  );

  return v_result;
end;
$$;

-- PostgreSQL function execution is otherwise granted to PUBLIC by default.
-- Leave database-owner execution intact but explicitly close every API role.
revoke all on function private.bootstrap_first_admin(uuid) from public, anon, authenticated, service_role;

commit;
