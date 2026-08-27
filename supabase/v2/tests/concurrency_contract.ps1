# UNEEM V2 hosted concurrency/race contract.
#
# Run this from a linked Supabase CLI workspace (the same directory where
# `supabase db query --linked` already works). It opens independent CLI jobs so
# the assertions exercise real concurrent database sessions instead of a single
# transactional connection.
#
# Scenarios:
#   1. Same user races two facilities -> exactly one active booking survives.
#   2. Two users race the same facility slot -> exactly one booking survives.
#   3. Two users race the last public match spot -> exactly one participant joins.
#
# The script creates only fixed, clearly namespaced test fixtures, verifies both
# workers reached a shared committed barrier, and removes all fixtures in a
# finally block.

$ErrorActionPreference = 'Stop'

$linkedWorkspace = (Get-Location).Path
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("uneem-concurrency-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null

function Write-SqlFile {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$Sql
    )

    $path = Join-Path $tempRoot $Name
    [System.IO.File]::WriteAllText(
        $path,
        $Sql,
        (New-Object System.Text.UTF8Encoding($false))
    )
    return $path
}

function Invoke-LinkedQuery {
    param([Parameter(Mandatory = $true)][string]$File)

    Push-Location $linkedWorkspace
    $previousErrorActionPreference = $ErrorActionPreference
    try {
        # Windows PowerShell 5.1 promotes native stderr (including benign
        # Supabase CLI progress such as "Initialising login role...") into a
        # NativeCommandError. Temporarily allow native stderr through and rely on
        # the process exit code for authoritative failure detection.
        $ErrorActionPreference = 'Continue'
        $output = (& npx --yes supabase@latest db query --linked --agent yes -f $File 2>&1 | Out-String)
        $code = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
        Pop-Location
    }

    if ($code -ne 0) {
        throw "Supabase query failed for $File`n$output"
    }

    return $output
}

function Invoke-RacePair {
    param(
        [Parameter(Mandatory = $true)][string]$Left,
        [Parameter(Mandatory = $true)][string]$Right,
        [Parameter(Mandatory = $true)][string]$Name
    )

    $runner = {
        param($Workspace, $SqlFile)
        Set-Location $Workspace
        $text = (& npx --yes supabase@latest db query --linked --agent yes -f $SqlFile 2>&1 | Out-String)
        [pscustomobject]@{
            ExitCode = $LASTEXITCODE
            Output = $text
        }
    }

    $leftJob = Start-Job -ScriptBlock $runner -ArgumentList $linkedWorkspace, $Left
    $rightJob = Start-Job -ScriptBlock $runner -ArgumentList $linkedWorkspace, $Right

    try {
        Wait-Job -Job $leftJob, $rightJob | Out-Null
        $leftResult = Receive-Job -Job $leftJob
        $rightResult = Receive-Job -Job $rightJob
    }
    finally {
        Remove-Job -Job $leftJob, $rightJob -Force -ErrorAction SilentlyContinue
    }

    if ($leftResult.ExitCode -ne 0 -or $rightResult.ExitCode -ne 0) {
        throw @"
UNEEM concurrency scenario '$Name' failed.
--- left ---
$($leftResult.Output)
--- right ---
$($rightResult.Output)
"@
    }
}

$setupSql = @'
begin;

-- Idempotent cleanup in case a previous operator run was interrupted.
drop table if exists private.uneem_concurrency_barrier;
drop table if exists private.uneem_concurrency_config;

delete from public.match_participants
where match_id = '94000000-0000-4000-8000-000000000001';

delete from public.matches
where id = '94000000-0000-4000-8000-000000000001'
   or booking_id = '95000000-0000-4000-8000-000000000001';

delete from public.bookings
where user_id in (
  '93000000-0000-4000-8000-000000000001',
  '93000000-0000-4000-8000-000000000002',
  '93000000-0000-4000-8000-000000000003',
  '93000000-0000-4000-8000-000000000004',
  '93000000-0000-4000-8000-000000000005',
  '93000000-0000-4000-8000-000000000006'
)
or pitch_id in (
  '93500000-0000-4000-8000-000000000001',
  '93500000-0000-4000-8000-000000000002',
  '93500000-0000-4000-8000-000000000003',
  '93500000-0000-4000-8000-000000000004'
);

delete from public.pitches
where id in (
  '93500000-0000-4000-8000-000000000001',
  '93500000-0000-4000-8000-000000000002',
  '93500000-0000-4000-8000-000000000003',
  '93500000-0000-4000-8000-000000000004'
);

