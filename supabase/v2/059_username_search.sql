-- Approved students may find other approved student usernames when reserving a
-- registered friend. Keep this as a narrow, prefix-only RPC instead of exposing
-- profiles directly or restoring a public username-availability oracle.

begin;

create index if not exists profiles_username_prefix_idx
  on public.profiles ((lower(username)) text_pattern_ops)
  where username is not null;

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
    and p.status = 'approved'
    and lower(p.username) like v_query || '%'
  order by
    case when lower(p.username) = v_query then 0 else 1 end,
    char_length(p.username),
    lower(p.username)
  limit v_limit;
end;
$$;

revoke all on function public.search_usernames(text, integer) from public, anon;
grant execute on function public.search_usernames(text, integer) to authenticated;

commit;
