-- UNEEM V2 guest Help IP-gate contract tests.
-- Run after 022_guest_support_ip_gate.sql. Fixtures roll back.

\set ON_ERROR_STOP on

begin;

-- 1. Browsers cannot bypass the server gate by calling the legacy creation RPC.
do $$
begin
  if has_function_privilege('anon', 'public.create_guest_support_thread(text,text,text)', 'EXECUTE') then
    raise exception 'FAIL: anon can still create guest support threads directly';
  end if;
  if has_function_privilege('authenticated', 'public.create_guest_support_thread(text,text,text)', 'EXECUTE') then
    raise exception 'FAIL: authenticated can still call legacy guest creation directly';
  end if;
end;
$$;

-- 2. The new creation RPC is service-role only.
do $$
begin
  if has_function_privilege('anon', 'public.create_guest_support_thread_server(text,text,text,text)', 'EXECUTE') then
    raise exception 'FAIL: anon can execute trusted guest creation RPC';
  end if;
  if has_function_privilege('authenticated', 'public.create_guest_support_thread_server(text,text,text,text)', 'EXECUTE') then
    raise exception 'FAIL: authenticated can execute trusted guest creation RPC';
  end if;
  if not has_function_privilege('service_role', 'public.create_guest_support_thread_server(text,text,text,text)', 'EXECUTE') then
    raise exception 'FAIL: service_role cannot execute trusted guest creation RPC';
  end if;
end;
$$;

-- 3. Network identities must already be one-way 64-char lowercase hex digests.
do $$
begin
  begin
    perform private.enforce_guest_ip_rate_limit('192.0.2.1');
    raise exception 'FAIL: raw/invalid network identity unexpectedly accepted';
  exception
    when others then
      if sqlerrm like 'FAIL:%' then raise; end if;
      if position('invalid_guest_network_identity' in sqlerrm) = 0 then raise; end if;
  end;
end;
$$;

-- 4. Three creations in ten minutes are allowed; the fourth is blocked.
select private.enforce_guest_ip_rate_limit(repeat('a', 64));
select private.enforce_guest_ip_rate_limit(repeat('a', 64));
select private.enforce_guest_ip_rate_limit(repeat('a', 64));

do $$
begin
  begin
    perform private.enforce_guest_ip_rate_limit(repeat('a', 64));
    raise exception 'FAIL: short-window IP limit did not block fourth attempt';
  exception
    when others then
      if sqlerrm like 'FAIL:%' then raise; end if;
      if position('support_rate_limited' in sqlerrm) = 0 then raise; end if;
  end;
end;
$$;

-- 5. Counter rows contain hashes only, never a raw IP field.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'private'
      and table_name = 'guest_support_ip_rate_limits'
      and column_name in ('ip', 'client_ip', 'remote_addr')
  ) then
    raise exception 'FAIL: raw IP storage column exists';
  end if;
end;
$$;

rollback;
\echo 'UNEEM V2 guest support IP gate contract tests passed.'
