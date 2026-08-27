-- UNEEM V2 audited user access moderation.
-- Apply after 018_backend_read_contract.sql.
--
-- Profile role/access fields are not a browser-write surface. Verification owns
-- pending -> approved identity transitions; this layer owns only explicit
-- student suspension/restoration with a structured reason and audit trail.

begin;

alter table public.profiles
  add column if not exists access_restriction_reason text;

-- Audit actors are application admins and therefore always profiles. Keep this
-- relation inside the application identity domain instead of coupling tests and
-- audit integrity to Supabase Auth's internal table shape.
alter table public.admin_audit_log
  drop constraint if exists admin_audit_log_actor_id_fkey;

alter table public.admin_audit_log
  add constraint admin_audit_log_actor_id_fkey
  foreign key (actor_id) references public.profiles(id) on delete restrict;

-- Close the legacy admin-table-write bypass. Safe profile edits, identity review
-- and access moderation already have narrow SECURITY DEFINER RPCs.
revoke update on public.profiles from authenticated;
drop policy if exists profiles_update_admin on public.profiles;

create or replace function public.get_my_account_state()
returns table (
  user_id uuid,
  role text,
  access_status text,
  email_kind text,
  identity_status text,
  student_id text,
  restriction_reason text,
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
    p.role,
    p.status,
    p.email_kind,
    p.identity_status,
    p.student_id,
    case
      when p.status = 'suspended' then p.access_restriction_reason
      else p.restriction_reason
    end,
    (p.status = 'approved'),
    (p.identity_status in ('required', 'rejected', 'conflict'))
  from public.profiles p
  where p.id = auth.uid();
$$;

revoke all on function public.get_my_account_state() from public, anon;
grant execute on function public.get_my_account_state() to authenticated;

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
    case
      when p.status = 'suspended' then p.access_restriction_reason
      else p.restriction_reason
    end,
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
    case
      when p.status = 'suspended' then p.access_restriction_reason
      else p.restriction_reason
    end,
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

create or replace function public.admin_set_user_access(
  p_user_id uuid,
  p_next_status text,
  p_reason_code text
)
returns table(
  user_id uuid,
  access_status text,
  restriction_reason text
)
language plpgsql
security definer
set search_path = public, private, auth, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_previous public.profiles%rowtype;
  v_result public.profiles%rowtype;
  v_reason text := btrim(coalesce(p_reason_code, ''));
begin
  if not private.is_admin() then
    raise exception 'admin_required';
  end if;

  if p_user_id is null then
    raise exception 'user_not_found';
  end if;

  if p_user_id = v_actor then
    raise exception 'cannot_moderate_self';
  end if;

  if p_next_status not in ('approved', 'suspended') then
    raise exception 'invalid_access_status';
  end if;

  select * into v_previous
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception 'user_not_found';
  end if;

  -- Admin identities require a stronger owner/bootstrap process and cannot be
  -- modified through routine student moderation.
  if v_previous.role <> 'student' then
    raise exception 'admin_user_target_not_student';
  end if;

  if p_next_status = 'suspended' then
    if v_reason not in ('conduct', 'safety', 'spam', 'fake_identity', 'booking_abuse', 'match_abuse', 'other') then
      raise exception 'invalid_suspend_reason';
    end if;

    if v_previous.status <> 'approved' then
      raise exception 'user_not_suspendable';
    end if;

    update public.profiles
    set status = 'suspended',
        access_restriction_reason = v_reason
    where id = p_user_id
    returning * into v_result;

    insert into public.admin_audit_log (
      actor_id, action, target_type, target_id, reason_code, previous_state, new_state
    ) values (
      v_actor,
      'user_suspended',
      'user',
      p_user_id,
      v_reason,
      jsonb_build_object(
        'status', v_previous.status,
        'identity_status', v_previous.identity_status,
        'access_restriction_reason', v_previous.access_restriction_reason
      ),
      jsonb_build_object(
        'status', v_result.status,
        'identity_status', v_result.identity_status,
        'access_restriction_reason', v_result.access_restriction_reason
      )
    );
  else
    if v_reason not in ('review_complete', 'appeal_approved', 'other') then
      raise exception 'invalid_restore_reason';
    end if;

    if v_previous.status <> 'suspended' then
      raise exception 'user_not_restorable';
    end if;

    -- A personal-email account must still satisfy its identity proof before
    -- sports access can be restored. Academic affiliation remains independent
    -- from optional Student ID verification.
    if v_previous.email_kind = 'personal' and v_previous.identity_status <> 'verified' then
      raise exception 'identity_verification_required';
    end if;

    update public.profiles
    set status = 'approved',
        access_restriction_reason = null
    where id = p_user_id
    returning * into v_result;

    insert into public.admin_audit_log (
      actor_id, action, target_type, target_id, reason_code, previous_state, new_state
    ) values (
      v_actor,
      'user_access_restored',
      'user',
      p_user_id,
      v_reason,
      jsonb_build_object(
        'status', v_previous.status,
        'identity_status', v_previous.identity_status,
        'access_restriction_reason', v_previous.access_restriction_reason
      ),
      jsonb_build_object(
        'status', v_result.status,
        'identity_status', v_result.identity_status,
        'access_restriction_reason', v_result.access_restriction_reason
      )
    );
  end if;

  return query
  select
    v_result.id,
    v_result.status,
    case
      when v_result.status = 'suspended' then v_result.access_restriction_reason
      else v_result.restriction_reason
    end;
end;
$$;

revoke all on function public.admin_set_user_access(uuid, text, text) from public, anon;
grant execute on function public.admin_set_user_access(uuid, text, text) to authenticated;

commit;
