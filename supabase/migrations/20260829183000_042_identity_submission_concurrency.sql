-- Serialize identity resubmission and admin review per user so a review cannot
-- race a replacement attempt and leave profile state inconsistent with the
-- reviewed evidence.
begin;

create or replace function public.submit_identity_verification(
  p_student_id text,
  p_card_storage_path text
)
returns public.identity_verification_attempts
language plpgsql
security definer
set search_path = public, storage, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_student_id text := upper(regexp_replace(coalesce(p_student_id, ''), '\s+', '', 'g'));
  v_card_path text := btrim(coalesce(p_card_storage_path, ''));
  v_attempt public.identity_verification_attempts;
begin
  if v_user_id is null then
    raise exception 'authentication_required';
  end if;

  -- This lock is shared with review_identity_verification(). It serializes all
  -- identity-attempt state transitions for one user, including rapid double
  -- submissions and a submission racing an administrator review.
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 41));

  if v_student_id !~ '^[A-Z][0-9]{9}$' then
    raise exception 'invalid_student_id';
  end if;

  if v_card_path = '' then
    raise exception 'student_card_required';
  end if;

  if split_part(v_card_path, '/', 1) <> v_user_id::text then
    raise exception 'invalid_student_card_path';
  end if;

  if not exists (
    select 1
    from storage.objects o
    where o.bucket_id = 'student-verification'
      and o.name = v_card_path
      and (storage.foldername(o.name))[1] = v_user_id::text
  ) then
    raise exception 'student_card_not_found';
  end if;

  update public.identity_verification_attempts
  set status = 'cancelled',
      reviewed_at = now(),
      reason_code = 'superseded_by_resubmission'
  where user_id = v_user_id
    and status = 'pending';

  if exists (
    select 1
    from public.profiles p
    where p.id <> v_user_id
      and p.identity_status = 'verified'
      and upper(btrim(p.student_id)) = v_student_id
  ) then
    insert into public.identity_verification_attempts (
      user_id,
      claimed_student_id,
      card_storage_path,
      status,
      reason_code,
      reviewed_at
    ) values (
      v_user_id,
      v_student_id,
      v_card_path,
      'rejected',
      'duplicate_student_identity',
      now()
    )
    returning * into v_attempt;

    update public.profiles
    set student_id = v_student_id,
        identity_status = 'conflict',
        restriction_reason = 'duplicate_student_identity',
        updated_at = now()
    where id = v_user_id;

    return v_attempt;
  end if;

  insert into public.identity_verification_attempts (
    user_id,
    claimed_student_id,
    card_storage_path
  ) values (
    v_user_id,
    v_student_id,
    v_card_path
  )
  returning * into v_attempt;

  update public.profiles
  set student_id = v_student_id,
      identity_status = 'pending',
      restriction_reason = null,
      updated_at = now()
  where id = v_user_id;

  return v_attempt;
end;
$$;

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
  v_user_id uuid;
begin
  if not private.is_admin() then
    raise exception 'admin_required';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'invalid_review_decision';
  end if;

  -- Resolve the immutable owner first, then acquire the same per-user lock used
  -- by submissions before taking the attempt row lock. This avoids lock-order
  -- inversion and makes review/resubmission deterministic.
  select a.user_id into v_user_id
  from public.identity_verification_attempts a
  where a.id = p_attempt_id;

  if not found then
    raise exception 'verification_attempt_not_pending';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 41));

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

revoke all on function public.submit_identity_verification(text, text) from public, anon;
grant execute on function public.submit_identity_verification(text, text) to authenticated;
revoke all on function public.review_identity_verification(uuid, text, text) from public, anon;
grant execute on function public.review_identity_verification(uuid, text, text) to authenticated;

commit;
