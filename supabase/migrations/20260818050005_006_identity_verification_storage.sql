-- UNEEM V2 private student-card evidence + recoverable verification queue.
-- Apply after 005_identity_verification_state.sql.

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'student-verification',
  'student-verification',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Evidence paths are always scoped as <auth.uid()>/<random-name>.<ext>.
-- Students may manage only their own private evidence; admins may read evidence
-- for review but cannot silently replace a student's upload.
drop policy if exists verification_objects_insert_own on storage.objects;
create policy verification_objects_insert_own
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'student-verification'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists verification_objects_select_own_or_admin on storage.objects;
create policy verification_objects_select_own_or_admin
on storage.objects
for select
to authenticated
using (
  bucket_id = 'student-verification'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (select private.is_admin())
  )
);

drop policy if exists verification_objects_delete_own on storage.objects;
create policy verification_objects_delete_own
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'student-verification'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- Restrict rejection reasons to remediation states that the product knows how to
-- explain and resolve. duplicate_student_identity intentionally requires Help /
-- recovery rather than allowing a field edit that could bypass identity safety.
alter table public.identity_verification_attempts
  drop constraint if exists identity_attempt_reason_code_allowed;

alter table public.identity_verification_attempts
  add constraint identity_attempt_reason_code_allowed check (
    reason_code is null
    or reason_code in (
      'student_id_incorrect',
      'student_card_unreadable',
      'name_mismatch',
      'duplicate_student_identity',
      'not_a_student_card',
      'student_card_expired',
      'superseded_by_resubmission'
    )
  );

-- Recreate submission with path ownership validation. The database never trusts
-- a client-provided path that points at another student's evidence object.
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

  if exists (
    select 1
    from public.profiles p
    where p.student_id = v_student_id
      and p.id <> v_user_id
      and p.identity_status = 'verified'
  ) then
    update public.profiles
    set identity_status = 'conflict',
        restriction_reason = 'duplicate_student_identity',
        updated_at = now()
    where id = v_user_id;
    raise exception 'identity_claim_unavailable';
  end if;

  update public.identity_verification_attempts
  set status = 'cancelled',
      reviewed_at = now(),
      reason_code = 'superseded_by_resubmission'
  where user_id = v_user_id
    and status = 'pending';

  insert into public.identity_verification_attempts (
    user_id,
    claimed_student_id,
    card_storage_path
  ) values (
    v_user_id,
    v_student_id,
    v_card_path
  ) returning * into v_attempt;

  update public.profiles
  set student_id = v_student_id,
      identity_status = 'pending',
      restriction_reason = null,
      updated_at = now()
  where id = v_user_id;

  return v_attempt;
end;
$$;

revoke all on function public.submit_identity_verification(text, text) from public, anon;
grant execute on function public.submit_identity_verification(text, text) to authenticated;

-- Admin queue returns only review-relevant account context. Student email and
-- unrelated private profile information are deliberately omitted.
create or replace function public.list_identity_verification_queue()
returns table (
  attempt_id uuid,
  user_id uuid,
  full_name text,
  email_kind text,
  claimed_student_id text,
  card_storage_path text,
  submitted_at timestamptz,
  previous_reason_code text,
  attempt_count bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    a.id,
    a.user_id,
    p.full_name,
    p.email_kind,
    a.claimed_student_id,
    a.card_storage_path,
    a.submitted_at,
    (
      select old.reason_code
      from public.identity_verification_attempts old
      where old.user_id = a.user_id
        and old.id <> a.id
        and old.status = 'rejected'
      order by old.reviewed_at desc nulls last
      limit 1
    ) as previous_reason_code,
    (
      select count(*)
      from public.identity_verification_attempts all_attempts
      where all_attempts.user_id = a.user_id
    ) as attempt_count
  from public.identity_verification_attempts a
  join public.profiles p on p.id = a.user_id
  where a.status = 'pending'
    and private.is_admin()
  order by a.submitted_at asc;
$$;

revoke all on function public.list_identity_verification_queue() from public, anon;
grant execute on function public.list_identity_verification_queue() to authenticated;

commit;
