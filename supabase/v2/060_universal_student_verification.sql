-- UNEEM v2.1: browse after email confirmation; participate after ID approval.
-- Student IDs accept s/S followed by digits and are stored uppercase (max 50 chars).
-- Existing verified identities and moderation history are preserved.
begin;

alter table public.profiles drop constraint profiles_student_id_canonical_format;
alter table public.profiles add constraint profiles_student_id_canonical_format
  check (student_id is null or student_id ~ '^S[0-9]{1,49}$');
alter table public.identity_verification_attempts drop constraint identity_attempt_student_id_format;
alter table public.identity_verification_attempts add constraint identity_attempt_student_id_format
  check (status in ('rejected', 'cancelled') or claimed_student_id ~ '^S[0-9]{1,49}$');

create or replace function private.has_browse_access()
returns boolean language sql stable security definer
set search_path = public, private, auth, pg_temp
as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid()
    and p.status <> 'suspended' and private.is_email_confirmed(p.id));
$$;
revoke all on function private.has_browse_access() from public, anon;
grant execute on function private.has_browse_access() to authenticated;

create or replace function private.require_browse_access(p_user_id uuid)
returns void language plpgsql stable security definer
set search_path = public, private, auth, pg_temp
as $$
begin
  if p_user_id is null or auth.uid() is null then raise exception 'authentication_required'; end if;
  if p_user_id <> auth.uid() or not private.has_browse_access() then raise exception 'account_not_approved'; end if;
end;
$$;
revoke all on function private.require_browse_access(uuid) from public, anon, authenticated, service_role;

create or replace function private.has_app_access()
returns boolean language sql stable security definer
set search_path = public, private, auth, pg_temp
as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid()
    and p.status = 'approved' and p.identity_status = 'verified'
    and p.student_id ~ '^S[0-9]{1,49}$' and private.is_email_confirmed(p.id));
$$;
revoke all on function private.has_app_access() from public, anon;
grant execute on function private.has_app_access() to authenticated;

drop policy pitches_select on public.pitches;
create policy pitches_select on public.pitches for select to authenticated
  using ((select private.is_admin()) or (is_active and (select private.has_browse_access())));

-- Confirmation proves the mailbox, never the student identity.
create or replace function private.handle_email_confirmation()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    update public.profiles
    set status = case when identity_status = 'verified' and status = 'pending' then 'approved' else status end,
        updated_at = now()
    where id = new.id;
  end if;
  return new;
end;
$$;

-- A student claim can be supplied later, during verification, for every email.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_student_id text;
  v_full_name text;
  v_username text;
  v_email text := lower(btrim(coalesce(new.email, '')));
  v_email_kind text;
begin
  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'invalid_email';
  end if;

  -- Supabase may internally attempt an insert while handling a repeat signup.
  -- If a real Auth user already owns this normalized email, do not let the
  -- profile trigger turn Supabase's duplicate-account handling into a 500.
  if exists (
    select 1
    from auth.users u
    where u.id <> new.id
      and lower(btrim(coalesce(u.email, ''))) = v_email
  ) then
    return new;
  end if;

  v_email_kind := case
    when split_part(v_email, '@', 2) = 'usmba.ac.ma' then 'academic'
    else 'personal'
  end;

  v_full_name := btrim(coalesce(new.raw_user_meta_data->>'full_name', ''));
  if char_length(v_full_name) < 2 or char_length(v_full_name) > 120 then
    raise exception 'invalid_full_name';
  end if;

  v_username := lower(btrim(coalesce(new.raw_user_meta_data->>'username', '')));
  if v_username !~ '^[a-z0-9_]{3,24}$' then
    raise exception 'invalid_username';
  end if;

  v_student_id := upper(regexp_replace(coalesce(new.raw_user_meta_data->>'student_id', ''), '\s+', '', 'g'));
  if v_student_id = '' then
    v_student_id := null;
  elsif v_student_id !~ '^S[0-9]{1,49}$' then
    raise exception 'invalid_student_id';
  end if;

  insert into public.profiles (
    id, student_id, full_name, username, role, status, email_kind, identity_status
  ) values (
    new.id, v_student_id, v_full_name, v_username,
    'student', 'pending', v_email_kind, 'required'
  );

  return new;
