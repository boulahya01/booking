-- Persist duplicate Student ID conflicts instead of raising after writing state.
-- PostgreSQL rolls back writes made before an exception, so review conflicts must
-- resolve the attempt and profile in-band while preserving the unique index as
-- the final race-safe identity invariant.
begin;

create or replace function public.review_identity_verification(
  p_attempt_id uuid,
  p_decision text,
  p_reason_code text default null
)
returns public.identity_verification_attempts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_attempt public.identity_verification_attempts%rowtype;
begin
  if not private.is_admin() then
    raise exception 'admin_required';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'invalid_review_decision';
  end if;

  select * into v_attempt
  from public.identity_verification_attempts
  where id = p_attempt_id
  for update;

  if not found or v_attempt.status <> 'pending' then
    raise exception 'verification_attempt_not_pending';
  end if;

  if p_decision = 'rejected' and btrim(coalesce(p_reason_code, '')) = '' then
    raise exception 'rejection_reason_required';
  end if;

  if p_decision = 'approved' then
    perform pg_advisory_xact_lock(hashtextextended(v_attempt.claimed_student_id, 17));

    if exists (
      select 1
      from public.profiles p
      where p.id <> v_attempt.user_id
        and p.identity_status = 'verified'
        and upper(btrim(p.student_id)) = upper(btrim(v_attempt.claimed_student_id))
    ) then
      update public.identity_verification_attempts
      set status = 'rejected',
          reason_code = 'duplicate_student_identity',
          reviewed_at = now(),
          reviewed_by = auth.uid()
      where id = p_attempt_id
      returning * into v_attempt;

      update public.profiles
      set identity_status = 'conflict',
          restriction_reason = 'duplicate_student_identity',
          updated_at = now()
      where id = v_attempt.user_id;

      return v_attempt;
    end if;
  end if;

  update public.identity_verification_attempts
  set status = p_decision,
      reason_code = case when p_decision = 'rejected' then p_reason_code else null end,
      reviewed_at = now(),
      reviewed_by = auth.uid()
  where id = p_attempt_id
  returning * into v_attempt;

  if p_decision = 'approved' then
    begin
      update public.profiles
      set student_id = upper(btrim(v_attempt.claimed_student_id)),
          identity_status = 'verified',
          restriction_reason = null,
          verified_student_id_at = now(),
          status = case when status = 'pending' then 'approved' else status end,
          updated_at = now()
      where id = v_attempt.user_id;
    exception
      when unique_violation then
        update public.identity_verification_attempts
        set status = 'rejected',
            reason_code = 'duplicate_student_identity'
        where id = p_attempt_id
        returning * into v_attempt;

        update public.profiles
        set identity_status = 'conflict',
            restriction_reason = 'duplicate_student_identity',
            updated_at = now()
        where id = v_attempt.user_id;

        return v_attempt;
    end;
  else
    update public.profiles
    set identity_status = 'rejected',
        restriction_reason = p_reason_code,
        updated_at = now()
    where id = v_attempt.user_id;
  end if;

  return v_attempt;
end;
$$;

revoke all on function public.review_identity_verification(uuid, text, text) from public, anon;
grant execute on function public.review_identity_verification(uuid, text, text) to authenticated;

commit;
