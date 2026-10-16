// Run only against a fresh, loopback-only disposable PostgreSQL database.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const { Client } = createRequire(path.join(root, 'frontend/package.json'))('pg')
const value = process.env.UNEEM_ISOLATED_DB_URL
if (!value) throw new Error('Set UNEEM_ISOLATED_DB_URL to a fresh local test database.')
const target = new URL(value)
const database = target.pathname.slice(1)
if (!['127.0.0.1', 'localhost'].includes(target.hostname) || !/^uneem_community_test_[0-9]+$/.test(database)) {
  throw new Error('Only a new loopback database named uneem_community_test_<digits> is allowed.')
}
const adminUrl = new URL(target); adminUrl.pathname = '/postgres'
const admin = new Client({ connectionString: adminUrl.href })
await admin.connect()
try { await admin.query(`create database "${database}"`) } finally { await admin.end() }
const db = new Client({ connectionString: value })
await db.connect()
try {
  await db.query(`
    do $$ begin
      if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
      if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
      if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
    end $$;
    create schema auth; create schema storage; create schema realtime;
    create table auth.users(instance_id uuid,id uuid primary key,aud text,role text,email text,encrypted_password text,email_confirmed_at timestamptz,confirmation_token text,recovery_token text,email_change_token_new text,email_change text,raw_app_meta_data jsonb default '{}',raw_user_meta_data jsonb default '{}',created_at timestamptz default now(),updated_at timestamptz default now());
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,storage to anon,authenticated,service_role;
    grant execute on function auth.uid() to anon,authenticated,service_role;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid,metadata jsonb,created_at timestamptz default now());
    alter table storage.objects enable row level security;
    grant select,insert,update,delete on storage.objects to authenticated,service_role;
    create function storage.foldername(text) returns text[] language sql immutable as $$ select (string_to_array($1,'/'))[1:greatest(array_length(string_to_array($1,'/'),1)-1,0)] $$;
    create table realtime.messages(id bigint generated always as identity,extension text,topic text);
    alter table realtime.messages enable row level security;
    grant usage on schema realtime to authenticated;
    grant select on realtime.messages to authenticated;
    create table realtime.test_events(payload jsonb,event text,topic text,private boolean);
    create function realtime.topic() returns text language sql stable as $$ select current_setting('request.realtime.topic',true) $$;
    create function realtime.send(payload jsonb,event text,topic text,private boolean default true) returns void language sql as $$ insert into realtime.test_events values($1,$2,$3,$4) $$;
    revoke all on function realtime.send(jsonb,text,text,boolean) from public,anon,authenticated;
    set search_path=public,extensions;
  `)
  for (const name of fs.readdirSync(path.join(root, 'supabase/migrations')).filter(name => name.endsWith('.sql')).sort()) {
    await db.query(fs.readFileSync(path.join(root, 'supabase/migrations', name), 'utf8'))
  }
  console.log('Full migration stack applied to an isolated PostgreSQL database.')
  for (const name of ['match_contract.sql', 'community_contract.sql']) {
    const sql = fs.readFileSync(path.join(root, 'supabase/v2/tests', name), 'utf8').split('\n').filter(line => !line.startsWith('\\')).join('\n')
    await db.query(sql)
    console.log(`${name}: PASS`)
  }
  const contract = fs.readFileSync(path.join(root, 'supabase/v2/tests/community_contract.sql'), 'utf8').split('\n').filter(line => !line.startsWith('\\')).join('\n')
  await db.query(contract.slice(0, contract.indexOf('do $$ begin')) + '\nreset role; commit;')
  const clients = []
  async function actor(id) {
    const client = new Client({ connectionString: value }); await client.connect()
    await client.query("select set_config('request.jwt.claim.sub',$1,false)", [id]); await client.query('set role authenticated')
    clients.push(client); return client
  }
  async function lockWait(pid) {
    for (let attempt = 0; attempt < 50; attempt++) {
      if ((await db.query("select wait_event_type='Lock' as waiting from pg_stat_activity where pid=$1", [pid])).rows[0]?.waiting) return
      await new Promise(resolve => setTimeout(resolve, 25))
    }
    throw new Error('The competing request did not wait for its transaction lock.')
  }
  const send = (client, nonce, booking = null) => client.query('select public.send_community_message($1,$2,$3) as message', ['A fictional message', nonce, booking])
  try {
    const a = await actor('41000000-0000-4000-8000-000000000001'), b = await actor('41000000-0000-4000-8000-000000000001')
    const bpid = (await b.query('select pg_backend_pid() as id')).rows[0].id
    await a.query('begin'); const first = await send(a, '45000000-0000-4000-8000-000000000001')
    await b.query('begin'); const retry = send(b, '45000000-0000-4000-8000-000000000001').then(result => result.rows[0].message)
    await lockWait(bpid); await a.query('commit'); const retried = await retry; await b.query('commit')
    if (retried.id !== first.rows[0].message.id) throw new Error('Concurrent retry created a different message.')
    console.log('Concurrent duplicate-send prevention: PASS')
    for (let index = 0; index < 18; index++) await a.query('select public.send_community_message($1,gen_random_uuid())', ['A fictional rate-limit fixture'])
    await a.query('begin'); await send(a, '45000000-0000-4000-8000-000000000002')
    await b.query('begin'); const overflow = send(b, '45000000-0000-4000-8000-000000000003').then(() => 'unexpected_success', error => error.message)
    await lockWait(bpid); await a.query('commit'); const limited = await overflow; await b.query('rollback')
    if (limited !== 'community_rate_limited') throw new Error('Concurrent requests bypassed the send limit.')
    console.log('Concurrent sender rate limit: PASS')
    const player = await actor('41000000-0000-4000-8000-000000000002'), leaving = await actor('41000000-0000-4000-8000-000000000002')
    const booking = '43000000-0000-4000-8000-000000000001'
    const match = (await db.query('select id from public.matches where booking_id=$1', [booking])).rows[0].id
    await player.query('select public.join_open_match($1)', [match])
    const leavePid = (await leaving.query('select pg_backend_pid() as id')).rows[0].id
    await player.query('begin'); await send(player, '45000000-0000-4000-8000-000000000004', booking)
    await leaving.query('begin'); const leave = leaving.query('select public.leave_open_match($1)', [match])
    await lockWait(leavePid); await player.query('commit'); await leave; await leaving.query('commit')
    console.log('Send-first / leave-second ordering: PASS')
    await player.query('select public.join_open_match($1)', [match])
    await leaving.query('begin'); await leaving.query('select public.leave_open_match($1)', [match])
    const playerPid = (await player.query('select pg_backend_pid() as id')).rows[0].id
    await player.query('begin'); const denied = send(player, '45000000-0000-4000-8000-000000000005', booking).then(() => 'unexpected_success', error => error.message)
    await lockWait(playerPid); await leaving.query('commit'); const result = await denied; await player.query('rollback')
    if (result !== 'community_access_required') throw new Error('A player who left could send a private message.')
    console.log('Leave-first / send-second denial: PASS')
    const other = await actor('41000000-0000-4000-8000-000000000003')
    const otherPid = (await other.query('select pg_backend_pid() as id')).rows[0].id
    await player.query('begin'); const orderedFirst = await send(player, '45000000-0000-4000-8000-000000000006')
    await other.query('begin'); const orderedNext = send(other, '45000000-0000-4000-8000-000000000007')
    await lockWait(otherPid); await player.query('commit'); const later = await orderedNext; await other.query('commit')
    if (BigInt(later.rows[0].message.id) <= BigInt(orderedFirst.rows[0].message.id)) throw new Error('Room ids did not follow commit order.')
    console.log('Concurrent senders preserve reconnect cursor order: PASS')
  } finally { for (const client of clients) { await client.query('rollback').catch(() => undefined); await client.end() } }
} finally { await db.end() }
