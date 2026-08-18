-- UNEEM V2 IP-aware guest Help creation gate.
-- Apply after 021_auth_lifecycle_contract.sql.
--
-- Guest Help must remain available without authentication, but anonymous thread
-- creation cannot trust an IP supplied by a browser. The Vercel/SvelteKit
-- server hashes the Vercel-overwritten client IP with a private HMAC secret and
-- calls the service-role-only RPC below. Raw IP addresses are never stored.

begin;

create table if not exists private.guest_support_ip_rate_limits (
  ip_hash text primary key check (ip_hash ~ '^[0-9a-f]{64}$'),
  short_window_started_at timestamptz not null default now(),
  short_count integer not null default 0 check (short_count >= 0),
  long_window_started_at timestamptz not null default now(),
  long_count integer not null default 0 check (long_count >= 0),
  updated_at timestamptz not null default now()
);

revoke all on private.guest_support_ip_rate_limits from public, anon, authenticated, service_role;

create or replace function private.enforce_guest_ip_rate_limit(p_ip_hash text)
returns void
language plpgsql
security definer
set search_path = private, pg_temp
as $$
declare
  v_now timestamptz := now();
  v_row private.guest_support_ip_rate_limits%rowtype;
begin
  if coalesce(p_ip_hash, '') !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_guest_network_identity';
  end if;

  -- Serialize requests from one network identity so parallel submissions cannot
  -- race through the counters.
  perform pg_advisory_xact_lock(hashtextextended(p_ip_hash, 29));

  insert into private.guest_support_ip_rate_limits(ip_hash)
  values (p_ip_hash)
  on conflict (ip_hash) do nothing;

  select * into v_row
  from private.guest_support_ip_rate_limits
  where ip_hash = p_ip_hash
  for update;

  if v_row.short_window_started_at <= v_now - interval '10 minutes' then
    v_row.short_window_started_at := v_now;
    v_row.short_count := 0;
  end if;

  if v_row.long_window_started_at <= v_now - interval '1 hour' then
    v_row.long_window_started_at := v_now;
    v_row.long_count := 0;
  end if;

  if v_row.short_count >= 3 or v_row.long_count >= 8 then
    raise exception 'support_rate_limited';
  end if;

  update private.guest_support_ip_rate_limits
  set short_window_started_at = v_row.short_window_started_at,
      short_count = v_row.short_count + 1,
      long_window_started_at = v_row.long_window_started_at,
      long_count = v_row.long_count + 1,
      updated_at = v_now
  where ip_hash = p_ip_hash;

  -- Opportunistic bounded cleanup. This is maintenance only; lifecycle does not
  -- depend on a cron job.
  delete from private.guest_support_ip_rate_limits
  where updated_at < v_now - interval '30 days';
end;
$$;

revoke all on function private.enforce_guest_ip_rate_limit(text) from public, anon, authenticated, service_role;

-- Direct browser creation is deliberately closed. Guest conversation reads and
-- replies still use the existing unguessable capability token contract.
revoke all on function public.create_guest_support_thread(text, text, text)
  from public, anon, authenticated, service_role;

create or replace function public.create_guest_support_thread_server(
  p_contact_email text,
  p_subject text,
  p_body text,
  p_ip_hash text
)
returns table(thread_id uuid, access_token text)
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_thread_id uuid;
  v_token text := encode(gen_random_bytes(32), 'hex');
  v_email text := lower(trim(coalesce(p_contact_email, '')));
begin
  if char_length(trim(coalesce(p_body, ''))) not between 1 and 4000 then
    raise exception 'invalid_support_message';
  end if;

  if v_email <> '' and (char_length(v_email) > 254 or position('@' in v_email) < 2) then
    raise exception 'invalid_contact_email';
  end if;

  perform private.enforce_guest_ip_rate_limit(p_ip_hash);
  -- Keep the existing per-contact and global database burst controls as
  -- defense-in-depth behind the trusted network gate.
  perform private.enforce_guest_thread_rate_limit(v_email);

  insert into public.support_threads (contact_email, kind, subject, guest_token_hash)
  values (
    nullif(v_email, ''),
    'support',
    nullif(left(trim(coalesce(p_subject, '')), 120), ''),
    digest(v_token, 'sha256')
  )
  returning id into v_thread_id;

  insert into public.support_messages (thread_id, sender_role, body)
  values (v_thread_id, 'guest', trim(p_body));

  return query select v_thread_id, v_token;
end;
$$;

revoke all on function public.create_guest_support_thread_server(text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.create_guest_support_thread_server(text, text, text, text)
  from service_role;
grant execute on function public.create_guest_support_thread_server(text, text, text, text)
  to service_role;

commit;