exception
  when unique_violation then
    raise exception 'registration_conflict';
end;
$$;

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
set search_path = public, private, auth, pg_temp
as $$
  select
    p.id,
    p.role,
    p.status,
    p.email_kind,
    p.identity_status,
    p.student_id,
    case
      when not private.is_email_confirmed(p.id) then 'email_confirmation_required'
      when p.status = 'suspended' then p.access_restriction_reason
      else p.restriction_reason
    end,
    (private.has_app_access()),
    (p.identity_status in ('required', 'rejected', 'conflict'))
  from public.profiles p
  where p.id = auth.uid();
$$;

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
set search_path = public, private, auth, pg_temp
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
      when not private.is_email_confirmed(p.id) then 'email_confirmation_required'
      when p.status = 'suspended' then p.access_restriction_reason
      else p.restriction_reason
    end,
    p.verified_student_id_at,
    p.created_at,
    p.updated_at,
    private.has_app_access(),
    p.identity_status in ('required', 'rejected', 'conflict')
  from public.profiles p
  where p.id = auth.uid();
$$;

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
  if not private.is_email_confirmed(v_user_id) then raise exception 'email_confirmation_required'; end if;
  if v_profile.status = 'suspended' then raise exception 'account_suspended'; end if;

  if v_profile.identity_status = 'verified' then
    raise exception 'identity_already_verified';
  end if;

  if v_student_id !~ '^S[0-9]{1,49}$' then
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

-- Corrections and admin review share the existing per-user lock. A pending
-- correction replaces the attempt, preserving its evidence and review history.
create or replace function public.update_my_student_id(p_student_id text)
returns void language plpgsql security definer set search_path = public, private, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_id text := upper(regexp_replace(coalesce(p_student_id, ''), '\s+', '', 'g'));
  v_profile public.profiles%rowtype;
  v_path text;
begin
  if v_uid is null then raise exception 'authentication_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 41));
  select * into v_profile from public.profiles where id = v_uid for update;
  if not found then raise exception 'profile_not_found'; end if;
  if v_profile.identity_status = 'verified' then raise exception 'identity_already_verified'; end if;
  if not private.is_email_confirmed(v_uid) then raise exception 'email_confirmation_required'; end if;
  if v_profile.status = 'suspended' then raise exception 'account_suspended'; end if;
  if v_id !~ '^S[0-9]{1,49}$' then raise exception 'invalid_student_id'; end if;
  if v_profile.student_id = v_id then return; end if;

  select card_storage_path into v_path from public.identity_verification_attempts
    where user_id = v_uid and status = 'pending' order by submitted_at desc limit 1;
  if v_path is not null then
    perform public.submit_identity_verification(v_id, v_path);
  else
    update public.profiles set student_id = v_id, identity_status = 'required',
      restriction_reason = null, updated_at = now() where id = v_uid;
  end if;
end;
$$;
revoke all on function public.update_my_student_id(text) from public, anon;
grant execute on function public.update_my_student_id(text) to authenticated;

