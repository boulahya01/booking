-- Community is additive: existing bookings, participation and support stay authoritative.
begin;

create table public.community_players (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  bio text not null default '' check (char_length(bio) <= 240),
  sports text[] not null default '{}' check (cardinality(sports) <= 8),
  discoverable boolean not null default false,
  available_until timestamptz,
  updated_at timestamptz not null default now()
);
create table public.community_messages (
  id bigint generated always as identity primary key,
  booking_id uuid references public.bookings(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  shared_booking_id uuid references public.bookings(id) on delete set null,
  created_at timestamptz not null default now(),
  hidden_at timestamptz,
  unique (sender_id, client_id)
);
create index community_messages_room_page_idx on public.community_messages(booking_id, id desc);
create index community_messages_sender_recent_idx on public.community_messages(sender_id, created_at desc);
create index community_messages_shared_booking_idx on public.community_messages(shared_booking_id) where shared_booking_id is not null;
create table public.community_blocks (
  user_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id, blocked_id), check(user_id <> blocked_id)
);
create index community_blocks_target_idx on public.community_blocks(blocked_id, user_id);
create table public.community_reads (
  user_id uuid not null references public.profiles(id) on delete cascade,
  scope text not null,
  last_read bigint not null default 0 check(last_read >= 0),
  muted boolean not null default false,
  primary key(user_id, scope)
);
alter table public.community_players enable row level security;
alter table public.community_messages enable row level security;
alter table public.community_blocks enable row level security;
alter table public.community_reads enable row level security;
-- RPC-only access prevents clients forging senders, timestamps or membership.
revoke all on public.community_players, public.community_messages, public.community_blocks, public.community_reads from public, anon, authenticated;
revoke all on sequence public.community_messages_id_seq from public, anon, authenticated;

create function private.community_allowed(p_booking_id uuid default null)
returns boolean language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  begin perform private.require_sports_access(auth.uid()); exception when others then return false; end;
  if p_booking_id is null then return true; end if;
  return exists (
    select 1 from public.matches m join public.bookings b on b.id=m.booking_id
    where b.id=p_booking_id and b.ends_at > now()-interval '7 days'
      and (m.organizer_id=auth.uid()
        or exists(select 1 from public.match_participants mp where mp.match_id=m.id and mp.user_id=auth.uid())
        or exists(select 1 from public.match_reservations mr where mr.match_id=m.id and mr.profile_id=auth.uid()))
  );
