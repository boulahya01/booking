-- Return the authoritative facility timezone with open-match discovery so the
-- client does not need a second pitches query after list_open_matches().
begin;

drop function if exists public.list_open_matches();

create function public.list_open_matches()
returns table(
  match_id uuid,
  booking_id uuid,
  pitch_id uuid,
  pitch_name text,
  location text,
  timezone text,
  sport_type text,
  starts_at timestamptz,
  ends_at timestamptz,
  organizer_id uuid,
  organizer_name text,
  organizer_username text,
  capacity integer,
  reserved_spots integer,
  joined_count integer,
  spots_left integer,
  joined_by_me boolean,
  organized_by_me boolean
)
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  perform private.require_sports_access(v_uid);

  return query
  select
    m.id,
    b.id,
    p.id,
    p.name,
    p.location,
    p.timezone,
    p.sport_type,
    b.starts_at,
    b.ends_at,
    m.organizer_id,
    o.full_name,
    o.username,
    p.capacity,
    m.reserved_spots,
    count(mp.user_id)::integer,
    greatest(p.capacity - 1 - m.reserved_spots - count(mp.user_id)::integer, 0),
    coalesce(bool_or(mp.user_id = v_uid), false),
    m.organizer_id = v_uid
  from public.matches m
  join public.bookings b on b.id = m.booking_id
  join public.pitches p on p.id = b.pitch_id
  join public.profiles o on o.id = m.organizer_id
  left join public.match_participants mp on mp.match_id = m.id
  where m.status = 'active'
    and m.visibility = 'open'
    and b.status = 'scheduled'
    and b.starts_at > now()
  group by m.id, b.id, p.id, o.id
  order by b.starts_at, m.created_at;
end;
$$;

revoke all on function public.list_open_matches() from public, anon;
grant execute on function public.list_open_matches() to authenticated;

commit;
