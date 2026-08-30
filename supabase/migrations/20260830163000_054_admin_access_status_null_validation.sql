-- Keep admin access moderation explicit at the authoritative RPC boundary.
-- PostgreSQL `NOT IN` returns NULL for a NULL operand, so the previous guard
-- allowed p_next_status = NULL to fall through into the restore branch.

create or replace function public.admin_set_user_access(
  p_user_id uuid,
  p_next_status text,
  p_reason_code text
)
returns table(user_id uuid, access_status text, restriction_reason text)
language plpgsql
security definer
set search_path to 'public', 'private', 'auth', 'pg_temp'
as $function$
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

  if p_next_status is null or p_next_status not in ('approved', 'suspended') then
    raise exception 'invalid_access_status';
  end if;

  select *
  into v_previous
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception 'user_not_found';
  end if;

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
    set status = 'suspended', access_restriction_reason = v_reason
    where id = p_user_id
    returning * into v_result;

    insert into public.admin_audit_log(
      actor_id,
      action,
      target_type,
      target_id,
      reason_code,
      previous_state,
      new_state
    )
    values(
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

    if v_previous.email_kind = 'personal' and v_previous.identity_status <> 'verified' then
      raise exception 'identity_verification_required';
    end if;

    update public.profiles
    set status = 'approved', access_restriction_reason = null
    where id = p_user_id
    returning * into v_result;

    insert into public.admin_audit_log(
      actor_id,
      action,
      target_type,
      target_id,
      reason_code,
      previous_state,
      new_state
    )
    values(
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
$function$;