delete from auth.users
where id in (
  '93000000-0000-4000-8000-000000000001',
  '93000000-0000-4000-8000-000000000002',
  '93000000-0000-4000-8000-000000000003',
  '93000000-0000-4000-8000-000000000004',
  '93000000-0000-4000-8000-000000000005',
  '93000000-0000-4000-8000-000000000006'
);

create table private.uneem_concurrency_barrier (
  scenario text not null,
  worker text not null,
  joined_at timestamptz not null default clock_timestamp(),
  primary key (scenario, worker)
);

create table private.uneem_concurrency_config (
  scenario text primary key,
  starts_at timestamptz not null
);

revoke all on private.uneem_concurrency_barrier from public, anon, authenticated, service_role;
revoke all on private.uneem_concurrency_config from public, anon, authenticated, service_role;

-- Keep every race in a deterministic future UTC daytime window. This avoids
-- wall-clock-dependent failures when the harness is run late in the day while
-- preserving the same booking-window, alignment, and capacity invariants.
insert into private.uneem_concurrency_config (scenario, starts_at)
values
  ('one_active', (date_trunc('day', now() at time zone 'UTC') + interval '1 day 10 hours') at time zone 'UTC'),
  ('same_slot', (date_trunc('day', now() at time zone 'UTC') + interval '1 day 12 hours') at time zone 'UTC'),
  ('match_join', (date_trunc('day', now() at time zone 'UTC') + interval '1 day 14 hours') at time zone 'UTC');