-- Read models retain their existing row scope and privacy rules. Only their
-- entry capability changes; sports mutations still require verified identity.
create or replace function public.get_pitch_availability(p_pitch_id uuid)
returns table (
  booking_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  timezone text,
  is_available boolean,
  booked_by_me boolean,
  booker_name text,
  booker_username text,
  match_id uuid,
  match_open boolean,
  capacity integer,
  reserved_spots integer,
  joined_count integer,
  spots_left integer
)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_pitch public.pitches%rowtype;
  v_window_start timestamptz := now();
  v_window_end timestamptz;
  v_local_start timestamp;
  v_start_date date;
  v_end_date date;
  v_step interval;
  v_overnight boolean;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not private.has_browse_access() then raise exception 'account_not_approved'; end if;

  select * into v_pitch from public.pitches p where p.id = p_pitch_id and p.is_active = true;
  if not found then raise exception 'pitch_not_found'; end if;

  v_window_end := v_window_start + make_interval(hours => least(coalesce(v_pitch.booking_window_hours, 24), 24));
  v_local_start := v_window_start at time zone v_pitch.timezone;
  v_overnight := v_pitch.close_time < v_pitch.open_time;
  v_start_date := v_local_start::date;
  if v_overnight and v_local_start::time < v_pitch.close_time then v_start_date := v_start_date - 1; end if;
  v_end_date := (v_window_end at time zone v_pitch.timezone)::date;
  v_step := make_interval(mins => v_pitch.slot_duration_minutes);

  return query
  with local_days as (
    select day_value::date as local_day
    from generate_series(v_start_date, v_end_date, interval '1 day') day_value
  ), generated as (
    select gs as generated_start, gs + v_step as generated_end
    from local_days d
    cross join lateral generate_series(
      (d.local_day::timestamp + v_pitch.open_time) at time zone v_pitch.timezone,
      (d.local_day::timestamp + v_pitch.close_time + case when v_overnight then interval '1 day' else interval '0 day' end) at time zone v_pitch.timezone - v_step,
      v_step
    ) gs
    where gs >= v_window_start and gs < v_window_end
  )
  select
    b.id,
    g.generated_start,
    g.generated_end,
    v_pitch.timezone,
    b.id is null,
    coalesce(b.user_id = auth.uid(), false),
    booker.full_name,
    booker.username,
    m.id,
    coalesce(m.status = 'active' and m.visibility = 'open', false),
    v_pitch.capacity,
    coalesce(m.reserved_spots, 0) + coalesce(reservation_stats.named_reserved, 0),
    coalesce(participant_stats.joined_count, 0),
    case when m.status = 'active' and m.visibility = 'open' then greatest(
      v_pitch.capacity - 1 - coalesce(m.reserved_spots, 0) - coalesce(reservation_stats.named_reserved, 0) - coalesce(participant_stats.joined_count, 0), 0
    ) else 0 end
  from generated g
  left join public.bookings b on b.pitch_id = p_pitch_id and b.status = 'scheduled'
    and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(g.generated_start, g.generated_end, '[)')
  left join public.profiles booker on booker.id = b.user_id
  left join public.matches m on m.booking_id = b.id and m.status = 'active'
  left join lateral (
    select count(*)::integer as joined_count from public.match_participants mp where mp.match_id = m.id
  ) participant_stats on true
  left join lateral (
    select count(*)::integer as named_reserved from public.match_reservations mr where mr.match_id = m.id
  ) reservation_stats on true
  order by g.generated_start;
end;
$$;

