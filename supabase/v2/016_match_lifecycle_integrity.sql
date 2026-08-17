-- UNEEM V2 match lifecycle integrity. Apply after 015_open_match_reads.sql.
-- Keeps match state consistent with its authoritative facility booking and fixes
-- idempotent reopening of an empty organizer-owned match.
begin;

create or replace function public.create_open_match(p_booking_id uuid,p_reserved_spots integer default 0)
returns public.matches language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_uid uuid:=auth.uid();
  v_booking public.bookings%rowtype;
  v_capacity integer;
  v_joined integer:=0;
  v_match public.matches%rowtype;
begin
  perform private.require_sports_access(v_uid);

  select b,p.capacity into v_booking,v_capacity
  from public.bookings b
  join public.pitches p on p.id=b.pitch_id
  where b.id=p_booking_id
  for update of b;

  if not found then raise exception 'booking_not_found'; end if;
  if v_booking.user_id<>v_uid then raise exception 'booking_not_owned'; end if;
  if v_booking.status<>'scheduled' or v_booking.starts_at<=now() then raise exception 'booking_not_matchable'; end if;
  if v_capacity<2 then raise exception 'match_capacity_too_small'; end if;
  if p_reserved_spots<0 or p_reserved_spots>v_capacity-1 then raise exception 'invalid_reserved_spots'; end if;

  select * into v_match
  from public.matches
  where booking_id=p_booking_id
  for update;

  if found then
    if v_match.organizer_id<>v_uid then raise exception 'organizer_required'; end if;

    select count(*)::integer into v_joined
    from public.match_participants
    where match_id=v_match.id;

    -- Repeated submit with the same active/open state is safe and idempotent.
    if v_match.status='active'
       and v_match.visibility='open'
       and v_match.reserved_spots=p_reserved_spots then
      return v_match;
    end if;

    -- Reopening/changing through the create flow is allowed only while nobody
    -- from the public pool has joined. Existing participants must never be
    -- displaced by an implicit visibility/reserved-spots rewrite.
    if v_joined>0 then raise exception 'match_has_public_players'; end if;

    update public.matches
    set visibility='open',reserved_spots=p_reserved_spots,status='active',updated_at=now()
    where id=v_match.id
    returning * into v_match;

    return v_match;
  end if;

  insert into public.matches(booking_id,organizer_id,visibility,reserved_spots,status)
  values(v_booking.id,v_uid,'open',p_reserved_spots,'active')
  returning * into v_match;

  return v_match;
end;$$;
revoke all on function public.create_open_match(uuid,integer) from public,anon;
grant execute on function public.create_open_match(uuid,integer) to authenticated;

create or replace function private.sync_match_from_booking_lifecycle()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if old.status is distinct from new.status and new.status='cancelled' then
    update public.matches
    set status='cancelled',updated_at=now()
    where booking_id=new.id and status<>'cancelled';
  end if;
  return new;
end;$$;
revoke all on function private.sync_match_from_booking_lifecycle() from public,anon,authenticated;

drop trigger if exists bookings_cancel_match on public.bookings;
create trigger bookings_cancel_match
after update of status on public.bookings
for each row execute function private.sync_match_from_booking_lifecycle();

commit;