set local session_replication_role = replica;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000','93000000-0000-4000-8000-000000000001','authenticated','authenticated','race-one@usmba.ac.ma','',now(),'','','','','{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()),
  ('00000000-0000-0000-0000-000000000000','93000000-0000-4000-8000-000000000002','authenticated','authenticated','race-slot-one@usmba.ac.ma','',now(),'','','','','{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()),
  ('00000000-0000-0000-0000-000000000000','93000000-0000-4000-8000-000000000003','authenticated','authenticated','race-slot-two@usmba.ac.ma','',now(),'','','','','{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()),
  ('00000000-0000-0000-0000-000000000000','93000000-0000-4000-8000-000000000004','authenticated','authenticated','race-organizer@usmba.ac.ma','',now(),'','','','','{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()),
  ('00000000-0000-0000-0000-000000000000','93000000-0000-4000-8000-000000000005','authenticated','authenticated','race-match-one@usmba.ac.ma','',now(),'','','','','{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()),
  ('00000000-0000-0000-0000-000000000000','93000000-0000-4000-8000-000000000006','authenticated','authenticated','race-match-two@usmba.ac.ma','',now(),'','','','','{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now());

insert into public.profiles (
  id, student_id, full_name, username, role, status, email_kind, identity_status
) values
  ('93000000-0000-4000-8000-000000000001','R930000001','Race One Active','race_one_active','student','approved','academic','verified'),
  ('93000000-0000-4000-8000-000000000002','R930000002','Race Slot One','race_slot_one','student','approved','academic','verified'),
  ('93000000-0000-4000-8000-000000000003','R930000003','Race Slot Two','race_slot_two','student','approved','academic','verified'),
  ('93000000-0000-4000-8000-000000000004','R930000004','Race Organizer','race_organizer','student','approved','academic','verified'),
  ('93000000-0000-4000-8000-000000000005','R930000005','Race Match One','race_match_one','student','approved','academic','verified'),
  ('93000000-0000-4000-8000-000000000006','R930000006','Race Match Two','race_match_two','student','approved','academic','verified');

set local session_replication_role = origin;

insert into public.pitches (
  id, name, location, sport_type, capacity, timezone, open_time, close_time,
  slot_duration_minutes, booking_window_hours, booking_frequency_enabled,
  booking_frequency_days, cancellation_cutoff_minutes, is_active, sort_order
) values
  ('93500000-0000-4000-8000-000000000001','Race Facility A','Concurrency Lab','test',10,'UTC','00:00','23:59',60,168,false,1,0,true,9001),
  ('93500000-0000-4000-8000-000000000002','Race Facility B','Concurrency Lab','test',10,'UTC','00:00','23:59',60,168,false,1,0,true,9002),
  ('93500000-0000-4000-8000-000000000003','Race Shared Slot','Concurrency Lab','test',10,'UTC','00:00','23:59',60,168,false,1,0,true,9003),
  ('93500000-0000-4000-8000-000000000004','Race Match Pitch','Concurrency Lab','test',2,'UTC','00:00','23:59',60,168,false,1,0,true,9004);

insert into public.bookings (id, user_id, pitch_id, starts_at, ends_at, status)
select
  '95000000-0000-4000-8000-000000000001',
  '93000000-0000-4000-8000-000000000004',
  '93500000-0000-4000-8000-000000000004',
  starts_at,
  starts_at + interval '1 hour',
  'scheduled'
from private.uneem_concurrency_config
where scenario = 'match_join';

insert into public.matches (id, booking_id, organizer_id, visibility, reserved_spots, status)
values (
  '94000000-0000-4000-8000-000000000001',
  '95000000-0000-4000-8000-000000000001',
  '93000000-0000-4000-8000-000000000004',
  'open', 0, 'active'
);

commit;
'@

$cleanupSql = @'
begin;

delete from public.match_participants
where match_id = '94000000-0000-4000-8000-000000000001';

delete from public.matches
where id = '94000000-0000-4000-8000-000000000001'
   or booking_id = '95000000-0000-4000-8000-000000000001';

delete from public.bookings
where user_id in (
  '93000000-0000-4000-8000-000000000001',
  '93000000-0000-4000-8000-000000000002',
  '93000000-0000-4000-8000-000000000003',
  '93000000-0000-4000-8000-000000000004',
  '93000000-0000-4000-8000-000000000005',
  '93000000-0000-4000-8000-000000000006'
)
or pitch_id in (
  '93500000-0000-4000-8000-000000000001',
  '93500000-0000-4000-8000-000000000002',
  '93500000-0000-4000-8000-000000000003',
  '93500000-0000-4000-8000-000000000004'
);

delete from public.pitches
where id in (
  '93500000-0000-4000-8000-000000000001',
  '93500000-0000-4000-8000-000000000002',
  '93500000-0000-4000-8000-000000000003',
  '93500000-0000-4000-8000-000000000004'
);

delete from auth.users
where id in (
  '93000000-0000-4000-8000-000000000001',
  '93000000-0000-4000-8000-000000000002',
  '93000000-0000-4000-8000-000000000003',
  '93000000-0000-4000-8000-000000000004',
  '93000000-0000-4000-8000-000000000005',
  '93000000-0000-4000-8000-000000000006'
);

drop table if exists private.uneem_concurrency_barrier;
drop table if exists private.uneem_concurrency_config;

commit;
'@

$barrier = @'
begin;
insert into private.uneem_concurrency_barrier (scenario, worker)
values ('__SCENARIO__', '__WORKER__')
on conflict (scenario, worker) do nothing;
commit;

do $$
declare
  v_deadline timestamptz := clock_timestamp() + interval '15 seconds';
begin
  while (select count(*) from private.uneem_concurrency_barrier where scenario = '__SCENARIO__') < 2 loop
    if clock_timestamp() >= v_deadline then
      raise exception 'concurrency_barrier_timeout:__SCENARIO__';
    end if;
    perform pg_sleep(0.05);
  end loop;
end;
$$;
'@

function New-WorkerSql {
    param(
        [string]$Scenario,
        [string]$Worker,
        [string]$UserId,
        [string]$Operation
    )

    $prefix = $barrier.Replace('__SCENARIO__', $Scenario).Replace('__WORKER__', $Worker)
    return $prefix + "`n" + @"
select set_config(
  'uneem.race_start',
  (select starts_at::text from private.uneem_concurrency_config where scenario = '$Scenario'),
  false
);
select set_config('request.jwt.claim.sub', '$UserId', false);
set role authenticated;
$Operation
reset role;
"@
}

$oneActiveA = New-WorkerSql -Scenario 'one_active' -Worker 'a' -UserId '93000000-0000-4000-8000-000000000001' -Operation @'
do $$
begin
  begin
    perform public.create_booking(
      '93500000-0000-4000-8000-000000000001',
      current_setting('uneem.race_start')::timestamptz
    );
  exception when others then
    if sqlerrm <> 'active_booking_exists' then raise; end if;
  end;
end;
$$;
'@

$oneActiveB = New-WorkerSql -Scenario 'one_active' -Worker 'b' -UserId '93000000-0000-4000-8000-000000000001' -Operation @'
do $$
begin
  begin
    perform public.create_booking(
      '93500000-0000-4000-8000-000000000002',
      current_setting('uneem.race_start')::timestamptz + interval '1 hour'
    );
  exception when others then
    if sqlerrm <> 'active_booking_exists' then raise; end if;
  end;
end;
$$;
'@

$sameSlotA = New-WorkerSql -Scenario 'same_slot' -Worker 'a' -UserId '93000000-0000-4000-8000-000000000002' -Operation @'
do $$
begin
  begin
    perform public.create_booking(
      '93500000-0000-4000-8000-000000000003',
      current_setting('uneem.race_start')::timestamptz
    );
  exception when others then
    if sqlerrm <> 'slot_unavailable' then raise; end if;
  end;
end;
$$;
'@

$sameSlotB = New-WorkerSql -Scenario 'same_slot' -Worker 'b' -UserId '93000000-0000-4000-8000-000000000003' -Operation @'
do $$
begin
  begin
    perform public.create_booking(
      '93500000-0000-4000-8000-000000000003',
      current_setting('uneem.race_start')::timestamptz
    );
  exception when others then
    if sqlerrm <> 'slot_unavailable' then raise; end if;
  end;
end;
$$;
'@

$matchJoinA = New-WorkerSql -Scenario 'match_join' -Worker 'a' -UserId '93000000-0000-4000-8000-000000000005' -Operation @'
do $$
begin
  begin
    perform public.join_open_match('94000000-0000-4000-8000-000000000001');
  exception when others then
    if sqlerrm <> 'match_full' then raise; end if;
  end;
end;
$$;
'@

$matchJoinB = New-WorkerSql -Scenario 'match_join' -Worker 'b' -UserId '93000000-0000-4000-8000-000000000006' -Operation @'
do $$
begin
  begin
    perform public.join_open_match('94000000-0000-4000-8000-000000000001');
  exception when others then
    if sqlerrm <> 'match_full' then raise; end if;
  end;
end;
$$;
'@

$assertSql = @'
do $$
begin
  if (select count(*) from private.uneem_concurrency_barrier where scenario = 'one_active') <> 2 then
    raise exception 'FAIL: one-active workers did not both reach the concurrency barrier';
  end if;
  if (select count(*) from private.uneem_concurrency_barrier where scenario = 'same_slot') <> 2 then
    raise exception 'FAIL: same-slot workers did not both reach the concurrency barrier';
  end if;
  if (select count(*) from private.uneem_concurrency_barrier where scenario = 'match_join') <> 2 then
    raise exception 'FAIL: match-join workers did not both reach the concurrency barrier';
  end if;

  if (
    select count(*)
    from public.bookings
    where user_id = '93000000-0000-4000-8000-000000000001'
      and status = 'scheduled'
      and ends_at > now()
  ) <> 1 then
    raise exception 'FAIL: same user race bypassed the one-active-booking invariant';
  end if;

  if (
    select count(*)
    from public.bookings b
    where b.pitch_id = '93500000-0000-4000-8000-000000000003'
      and b.status = 'scheduled'
      and b.starts_at = (select starts_at from private.uneem_concurrency_config where scenario = 'same_slot')
  ) <> 1 then
    raise exception 'FAIL: same facility slot was double-booked under concurrency';
  end if;

  if (
    select count(*)
    from public.match_participants
    where match_id = '94000000-0000-4000-8000-000000000001'
  ) <> 1 then
    raise exception 'FAIL: concurrent joins overfilled or emptied the last public match spot';
  end if;
end;
$$;

select 'UNEEM CONCURRENCY CONTRACT PASS' as result;
'@

$setupFile = Write-SqlFile 'setup.sql' $setupSql
$cleanupFile = Write-SqlFile 'cleanup.sql' $cleanupSql
$oneAFile = Write-SqlFile 'one-active-a.sql' $oneActiveA
$oneBFile = Write-SqlFile 'one-active-b.sql' $oneActiveB
$slotAFile = Write-SqlFile 'same-slot-a.sql' $sameSlotA
$slotBFile = Write-SqlFile 'same-slot-b.sql' $sameSlotB
$matchAFile = Write-SqlFile 'match-a.sql' $matchJoinA
$matchBFile = Write-SqlFile 'match-b.sql' $matchJoinB
$assertFile = Write-SqlFile 'assert.sql' $assertSql

$setupCompleted = $false
try {
    Invoke-LinkedQuery $setupFile | Out-Null
    $setupCompleted = $true

    Invoke-RacePair $oneAFile $oneBFile 'one_active'
    Invoke-RacePair $slotAFile $slotBFile 'same_slot'
    Invoke-RacePair $matchAFile $matchBFile 'match_join'

    $assertOutput = Invoke-LinkedQuery $assertFile
    if ($assertOutput -notmatch 'UNEEM CONCURRENCY CONTRACT PASS') {
        throw "Concurrency assertions did not return the PASS marker.`n$assertOutput"
    }

    Write-Output $assertOutput.Trim()
}
finally {
    if ($setupCompleted) {
        try {
            Invoke-LinkedQuery $cleanupFile | Out-Null
        }
        catch {
            Write-Warning "Concurrency cleanup failed. Re-run this contract once the linked Supabase API is healthy; setup is idempotent and removes its previous fixtures first. $($_.Exception.Message)"
        }
    }

    Remove-Item -Recurse -Force $tempRoot -ErrorAction SilentlyContinue
}