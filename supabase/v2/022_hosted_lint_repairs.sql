-- UNEEM V2 hosted PostgreSQL lint repairs.
-- Apply after 021_auth_lifecycle_contract.sql.

begin;

-- Later support layers replaced the layer-007 functions with unqualified
-- pgcrypto calls. Keep their existing behavior and make extension resolution
-- explicit for the hosted runtime.
alter function public.create_guest_support_thread(text, text, text)
  set search_path = public, private, extensions;

alter function public.add_guest_support_message(text, text)
  set search_path = public, private, extensions;

create or replace function public.get_match_roster(p_match_id uuid)
returns table(user_id uuid,full_name text,username text,member_role text,joined_at timestamptz)
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_match public.matches%rowtype;
begin
  perform private.require_sports_access(v_uid);
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

create or replace function public.admin_list_bookings(
  p_query text default null,
  p_pitch_id uuid default null,
  p_lifecycle text default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_limit integer default 30,
  p_offset integer default 0
)
returns table(
  booking_id uuid,
  user_id uuid,
  pitch_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  booking_status text,
  lifecycle_status text,
  created_at timestamptz,
  full_name text,
  student_id text,
  email text,
  pitch_name text,
  pitch_location text,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public, private, auth, pg_temp
as $$
declare
  v_query text := nullif(lower(btrim(coalesce(p_query, ''))), '');
  v_limit integer := least(greatest(coalesce(p_limit, 30), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if not private.is_admin() then
    raise exception 'admin_required';
  end if;

  if p_lifecycle is not null and p_lifecycle not in ('upcoming', 'in_progress', 'completed', 'cancelled') then
    raise exception 'invalid_booking_lifecycle';
  end if;

  return query
  with scoped as (
    select
      b.id,
      b.user_id,
      b.pitch_id,
      b.starts_at,
      b.ends_at,
      b.status,
      case
        when b.status = 'cancelled' then 'cancelled'
        when b.ends_at <= now() then 'completed'
        when b.starts_at <= now() then 'in_progress'
        else 'upcoming'
      end as lifecycle,
      b.created_at,
      p.full_name,
      p.student_id,
      u.email::text,
      f.name as facility_name,
      f.location as facility_location
    from public.bookings b
    join public.profiles p on p.id = b.user_id
    join auth.users u on u.id = b.user_id
    join public.pitches f on f.id = b.pitch_id
    where (p_pitch_id is null or b.pitch_id = p_pitch_id)
      and (p_from is null or b.starts_at >= p_from)
      and (p_to is null or b.starts_at < p_to)
      and (
        v_query is null
        or lower(p.full_name) like '%' || v_query || '%'
        or lower(coalesce(p.student_id, '')) like '%' || v_query || '%'
        or lower(coalesce(u.email, '')) like '%' || v_query || '%'
        or lower(f.name) like '%' || v_query || '%'
      )
  ), filtered as (
    select *
    from scoped s
    where p_lifecycle is null or s.lifecycle = p_lifecycle
  )
  select
    s.id,
    s.user_id,
    s.pitch_id,
    s.starts_at,
    s.ends_at,
    s.status,
    s.lifecycle,
    s.created_at,
    s.full_name,
    s.student_id,
    s.email,
    s.facility_name,
    s.facility_location,
    count(*) over ()::bigint
  from filtered s
  order by s.starts_at desc
  limit v_limit
  offset v_offset;
end;
$$;

commit;