end $$;
create function private.community_blocked(p_other uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(select 1 from public.community_blocks b
    where (b.user_id=auth.uid() and b.blocked_id=p_other) or (b.user_id=p_other and b.blocked_id=auth.uid()));
$$;
create function private.community_card(p_booking_id uuid)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object('booking_id',b.id,'pitch_name',p.name,'location',p.location,
    'starts_at',b.starts_at,'ends_at',b.ends_at,'timezone',p.timezone,'sport_type',p.sport_type,
    'spots_left',greatest(0,p.capacity-1-m.reserved_spots
      -(select count(*) from public.match_participants mp where mp.match_id=m.id)
      -(select count(*) from public.match_reservations mr where mr.match_id=m.id)))
  from public.bookings b join public.matches m on m.booking_id=b.id join public.pitches p on p.id=b.pitch_id
  where b.id=p_booking_id and b.status='scheduled' and b.ends_at>now() and m.status='active' and m.visibility='open';
$$;
create function private.community_message_json(p_message public.community_messages)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object('id',p_message.id::text,'booking_id',p_message.booking_id,
    'sender_id',p.id,'username',p.username,'full_name',p.full_name,'body',p_message.body,
    'client_id',p_message.client_id,'created_at',p_message.created_at,
    'shared_booking_id',p_message.shared_booking_id,'shared_match',private.community_card(p_message.shared_booking_id))
  from public.profiles p where p.id=p_message.sender_id;
$$;

create function public.get_community_room(p_booking_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_result jsonb; v_read public.community_reads;
begin
  if not private.community_allowed(p_booking_id) then raise exception 'community_access_required'; end if;
  select * into v_read from public.community_reads where user_id=auth.uid() and scope=coalesce(p_booking_id::text,'lobby');
  if p_booking_id is null then
    v_result:=jsonb_build_object('booking_id',null,'title','Lobby','can_send',true);
  else
    select jsonb_build_object('booking_id',b.id,'title',p.name,'starts_at',b.starts_at,'timezone',p.timezone,
      'can_send',b.status='scheduled' and m.status='active' and b.ends_at>now()) into v_result
    from public.bookings b join public.pitches p on p.id=b.pitch_id join public.matches m on m.booking_id=b.id
    where b.id=p_booking_id;
  end if;
  return v_result || jsonb_build_object('muted',coalesce(v_read.muted,false),'last_read',coalesce(v_read.last_read,0)::text);
end $$;

create function public.list_community_messages(p_booking_id uuid default null,p_before bigint default null,p_after bigint default null,p_limit integer default 30)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  if not private.community_allowed(p_booking_id) then raise exception 'community_access_required'; end if;
  -- Older pages descend. Reconnect catch-up ascends so a large gap cannot skip messages.
  return coalesce((select jsonb_agg(private.community_message_json(r) order by r.id)
    from (select m.* from public.community_messages m
      where m.booking_id is not distinct from p_booking_id and m.hidden_at is null
        and not private.community_blocked(m.sender_id)
        and (p_before is null or m.id<p_before) and (p_after is null or m.id>p_after)
      order by case when p_after is not null then m.id end asc,m.id desc
      limit least(greatest(coalesce(p_limit,30),1),50)) r),'[]'::jsonb);
end $$;
create function public.get_community_message(p_id bigint)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_row public.community_messages;
begin
  perform private.require_sports_access(auth.uid());
  select * into v_row from public.community_messages where id=p_id and hidden_at is null;
  if not found or not private.community_allowed(v_row.booking_id) or private.community_blocked(v_row.sender_id) then return null; end if;
  return private.community_message_json(v_row);
end $$;

create function public.send_community_message(p_body text,p_client_id uuid,p_booking_id uuid default null,p_shared_booking_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_row public.community_messages; v_room jsonb;
begin
  perform private.require_sports_access(auth.uid());
  -- Serialize retries and rate checks for this sender across browser tabs.
  perform pg_advisory_xact_lock(hashtextextended('community-send:'||auth.uid()::text,0));
  -- Match mutations use the booking lock too. A leave/cancel that commits first
  -- must be observed before admitting another private message.
  if p_booking_id is not null then perform 1 from public.bookings where id=p_booking_id for share; end if;
  v_room:=public.get_community_room(p_booking_id);
  -- Assign message ids in commit order within each room. Without this lock a
  -- later transaction could commit first and make an after-id reconnect skip
  -- an earlier id whose transaction was still open.
  perform pg_advisory_xact_lock(hashtextextended('community-room:'||coalesce(p_booking_id::text,'lobby'),0));
  select * into v_row from public.community_messages where sender_id=auth.uid() and client_id=p_client_id;
  if found then
    if v_row.booking_id is distinct from p_booking_id or v_row.body is distinct from btrim(p_body)
      or v_row.shared_booking_id is distinct from p_shared_booking_id then raise exception 'community_retry_mismatch'; end if;
    return private.community_message_json(v_row);
  end if;
  if not (v_room->>'can_send')::boolean then raise exception 'community_room_closed'; end if;
  if p_client_id is null or char_length(btrim(coalesce(p_body,''))) not between 1 and 1000 then raise exception 'community_invalid_message'; end if;
  if p_shared_booking_id is not null and private.community_card(p_shared_booking_id) is null then raise exception 'community_match_not_open'; end if;
  if (select count(*) from public.community_messages where sender_id=auth.uid() and created_at>now()-interval '1 minute')>=20 then raise exception 'community_rate_limited'; end if;
  insert into public.community_messages(sender_id,client_id,body,booking_id,shared_booking_id)
    values(auth.uid(),p_client_id,btrim(p_body),p_booking_id,p_shared_booking_id) returning * into v_row;
  return private.community_message_json(v_row);
end $$;

create function public.update_community_read(p_booking_id uuid default null,p_last_read bigint default null,p_muted boolean default null)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_max bigint;
begin
  if not private.community_allowed(p_booking_id) then raise exception 'community_access_required'; end if;
  select coalesce(max(id),0) into v_max from public.community_messages where booking_id is not distinct from p_booking_id;
  insert into public.community_reads as r(user_id,scope,last_read,muted)
    values(auth.uid(),coalesce(p_booking_id::text,'lobby'),greatest(0,least(coalesce(p_last_read,0),v_max)),coalesce(p_muted,false))
    on conflict(user_id,scope) do update set
      last_read=greatest(r.last_read,least(coalesce(p_last_read,r.last_read),v_max)),muted=coalesce(p_muted,r.muted);
end $$;
create function public.list_community_chats()
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  perform private.require_sports_access(auth.uid());
  return coalesce((select jsonb_agg(r.item order by r.starts_at) from (
    select b.starts_at,jsonb_build_object('booking_id',b.id,'title',p.name,'starts_at',b.starts_at,'timezone',p.timezone,
      'can_send',b.status='scheduled' and m.status='active' and b.ends_at>now(),
      'muted',coalesce(cr.muted,false),
      'last_read',coalesce(cr.last_read,0)::text,
      'unread',(select count(*) from public.community_messages cm where cm.booking_id=b.id and cm.hidden_at is null
        and cm.id>coalesce(cr.last_read,0) and cm.sender_id<>auth.uid() and not private.community_blocked(cm.sender_id))) item
    from public.matches m join public.bookings b on b.id=m.booking_id join public.pitches p on p.id=b.pitch_id
    left join public.community_reads cr on cr.user_id=auth.uid() and cr.scope=b.id::text
    where b.ends_at>now()-interval '7 days' and private.community_allowed(b.id)
    order by b.starts_at desc limit 50) r),'[]'::jsonb);
end $$;

create function public.get_player_profile(p_username text)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  perform private.require_sports_access(auth.uid());
  return (select jsonb_build_object('id',p.id,'full_name',p.full_name,'username',p.username,
    'bio',case when coalesce(c.discoverable,false) or p.id=auth.uid() then coalesce(c.bio,'') else '' end,
    'sports',case when coalesce(c.discoverable,false) or p.id=auth.uid() then coalesce(c.sports,'{}') else '{}'::text[] end,
    'available_until',case when c.discoverable or p.id=auth.uid() then c.available_until end,
    'discoverable',coalesce(c.discoverable,false),
    'blocked',exists(select 1 from public.community_blocks cb where cb.user_id=auth.uid() and cb.blocked_id=p.id))
    from public.profiles p left join public.community_players c on c.user_id=p.id
    where p.username=lower(ltrim(btrim(p_username),'@')) and p.status='approved'
      and p.identity_status='verified' and p.role='student');
end $$;
create function public.list_community_players(p_query text default '',p_after text default '',p_limit integer default 24)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  perform private.require_sports_access(auth.uid());
  return coalesce((select jsonb_agg(public.get_player_profile(r.username) order by r.username) from (
    select p.username from public.community_players c join public.profiles p on p.id=c.user_id
    where c.discoverable and p.status='approved' and p.identity_status='verified' and p.role='student'
      and p.username is not null and p.username>coalesce(p_after,'') and not private.community_blocked(p.id)
      and starts_with(p.username,lower(ltrim(btrim(coalesce(p_query,'')),'@')))
    order by p.username limit least(greatest(coalesce(p_limit,24),1),50)) r),'[]'::jsonb);
end $$;
create function public.update_community_profile(p_bio text,p_sports text[],p_discoverable boolean,p_available boolean)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_username text;
begin
  perform private.require_sports_access(auth.uid());
  if p_discoverable is null or p_available is null or p_sports is null or array_position(p_sports,null) is not null
    or cardinality(p_sports)>8 or exists(select 1 from unnest(p_sports) s where s not in ('football','basketball','handball','volleyball','tennis','padel','badminton','other'))
    or char_length(coalesce(p_bio,''))>240 then raise exception 'community_invalid_profile'; end if;
  insert into public.community_players(user_id,bio,sports,discoverable,available_until)
    values(auth.uid(),btrim(coalesce(p_bio,'')),p_sports,p_discoverable,case when p_available then now()+interval '4 hours' end)
    on conflict(user_id) do update set bio=excluded.bio,sports=excluded.sports,discoverable=excluded.discoverable,
      available_until=excluded.available_until,updated_at=now();
  select username into v_username from public.profiles where id=auth.uid();
  return public.get_player_profile(v_username);
end $$;
create function public.set_community_block(p_user_id uuid,p_blocked boolean)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform private.require_sports_access(auth.uid());
  if p_user_id is null or p_user_id=auth.uid() or p_blocked is null
    or not exists(select 1 from public.profiles where id=p_user_id and role='student') then raise exception 'community_invalid_player'; end if;
  if p_blocked then insert into public.community_blocks(user_id,blocked_id) values(auth.uid(),p_user_id) on conflict do nothing;
  else delete from public.community_blocks where user_id=auth.uid() and blocked_id=p_user_id; end if;
  -- Blocking is a communication preference; it never removes a match participant.
end $$;
create function public.hide_community_message(p_id bigint)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not private.is_admin() then raise exception 'admin_required'; end if;
  update public.community_messages set hidden_at=now() where id=p_id;
end $$;

-- Broadcast only an opaque id. A fresh RPC rechecks membership for every body.
-- Realtime channel permissions can be cached until token refresh, so never put
-- private message text in these events after a participant leaves or is suspended.
create function private.community_broadcast()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform realtime.send(jsonb_build_object('id',new.id::text),'message','community:'||coalesce(new.booking_id::text,'lobby'),true);
  return null;
end $$;
create trigger community_message_broadcast after insert or update on public.community_messages
  for each row execute function private.community_broadcast();
create function private.community_topic_allowed()
returns boolean language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_topic text:=realtime.topic();
begin
  if v_topic='community:lobby' then return private.community_allowed(null); end if;
  if v_topic~'^community:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return private.community_allowed(substring(v_topic from 11)::uuid);
  end if;
  return false;
end $$;
create policy community_receive on realtime.messages for select to authenticated
  using (extension='broadcast' and private.community_topic_allowed());

-- Private helpers are not API endpoints; only the policy helper is callable by
-- the browser role. Definer RPCs expose deliberately allowlisted peer fields.
revoke all on function private.community_allowed(uuid),private.community_blocked(uuid),private.community_card(uuid),
  private.community_message_json(public.community_messages),private.community_broadcast(),private.community_topic_allowed() from public,anon,authenticated;
grant execute on function private.community_topic_allowed() to authenticated;
revoke all on function public.get_community_room(uuid),public.list_community_messages(uuid,bigint,bigint,integer),
  public.get_community_message(bigint),public.send_community_message(text,uuid,uuid,uuid),
  public.update_community_read(uuid,bigint,boolean),public.list_community_chats(),public.get_player_profile(text),
  public.list_community_players(text,text,integer),public.update_community_profile(text,text[],boolean,boolean),
  public.set_community_block(uuid,boolean),public.hide_community_message(bigint) from public,anon;
grant execute on function public.get_community_room(uuid),public.list_community_messages(uuid,bigint,bigint,integer),
  public.get_community_message(bigint),public.send_community_message(text,uuid,uuid,uuid),
  public.update_community_read(uuid,bigint,boolean),public.list_community_chats(),public.get_player_profile(text),
  public.list_community_players(text,text,integer),public.update_community_profile(text,text[],boolean,boolean),
  public.set_community_block(uuid,boolean),public.hide_community_message(bigint) to authenticated;
commit;