create or replace function public.get_pitch_availability(
  p_pitch_id uuid,
  p_local_date date
)
returns table (
  starts_at timestamptz,
  ends_at timestamptz,
  is_available boolean,
  booker_name text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_pitch public.pitches%rowtype;
  v_open timestamptz;
  v_close timestamptz;
  v_step interval;
  v_overnight boolean;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  if not private.has_browse_access() then
    raise exception 'account_not_approved';
  end if;

  select * into v_pitch
  from public.pitches p
  where p.id = p_pitch_id
    and p.is_active = true;

  if not found then
    raise exception 'pitch_not_found';
  end if;

  v_step := make_interval(mins => v_pitch.slot_duration_minutes);
  v_overnight := v_pitch.close_time < v_pitch.open_time;
  v_open := (p_local_date::timestamp + v_pitch.open_time) at time zone v_pitch.timezone;
  v_close := (
    p_local_date::timestamp
    + v_pitch.close_time
    + case when v_overnight then interval '1 day' else interval '0 day' end
  ) at time zone v_pitch.timezone;

  return query
  with generated as (
    select gs as generated_start, gs + v_step as generated_end
    from generate_series(v_open, v_close - v_step, v_step) gs
    where gs >= now()
      and gs < now() + make_interval(hours => least(coalesce(v_pitch.booking_window_hours, 24), 24))
  )
  select
    g.generated_start,
    g.generated_end,
    b.id is null as is_available,
    p.full_name as booker_name
  from generated g
  left join public.bookings b
    on b.pitch_id = p_pitch_id
   and b.status = 'scheduled'
   and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(g.generated_start, g.generated_end, '[)')
  left join public.profiles p
    on p.id = b.user_id
   and b.user_id = auth.uid()
  order by g.generated_start;
end;
$$;

create or replace function public.get_booking_details(p_booking_id uuid)
returns table (
  booking_id uuid, pitch_id uuid, pitch_name text, location text, timezone text, sport_type text,
  starts_at timestamptz, ends_at timestamptz, booking_status text,
  booker_id uuid, booker_name text, booker_username text, capacity integer,
  booked_by_me boolean, match_id uuid, match_visibility text, match_open boolean,
  reserved_spots integer, joined_count integer, spots_left integer,
  participant_by_me boolean, reserved_by_me boolean
)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid();
begin
  perform private.require_browse_access(v_uid);
  return query
  select
    b.id, p.id, p.name, p.location, p.timezone, p.sport_type,
    b.starts_at, b.ends_at, b.status,
    owner.id, owner.full_name, owner.username, p.capacity,
    b.user_id = v_uid,
    case when m.visibility = 'open' or b.user_id = v_uid then m.id else null end,
    coalesce(m.visibility, 'private'),
    coalesce(m.status = 'active' and m.visibility = 'open', false),
    coalesce(m.reserved_spots, 0) + coalesce(reservation_stats.named_reserved, 0),
    coalesce(participant_stats.joined_count, 0),
    case when m.status = 'active' and m.visibility = 'open' then greatest(
      p.capacity - 1 - coalesce(m.reserved_spots, 0) - coalesce(reservation_stats.named_reserved, 0) - coalesce(participant_stats.joined_count, 0), 0
    ) else 0 end,
    coalesce(participant_stats.joined_by_me, false),
    coalesce(reservation_stats.reserved_by_me, false)
  from public.bookings b
  join public.pitches p on p.id = b.pitch_id
  join public.profiles owner on owner.id = b.user_id
  left join public.matches m on m.booking_id = b.id and m.status = 'active'
  left join lateral (
    select count(*)::integer as joined_count,
      coalesce(bool_or(mp.user_id = v_uid), false) as joined_by_me
    from public.match_participants mp where mp.match_id = m.id
  ) participant_stats on true
  left join lateral (
    select count(*)::integer as named_reserved,
      coalesce(bool_or(mr.profile_id = v_uid), false) as reserved_by_me
    from public.match_reservations mr where mr.match_id = m.id
  ) reservation_stats on true
  where b.id = p_booking_id and (b.status = 'scheduled' or b.user_id = v_uid)
  limit 1;
end;
$$;

create or replace function public.list_booking_roster(p_booking_id uuid)
returns table (
  entry_id text, reservation_id uuid, user_id uuid, display_name text, username text,
  member_role text, source text, joined_at timestamptz
)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid();
begin
  perform private.require_browse_access(v_uid);
  return query
  with context as (
    select b.id as booking_id, b.user_id as organizer_id, b.status as booking_status, m.id as match_id, m.visibility
    from public.bookings b
    left join public.matches m on m.booking_id = b.id and m.status = 'active'
    where b.id = p_booking_id and (b.status = 'scheduled' or b.user_id = v_uid)
  )
  select roster.entry_id, roster.reservation_id, roster.user_id, roster.display_name, roster.username,
    roster.member_role, roster.source, roster.joined_at
  from (
    select 'organizer:' || o.id::text as entry_id, null::uuid as reservation_id, o.id as user_id,
      o.full_name as display_name, o.username, 'organizer'::text as member_role, 'account'::text as source,
      b.created_at as joined_at, 0 as sort_order
    from public.bookings b join context c on c.booking_id = b.id join public.profiles o on o.id = b.user_id
    union all
    select 'player:' || mp.user_id::text, null::uuid, player.id, player.full_name, player.username,
      'player'::text, 'joined'::text, mp.joined_at, 1
    from context c join public.match_participants mp on mp.match_id = c.match_id join public.profiles player on player.id = mp.user_id
    where c.visibility = 'open' or c.organizer_id = v_uid
    union all
    select 'reservation:' || mr.id::text, mr.id, reserved_profile.id,
      coalesce(reserved_profile.full_name, mr.guest_name), reserved_profile.username,
      'reserved'::text, case when mr.profile_id is null then 'guest' else 'registered' end,
      mr.created_at, 2
    from context c join public.match_reservations mr on mr.match_id = c.match_id
    left join public.profiles reserved_profile on reserved_profile.id = mr.profile_id
    where c.visibility = 'open' or c.organizer_id = v_uid
  ) roster
  order by sort_order, joined_at, display_name;
end;
$$;

create or replace function public.list_open_matches()
returns table(
  match_id uuid, booking_id uuid, pitch_id uuid, pitch_name text, location text, timezone text, sport_type text,
  starts_at timestamptz, ends_at timestamptz, organizer_id uuid, organizer_name text, organizer_username text,
  capacity integer, reserved_spots integer, joined_count integer, spots_left integer, joined_by_me boolean, organized_by_me boolean
)
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid();
begin
  perform private.require_browse_access(v_uid);
  return query
  select m.id, b.id, p.id, p.name, p.location, p.timezone, p.sport_type, b.starts_at, b.ends_at,
    m.organizer_id, o.full_name, o.username, p.capacity,
    m.reserved_spots + coalesce(reservation_stats.named_reserved, 0),
    coalesce(participant_stats.joined_count, 0),
    greatest(p.capacity - 1 - m.reserved_spots - coalesce(reservation_stats.named_reserved, 0) - coalesce(participant_stats.joined_count, 0), 0),
    coalesce(participant_stats.joined_by_me, false) or coalesce(reservation_stats.reserved_by_me, false),
    m.organizer_id = v_uid
  from public.matches m
  join public.bookings b on b.id = m.booking_id
  join public.pitches p on p.id = b.pitch_id
  join public.profiles o on o.id = m.organizer_id
  left join lateral (
    select count(*)::integer as joined_count, coalesce(bool_or(mp.user_id = v_uid), false) as joined_by_me
    from public.match_participants mp where mp.match_id = m.id
  ) participant_stats on true
  left join lateral (
    select count(*)::integer as named_reserved, coalesce(bool_or(mr.profile_id = v_uid), false) as reserved_by_me
    from public.match_reservations mr where mr.match_id = m.id
  ) reservation_stats on true
  where m.status = 'active' and m.visibility = 'open' and b.status = 'scheduled' and b.starts_at > now()
  order by b.starts_at, m.created_at;
end;
$$;

create or replace function public.list_my_matches()
returns table(
  match_id uuid, booking_id uuid, pitch_name text, location text, timezone text, sport_type text,
  starts_at timestamptz, ends_at timestamptz, organizer_name text, capacity integer,
  reserved_spots integer, joined_count integer, member_role text, visibility text
)
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid();
begin
  perform private.require_browse_access(v_uid);
  return query
  select m.id, b.id, p.name, p.location, p.timezone, p.sport_type, b.starts_at, b.ends_at, o.full_name, p.capacity,
    m.reserved_spots + (select count(*)::integer from public.match_reservations r where r.match_id = m.id),
    (select count(*)::integer from public.match_participants x where x.match_id = m.id),
    case when m.organizer_id = v_uid then 'organizer'
      when exists(select 1 from public.match_participants mp where mp.match_id = m.id and mp.user_id = v_uid) then 'player'
      else 'reserved' end,
    m.visibility
  from public.matches m
  join public.bookings b on b.id = m.booking_id
  join public.pitches p on p.id = b.pitch_id
  join public.profiles o on o.id = m.organizer_id
  where m.status = 'active' and b.status = 'scheduled' and (
    m.organizer_id = v_uid
    or exists(select 1 from public.match_participants mp where mp.match_id = m.id and mp.user_id = v_uid)
    or exists(select 1 from public.match_reservations mr where mr.match_id = m.id and mr.profile_id = v_uid)
  )
  order by b.starts_at desc;
end;
$$;

create or replace function public.get_match_roster(p_match_id uuid)
returns table(user_id uuid,full_name text,username text,member_role text,joined_at timestamptz)
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_match public.matches%rowtype;
begin
  perform private.require_browse_access(v_uid);
  select * into v_match from public.matches where id=p_match_id;
  if not found then raise exception 'match_not_found'; end if;
  if v_match.visibility<>'open' and v_match.organizer_id<>v_uid and not private.is_admin() then raise exception 'match_not_visible'; end if;  return query
  select
    r.user_id,
    r.full_name,
    r.username,
    r.member_role,
    r.joined_at
  from (
    select
      v_match.organizer_id as user_id,
      p.full_name as full_name,
      p.username as username,
      'organizer'::text as member_role,
      v_match.created_at as joined_at
    from public.profiles p
    where p.id=v_match.organizer_id

    union all

    select
      mp.user_id,
      p.full_name,
      p.username,
      'player'::text,
      mp.joined_at
    from public.match_participants mp
    join public.profiles p on p.id=mp.user_id
    where mp.match_id=p_match_id
  ) r
  order by r.joined_at;
end;$$;

create or replace function public.create_booking(
  p_pitch_id uuid,
  p_starts_at timestamp with time zone
)
returns public.bookings
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_pitch public.pitches%rowtype;
  v_duration interval;
  v_ends_at timestamptz;
  v_local_start timestamp;
  v_service_date date;
  v_open timestamptz;
  v_close timestamptz;
  v_offset_seconds bigint;
  v_booking public.bookings;
  v_overnight boolean;
begin
  if v_user_id is null then
    raise exception 'authentication_required';
  end if;

  if p_starts_at is null then
    raise exception 'invalid_slot';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  select *
  into v_profile
  from public.profiles p
  where p.id = v_user_id;

  if not found or not private.has_app_access() then
    raise exception 'account_not_approved';
  end if;

  if exists (
    select 1
    from public.bookings b
    where b.user_id = v_user_id
      and b.status = 'scheduled'
      and b.ends_at > now()
  ) then
    raise exception 'active_booking_exists';
  end if;

  select *
  into v_pitch
  from public.pitches p
  where p.id = p_pitch_id
    and p.is_active = true
  for share;

  if not found then
    raise exception 'pitch_not_found';
  end if;

  v_duration := make_interval(mins => v_pitch.slot_duration_minutes);
  v_ends_at := p_starts_at + v_duration;

  if p_starts_at < now() then
    raise exception 'slot_in_past';
  end if;

  if p_starts_at >= now() + make_interval(hours => least(coalesce(v_pitch.booking_window_hours, 24), 24)) then
    raise exception 'outside_booking_window';
  end if;

  v_local_start := p_starts_at at time zone v_pitch.timezone;
  v_service_date := v_local_start::date;
  v_overnight := v_pitch.close_time < v_pitch.open_time;

  if v_overnight and v_local_start::time < v_pitch.close_time then
    v_service_date := v_service_date - 1;
  end if;

  v_open := (v_service_date::timestamp + v_pitch.open_time) at time zone v_pitch.timezone;
  v_close := (
    v_service_date::timestamp
    + v_pitch.close_time
    + case when v_overnight then interval '1 day' else interval '0 day' end
  ) at time zone v_pitch.timezone;

  if p_starts_at < v_open or v_ends_at > v_close then
    raise exception 'invalid_slot';
  end if;

  v_offset_seconds := extract(epoch from (p_starts_at - v_open))::bigint;
  if mod(v_offset_seconds, (v_pitch.slot_duration_minutes * 60)::bigint) <> 0 then
    raise exception 'invalid_slot';
  end if;

  if v_pitch.booking_frequency_enabled and exists (
    select 1
    from public.bookings b
    where b.user_id = v_user_id
      and b.pitch_id = p_pitch_id
      and b.status = 'scheduled'
      and b.starts_at >= p_starts_at - make_interval(days => v_pitch.booking_frequency_days)
      and b.starts_at < p_starts_at + make_interval(days => v_pitch.booking_frequency_days)
  ) then
    raise exception 'booking_frequency_limited';
  end if;

  begin
    insert into public.bookings(user_id, pitch_id, starts_at, ends_at, status)
    values (v_user_id, p_pitch_id, p_starts_at, v_ends_at, 'scheduled')
    returning * into v_booking;
  exception
    when exclusion_violation then
      raise exception 'slot_unavailable';
  end;

  return v_booking;
end;
$function$;

-- Identity approval is required for self-cancel; verified suspended users retain cleanup access.
create or replace function public.cancel_booking(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_pitch_id uuid;
  v_booking public.bookings%rowtype;
  v_cutoff_minutes integer;
begin
  if auth.uid() is not null and not exists (
    select 1 from public.profiles p where p.id = auth.uid()
      and p.identity_status = 'verified' and private.is_email_confirmed(p.id)
  ) then raise exception 'account_not_approved'; end if;
  if v_user_id is null then
    raise exception 'authentication_required';
  end if;

  select b.pitch_id
  into v_pitch_id
  from public.bookings b
  where b.id = p_booking_id;

  if not found then
    raise exception 'booking_not_found';
  end if;

  select p.cancellation_cutoff_minutes
  into v_cutoff_minutes
  from public.pitches p
  where p.id = v_pitch_id
  for share;

  if not found then
    raise exception 'facility_not_found';
  end if;

  select b.*
  into v_booking
  from public.bookings b
  where b.id = p_booking_id
    and b.pitch_id = v_pitch_id
  for update;

  if not found then
    raise exception 'booking_not_found';
  end if;

  -- This RPC is always self-service, even when the account also has the admin
  -- role. Ownership prevents it from being used to cancel another user's booking.
  if v_booking.user_id <> v_user_id then
    raise exception 'booking_not_owned';
  end if;

  if v_booking.status <> 'scheduled' then
    raise exception 'booking_not_cancellable';
  end if;

  if v_booking.starts_at <= now() + make_interval(mins => v_cutoff_minutes) then
    raise exception 'cancellation_window_closed';
  end if;

  update public.bookings
  set status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = v_user_id
  where id = p_booking_id
  returning * into v_booking;

  return v_booking;
end;
$$;

create or replace function public.add_match_reservation(
  p_match_id uuid,
  p_username text default null,
  p_guest_name text default null
)
returns public.match_reservations
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_booking_id uuid;
  v_booking public.bookings%rowtype;
  v_match public.matches%rowtype;
  v_capacity integer;
  v_profile_id uuid;
  v_username text;
  v_guest_name text;
  v_joined integer;
  v_named_reserved integer;
  v_reservation public.match_reservations;
begin
  perform private.require_sports_access(v_uid);

  select m.booking_id
  into v_booking_id
  from public.matches m
  where m.id = p_match_id;

  if not found then
    raise exception 'match_not_found';
  end if;

  -- Match every existing lifecycle mutation: booking first, then match.
  select b.*
  into v_booking
  from public.bookings b
  where b.id = v_booking_id
  for update;

  if not found then
    raise exception 'booking_not_found';
  end if;

  select m.*
  into v_match
  from public.matches m
  where m.id = p_match_id
    and m.booking_id = v_booking.id
  for update;

  if not found then
    raise exception 'match_not_found';
  end if;

  if v_match.organizer_id <> v_uid then
    raise exception 'organizer_required';
  end if;

  if v_match.status <> 'active' or v_match.visibility <> 'open' then
    raise exception 'match_not_open';
  end if;

  if v_booking.status <> 'scheduled' or v_booking.starts_at <= now() then
    raise exception 'match_started';
  end if;

  select p.capacity
  into v_capacity
  from public.pitches p
  where p.id = v_booking.pitch_id;

  if (nullif(btrim(coalesce(p_username, '')), '') is null)
     = (nullif(btrim(coalesce(p_guest_name, '')), '') is null) then
    raise exception 'invalid_reserved_name';
  end if;

  if nullif(btrim(coalesce(p_username, '')), '') is not null then
    v_username := lower(ltrim(btrim(p_username), '@'));

    if v_username = '' then
      raise exception 'invalid_reserved_name';
    end if;

    select p.id
    into v_profile_id
    from public.profiles p
    where lower(p.username) = v_username
      and p.status = 'approved' and p.identity_status = 'verified'
      and private.is_email_confirmed(p.id)
    limit 1;

    if v_profile_id is null then
      raise exception 'reserved_user_not_found';
    end if;

    if v_profile_id = v_match.organizer_id then
      raise exception 'invalid_reserved_name';
    end if;

    if exists (
      select 1
      from public.match_participants mp
      where mp.match_id = p_match_id
        and mp.user_id = v_profile_id
    ) then
      raise exception 'reserved_user_already_in_match';
    end if;

    if exists (
      select 1
      from public.match_reservations mr
      where mr.match_id = p_match_id
        and mr.profile_id = v_profile_id
    ) then
      raise exception 'reserved_user_already_reserved';
    end if;
  else
    v_guest_name := btrim(p_guest_name);

    if char_length(v_guest_name) < 2 or char_length(v_guest_name) > 80 then
      raise exception 'invalid_reserved_name';
    end if;

    if exists (
      select 1
      from public.match_reservations mr
      where mr.match_id = p_match_id
        and mr.guest_name is not null
        and lower(btrim(mr.guest_name)) = lower(v_guest_name)
    ) then
      raise exception 'reserved_user_already_reserved';
    end if;
  end if;

  select count(*)::integer
  into v_joined
  from public.match_participants
  where match_id = p_match_id;

  select count(*)::integer
  into v_named_reserved
  from public.match_reservations
  where match_id = p_match_id;

  if 1 + v_match.reserved_spots + v_named_reserved + v_joined >= v_capacity then
    raise exception 'match_full';
  end if;

  insert into public.match_reservations(match_id, profile_id, guest_name, created_by)
  values (p_match_id, v_profile_id, v_guest_name, v_uid)
  returning * into v_reservation;

  return v_reservation;
end;
$$;

create or replace function public.search_usernames(
  p_query text,
  p_limit integer default 5
)
returns table (
  user_id uuid,
  username text,
  full_name text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_query text := lower(ltrim(btrim(coalesce(p_query, '')), '@'));
  v_limit integer := least(greatest(coalesce(p_limit, 5), 1), 8);
begin
  perform private.require_sports_access(v_uid);

  if char_length(v_query) < 2 then
    return;
  end if;

  return query
  select
    p.id,
    p.username,
    p.full_name
  from public.profiles p
  where p.id <> v_uid
    and p.username is not null
    and p.role = 'student'
    and p.status = 'approved' and p.identity_status = 'verified'
    and lower(p.username) like v_query || '%'
  order by
    case when lower(p.username) = v_query then 0 else 1 end,
    char_length(p.username),
    lower(p.username)
  limit v_limit;
end;
$$;

commit;
