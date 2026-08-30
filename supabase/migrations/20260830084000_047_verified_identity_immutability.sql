begin;

create or replace function public.submit_identity_verification(
  p_student_id text,
  p_card_storage_path text
)
returns public.identity_verification_attempts
language plpgsql
security definer
set search_path to 'public', 'storage', 'pg_temp'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_student_id text := upper(regexp_replace(coalesce(p_student_id, ''), '\s+', '', 'g'));
  v_card_path text := btrim(coalesce(p_card_storage_path, ''));
  v_profile public.profiles%rowtype;
  v_attempt public.identity_verification_attempts;
begin
  if v_user_id is null then
    raise exception 'authentication_required';
  end if;

  -- Submission and review already share this user-scoped lock. Keep the
  -- verified-state check inside that same boundary so a stale client cannot
  -- resubmit immediately after an approval commits.
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 41));

  select p.*
  into v_profile
  from public.profiles p
  where p.id = v_user_id
  for update;

  if not found then
    raise exception 'profile_not_found';
  end if;

  -- A verified Student ID is an authoritative identity claim, not editable
  -- profile metadata. Any future correction needs an explicit privileged
  -- recovery flow; a normal client must not release or replace the claim.
  if v_profile.identity_status = 'verified' then
    raise exception 'identity_already_verified';
  end if;

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
$function$;

revoke all on function public.submit_identity_verification(text, text) from public, anon;
grant execute on function public.submit_identity_verification(text, text) to authenticated;

commit;
