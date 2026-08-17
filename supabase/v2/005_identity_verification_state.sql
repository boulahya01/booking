-- UNEEM V2 identity verification + recoverable account-state foundation.
-- Apply after 004_availability_window.sql.
--
-- Access and identity proof are deliberately separate:
--   * confirmed @usmba.ac.ma email may grant normal student access immediately
--   * Student ID is trusted only after student-card review
--   * personal-email accounts remain restricted until manual verification succeeds

begin;

alter table public.profiles
  alter column student_id drop not null;

-- An unverified claim must never reserve a Student ID globally. The original
-- baseline unique constraint is replaced by a verified-only unique index below.
alter table public.profiles
  drop constraint if exists profiles_student_id_key;

alter table public.profiles
  add column if not exists email_kind text not null default 'personal'
    check (email_kind in ('academic', 'personal')),
  add column if not exists identity_status text not null default 'required'
    check (identity_status in ('required', 'pending', 'verified', 'rejected', 'conflict')),
  add column if not exists restriction_reason text,
  add column if not exists verified_student_id_at timestamptz;

alter table public.profiles
  drop constraint if exists profiles_student_id_not_blank;

alter table public.profiles
  add constraint profiles_student_id_not_blank
  check (student_id is null or btrim(student_id) <> '');

create unique index if not exists profiles_verified_student_id_unique_idx
  on public.profiles (student_id)
  where identity_status = 'verified' and student_id is not null;

create table if not exists public.identity_verification_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  claimed_student_id text not null,
  card_storage_path text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  reason_code text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint identity_attempt_student_id_format
    check (claimed_student_id ~ '^[A-Z][0-9]{9}$'),
  constraint identity_attempt_card_path_not_blank
    check (btrim(card_storage_path) <> ''),
  constraint identity_attempt_review_state check (
    (status = 'pending' and reviewed_at is null and reviewed_by is null)
    or status <> 'pending'
  )
);

create unique index if not exists identity_one_pending_attempt_per_user_idx
  on public.identity_verification_attempts (user_id)
  where status = 'pending';

create index if not exists identity_attempts_review_queue_idx
  on public.identity_verification_attempts (status, submitted_at);

alter table public.identity_verification_attempts enable row level security;
revoke all on public.identity_verification_attempts from anon, authenticated;
grant select on public.identity_verification_attempts to authenticated;

create policy identity_attempts_select_own_or_admin
on public.identity_verification_attempts
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select private.is_admin())
);

-- Replace V2 onboarding so personal-email users can create a restricted account,
-- while academic-email users get the fast path after email confirmation.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_student_id text;
  v_full_name text;
  v_email text := lower(btrim(coalesce(new.email, '')));
  v_email_kind text;
