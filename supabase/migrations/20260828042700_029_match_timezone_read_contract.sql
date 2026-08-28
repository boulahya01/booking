-- Expose the facility timezone in the user's match read model so every match timestamp is rendered in the authoritative facility timezone.
begin;

drop function if exists public.list_my_matches();

create function public.list_my_matches()
returns table(
  match_id uuid,
  booking_id uuid,
  pitch_name text,
  location text,
  timezone text,
  sport_type text,
  starts_at timestamptz,
  ends_at timestamptz,
  organizer_name text,
  capacity integer,
  reserved_spots integer,
  joined_count integer,
  member_role text,
  visibility text
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
    p.name,
    p.location,
    p.timezone,
    p.sport_type,
    b.starts_at,
    b.ends_at,
    o.full_name,
    p.capacity,
    m.reserved_spots,
    (select count(*)::integer from public.match_participants x where x.match_id = m.id),
    case when m.organizer_id = v_uid then 'organizer' else 'player' end,
    m.visibility
  from public.matches m
  join public.bookings b on b.id = m.booking_id
  join public.pitches p on p.id = b.pitch_id
  join public.profiles o on o.id = m.organizer_id
  where m.status = 'active'
    and b.status = 'scheduled'
    and (
      m.organizer_id = v_uid
      or exists (
        select 1
        from public.match_participants mp
        where mp.match_id = m.id
          and mp.user_id = v_uid
      )
    )
  order by b.starts_at desc;
end;
$$;

revoke all on function public.list_my_matches() from public, anon;
grant execute on function public.list_my_matches() to authenticated;

commit;
