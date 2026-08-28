-- Keep report context authoritative at the database boundary.
-- Client-side reason filtering and route IDs are UX only; this RPC must reject
-- mismatched reasons and stale/foreign concrete targets itself.

create or replace function public.create_my_report_thread(
  p_target_type text,
  p_target_id uuid,
  p_reason_code text,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, private
as $$
declare
  v_uid uuid := auth.uid();
  v_thread_id uuid;
  v_target_exists boolean := false;
begin
  if v_uid is null then
    raise exception 'authentication_required';
  end if;

  if p_target_type not in ('user', 'match', 'booking', 'facility', 'other')
    or p_target_id is null then
    raise exception 'invalid_report_target';
  end if;

  if p_reason_code not in (
    'harassment', 'unsafe_behavior', 'spam', 'fake_identity',
    'booking_issue', 'match_issue', 'facility_issue', 'other'
  ) then
    raise exception 'invalid_report_reason';
  end if;

  if not (
    p_reason_code = 'other'
    or (p_target_type = 'user' and p_reason_code in ('harassment', 'unsafe_behavior', 'spam', 'fake_identity'))
    or (p_target_type = 'match' and p_reason_code in ('harassment', 'unsafe_behavior', 'spam', 'match_issue'))
    or (p_target_type = 'booking' and p_reason_code = 'booking_issue')
    or (p_target_type = 'facility' and p_reason_code in ('unsafe_behavior', 'facility_issue'))
  ) then
    raise exception 'invalid_report_reason';
  end if;

  if char_length(trim(coalesce(p_body, ''))) not between 1 and 4000 then
    raise exception 'invalid_support_message';
  end if;

  if p_target_type = 'user' then
    select exists (
      select 1 from public.profiles
      where id = p_target_id and id <> v_uid
    ) into v_target_exists;
  elsif p_target_type = 'match' then
    select exists (
      select 1 from public.matches
      where id = p_target_id
    ) into v_target_exists;
  elsif p_target_type = 'booking' then
    select exists (
      select 1 from public.bookings
      where id = p_target_id and user_id = v_uid
    ) into v_target_exists;
  elsif p_target_type = 'facility' then
    select exists (
      select 1 from public.pitches
      where id = p_target_id
    ) into v_target_exists;
  else
    v_target_exists := true;
  end if;

  if not v_target_exists then
    raise exception 'invalid_report_target';
  end if;

  perform private.enforce_authenticated_thread_rate_limit(v_uid);
  perform private.enforce_authenticated_message_rate_limit(v_uid);

  insert into public.support_threads (
    user_id, kind, subject, target_type, target_id, reason_code
  )
  values (
    v_uid,
    'report',
    left('Report: ' || replace(p_reason_code, '_', ' '), 120),
    p_target_type,
    p_target_id,
    p_reason_code
  )
  returning id into v_thread_id;

  insert into public.support_messages (thread_id, sender_user_id, sender_role, body)
  values (v_thread_id, v_uid, 'user', trim(p_body));

  return v_thread_id;
end;
$$;