begin
  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'invalid_email';
  end if;

  v_email_kind := case
    when split_part(v_email, '@', 2) = 'usmba.ac.ma' then 'academic'
    else 'personal'
  end;

  v_full_name := btrim(coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  if char_length(v_full_name) < 2 or char_length(v_full_name) > 120 then
    raise exception 'invalid_full_name';
  end if;

  v_student_id := upper(regexp_replace(coalesce(new.raw_user_meta_data ->> 'student_id', ''), '\s+', '', 'g'));
  if v_student_id = '' then
    v_student_id := null;
  elsif v_student_id !~ '^[A-Z][0-9]{9}$' then
    raise exception 'invalid_student_id';
  end if;

  -- Academic signup may defer Student ID entirely. Personal-email signup must
  -- provide a claim so the manual verification flow has an identity to review.
  if v_email_kind = 'personal' and v_student_id is null then
    raise exception 'student_id_required_for_personal_email';
  end if;

  insert into public.profiles (
    id,
    student_id,
    full_name,
    role,
    status,
    email_kind,
    identity_status
  ) values (
    new.id,
    v_student_id,
    v_full_name,
    'student',
    'pending',
    v_email_kind,
    'required'
  );

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

create or replace function private.handle_email_confirmation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    update public.profiles
    set status = case
          when email_kind = 'academic' and status = 'pending' then 'approved'
          else status
        end,
        updated_at = now()
    where id = new.id;
  end if;

  return new;
end;
$$;

revoke all on function private.handle_email_confirmation() from public, anon, authenticated;

-- One narrow payload drives routing and status UI without repeated profile reads.
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
    p.restriction_reason,
    (p.status = 'approved') as can_use_sports,
    (p.identity_status in ('required', 'rejected', 'conflict')) as needs_identity_action
  from public.profiles p
  where p.id = auth.uid();
$$;

revoke all on function public.get_my_account_state() from public, anon;
grant execute on function public.get_my_account_state() to authenticated;

-- Submit a new attempt on the same account. The client uploads the card to a
-- private bucket first, then submits only its private object path here.
create or replace function public.submit_identity_verification(
  p_student_id text,
  p_card_storage_path text
)
returns public.identity_verification_attempts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_student_id text := upper(regexp_replace(coalesce(p_student_id, ''), '\s+', '', 'g'));
  v_attempt public.identity_verification_attempts;
begin
  if v_user_id is null then
    raise exception 'authentication_required';
  end if;

  if v_student_id !~ '^[A-Z][0-9]{9}$' then
    raise exception 'invalid_student_id';
  end if;

  if btrim(coalesce(p_card_storage_path, '')) = '' then
    raise exception 'student_card_required';
  end if;

  -- This is only an early UX guard. The approval path below takes an advisory
  -- lock and the partial unique index is the final race-safe invariant.
  if exists (
    select 1
    from public.profiles p
    where p.student_id = v_student_id
      and p.id <> v_user_id
      and p.identity_status = 'verified'
  ) then
    update public.profiles
    set identity_status = 'conflict',
        restriction_reason = 'duplicate_student_identity'
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
    btrim(p_card_storage_path)
  ) returning * into v_attempt;

  update public.profiles
  set student_id = v_student_id,
      identity_status = 'pending',
      restriction_reason = null
  where id = v_user_id;

  return v_attempt;
end;
$$;

revoke all on function public.submit_identity_verification(text, text) from public, anon;
grant execute on function public.submit_identity_verification(text, text) to authenticated;

-- Admin review is structured and atomic. Rejections retain the same account and
-- map to a remediation reason; approval can unlock personal-email accounts.
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
    -- Serialize competing approvals for the same Student ID. The partial unique
    -- index below remains the final protection if two transactions still collide.
    perform pg_advisory_xact_lock(hashtextextended(v_attempt.claimed_student_id, 17));

    if exists (
      select 1
      from public.profiles p
      where p.student_id = v_attempt.claimed_student_id
        and p.id <> v_attempt.user_id
        and p.identity_status = 'verified'
    ) then
      update public.profiles
      set identity_status = 'conflict',
          restriction_reason = 'duplicate_student_identity'
      where id = v_attempt.user_id;
      raise exception 'identity_claim_unavailable';
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
      set student_id = v_attempt.claimed_student_id,
          identity_status = 'verified',
          restriction_reason = null,
          verified_student_id_at = now(),
          status = case when status = 'pending' then 'approved' else status end
      where id = v_attempt.user_id;
    exception
      when unique_violation then
        update public.profiles
        set identity_status = 'conflict',
            restriction_reason = 'duplicate_student_identity'
        where id = v_attempt.user_id;
        raise exception 'identity_claim_unavailable';
    end;
  else
    update public.profiles
    set identity_status = 'rejected',
        restriction_reason = p_reason_code
    where id = v_attempt.user_id;
  end if;

  return v_attempt;
end;
$$;

revoke all on function public.review_identity_verification(uuid, text, text) from public, anon;
grant execute on function public.review_identity_verification(uuid, text, text) to authenticated;

commit;
