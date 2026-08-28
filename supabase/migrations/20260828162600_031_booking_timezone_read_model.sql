-- Include the facility timezone in the authoritative booking read model so
-- clients do not need a second pitches query after list_my_bookings().
begin;

drop function if exists public.list_my_bookings(integer);

create function public.list_my_bookings(p_limit integer default 100)
returns table(
  booking_id uuid,
  pitch_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  booking_status text,
  lifecycle_status text,
  cancelled_at timestamptz,
  created_at timestamptz,
  pitch_name text,
  pitch_location text,
  pitch_capacity integer,
  pitch_timezone text
)
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 200);
begin
  if v_uid is null then
    raise exception 'authentication_required';
  end if;

  return query
  select
    b.id,
    b.pitch_id,
    b.starts_at,
    b.ends_at,
    b.status,
    case
      when b.status = 'cancelled' then 'cancelled'
      when b.ends_at <= now() then 'completed'
      when b.starts_at <= now() then 'in_progress'
      else 'upcoming'
    end,
    b.cancelled_at,
    b.created_at,
    p.name,
    p.location,
    p.capacity,
    p.timezone
  from public.bookings b
  join public.pitches p on p.id = b.pitch_id
  where b.user_id = v_uid
  order by b.starts_at desc
  limit v_limit;
end;
$$;

revoke all on function public.list_my_bookings(integer) from public, anon;
grant execute on function public.list_my_bookings(integer) to authenticated;

commit;
