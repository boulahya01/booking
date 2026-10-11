-- UNEEM v2.1 universal Student ID verification contract, schema through 060.
-- Run on an isolated database as its owner. Auth/profile triggers remain enabled:
-- signup and confirmation assertions exercise the real production functions.
-- All fixtures and test helpers roll back. No psql-only commands or external I/O.
-- Sequential review assertions prove stale/duplicate behavior, not concurrent
-- transaction scheduling; submission/review lock ordering needs a separate race test.
begin;
set local timezone = 'UTC';
set local statement_timeout = '30s';

create function pg_temp.assert_true(p_condition boolean, p_message text)
returns void language plpgsql as $$
begin
  if p_condition is distinct from true then raise exception 'FAIL: %', p_message; end if;
end;
$$;

-- SECURITY INVOKER is intentional: assertions use the authenticated role's real
-- grants and RLS, never the owner authority of this harness.
create function pg_temp.expect_error(p_statement text, p_error text)
returns void language plpgsql security invoker as $$
declare v_caught boolean := false;
begin
  begin
    execute p_statement;
  exception when others then
    if position(p_error in sqlerrm) = 0 then
      raise exception 'FAIL: expected %, got % [%]', p_error, sqlerrm, sqlstate;
    end if;
    v_caught := true;
  end;
  if not v_caught then raise exception 'FAIL: statement unexpectedly succeeded: %', p_statement; end if;
end;
$$;

-- Genuine Auth-trigger signups. Caller-provided role/status/identity metadata
-- must never grant identity or access, including on a confirmed academic email.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select
  '00000000-0000-0000-0000-000000000000'::uuid, fixture.id::uuid,
  'authenticated', 'authenticated', fixture.email, '',
  case when fixture.confirmed then now() else null end,
  '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('full_name', fixture.full_name, 'username', fixture.username,
    'student_id', fixture.student_id, 'role', 'admin', 'status', 'approved', 'identity_status', 'verified'),
  now(), now()
from (values
  ('61000000-0000-4000-8000-000000000001', 'uv21-academic@usmba.ac.ma', false, 'UV Academic', 'uv21_academic', null::text),
  ('61000000-0000-4000-8000-000000000002', 'uv21-personal@example.com', true, 'UV Personal', 'uv21_personal', 's123'),
  ('61000000-0000-4000-8000-000000000003', 'uv21-organizer@example.com', true, 'UV Organizer', 'uv21_organizer', 'S610000003'),
  ('61000000-0000-4000-8000-000000000004', 'uv21-admin@usmba.ac.ma', true, 'UV Admin', 'uv21_admin', 'S610000004'),
  ('61000000-0000-4000-8000-000000000005', 'uv21-auto@usmba.ac.ma', true, 'UV Auto Confirm', 'uv21_auto', null),
  ('61000000-0000-4000-8000-000000000006', 'uv21-suspended@usmba.ac.ma', true, 'UV Suspended', 'uv21_suspended', null),
  ('61000000-0000-4000-8000-000000000007', 'uv21-drift@example.com', false, 'UV Unconfirmed', 'uv21_unconfirmed', 'S610000007')
) as fixture(id, email, confirmed, full_name, username, student_id);

select pg_temp.assert_true((select count(*) = 7 from public.profiles
  where id between '61000000-0000-4000-8000-000000000001'::uuid and '61000000-0000-4000-8000-000000000007'::uuid
  and role = 'student' and status = 'pending' and identity_status = 'required'
  and verified_student_id_at is null), 'signup must ignore metadata authority for every email kind');
select pg_temp.assert_true((select student_id = 'S123' and email_kind = 'personal'
  from public.profiles where id = '61000000-0000-4000-8000-000000000002'), 'lowercase signup ID canonicalization');
select pg_temp.assert_true((select student_id is null and email_kind = 'academic'
  from public.profiles where id = '61000000-0000-4000-8000-000000000005'), 'confirmed academic signup may omit ID but must require verification');

-- Privileged fixtures represent pre-existing reviewed identities/admin authority,
-- not an alternative client-facing way to approve an account.
update public.profiles set status = 'approved', identity_status = 'verified', verified_student_id_at = now()
  where id in ('61000000-0000-4000-8000-000000000003', '61000000-0000-4000-8000-000000000004', '61000000-0000-4000-8000-000000000007');
update public.profiles set role = 'admin' where id = '61000000-0000-4000-8000-000000000004';
insert into storage.objects(bucket_id, name) values
  ('student-verification', '61000000-0000-4000-8000-000000000001/card.webp'),
  ('student-verification', '61000000-0000-4000-8000-000000000002/card.webp'),
  ('student-verification', '61000000-0000-4000-8000-000000000006/card.webp');
insert into public.pitches(id, name, location, sport_type, capacity, timezone, open_time, close_time,
  slot_duration_minutes, booking_window_hours, booking_frequency_enabled, booking_frequency_days,
  cancellation_cutoff_minutes, is_active, sort_order) values
  ('62000000-0000-4000-8000-000000000001', 'UV Contract Pitch', 'Test Campus', 'football', 10, 'UTC', '00:00', '24:00', 60, 24, false, 1, 0, true, 0),
  ('62000000-0000-4000-8000-000000000002', 'UV Hidden Pitch', 'Test Campus', 'football', 10, 'UTC', '00:00', '24:00', 60, 24, false, 1, 0, false, 0);
insert into public.bookings(id, user_id, pitch_id, starts_at, ends_at, status) values
  ('63000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000003', '62000000-0000-4000-8000-000000000001', date_trunc('hour', now()) + interval '2h', date_trunc('hour', now()) + interval '3h', 'scheduled'),
  ('63000000-0000-4000-8000-000000000002', '61000000-0000-4000-8000-000000000003', '62000000-0000-4000-8000-000000000001', date_trunc('hour', now()) + interval '4h', date_trunc('hour', now()) + interval '5h', 'scheduled'),
  ('63000000-0000-4000-8000-000000000003', '61000000-0000-4000-8000-000000000003', '62000000-0000-4000-8000-000000000001', date_trunc('hour', now()) + interval '6h', date_trunc('hour', now()) + interval '7h', 'scheduled'),
  ('63000000-0000-4000-8000-000000000004', '61000000-0000-4000-8000-000000000005', '62000000-0000-4000-8000-000000000001', date_trunc('hour', now()) + interval '10h', date_trunc('hour', now()) + interval '11h', 'scheduled'),
  ('63000000-0000-4000-8000-000000000005', '61000000-0000-4000-8000-000000000006', '62000000-0000-4000-8000-000000000001', date_trunc('hour', now()) + interval '12h', date_trunc('hour', now()) + interval '13h', 'scheduled');
update public.bookings set status = 'cancelled', cancelled_at = now(), cancelled_by = user_id
  where id = '63000000-0000-4000-8000-000000000003';
insert into public.matches(id, booking_id, organizer_id, visibility) values
  ('64000000-0000-4000-8000-000000000001', '63000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000003', 'open'),
  ('64000000-0000-4000-8000-000000000002', '63000000-0000-4000-8000-000000000002', '61000000-0000-4000-8000-000000000003', 'private');
insert into public.match_participants(match_id, user_id) values
  ('64000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000004'),
  ('64000000-0000-4000-8000-000000000002', '61000000-0000-4000-8000-000000000004');

-- 1. Unconfirmed users cannot browse or use identity APIs even with a JWT.
select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select pg_temp.assert_true(not private.has_browse_access() and not private.has_app_access(), 'unconfirmed access must fail closed');
select pg_temp.assert_true((select restriction_reason = 'email_confirmation_required' and not can_use_sports
  from public.get_my_session_context()), 'session must expose authoritative confirmation requirement');
select pg_temp.assert_true((select count(*) = 0 from public.pitches where id = '62000000-0000-4000-8000-000000000001'), 'unconfirmed direct pitch read');
select pg_temp.expect_error($q$select * from public.list_open_matches()$q$, 'account_not_approved');
select pg_temp.expect_error($q$select public.update_my_student_id('s123')$q$, 'email_confirmation_required');
select pg_temp.expect_error($q$select public.submit_identity_verification('s123', '61000000-0000-4000-8000-000000000001/card.webp')$q$, 'email_confirmation_required');
reset role;

-- The real confirmation trigger changes mailbox authority without approving ID.
update auth.users set email_confirmed_at = now() where id = '61000000-0000-4000-8000-000000000001';
select pg_temp.assert_true((select status = 'pending' and identity_status = 'required' and verified_student_id_at is null
  from public.profiles where id = '61000000-0000-4000-8000-000000000001'), 'academic email confirmation cannot approve identity');

-- 2. Confirmed pending users can browse active facilities and public sports
-- context; direct profile/evidence reads and private rosters remain scoped.
set local role authenticated;
select pg_temp.assert_true(private.has_browse_access() and not private.has_app_access(), 'confirmed academic browse-only capability');
select pg_temp.assert_true((select not can_use_sports and needs_identity_action from public.get_my_account_state()), 'academic account state cannot retain bypass');
select pg_temp.assert_true((select count(*) = 1 from public.pitches where id in ('62000000-0000-4000-8000-000000000001', '62000000-0000-4000-8000-000000000002')), 'pending pitch visibility excludes inactive facilities');
select pg_temp.assert_true((select count(*) > 0 from public.get_pitch_availability('62000000-0000-4000-8000-000000000001')), 'pending user can browse availability');
select pg_temp.assert_true((select count(*) = 1 from public.list_open_matches() where match_id = '64000000-0000-4000-8000-000000000001'), 'pending user can browse public matches');
select pg_temp.assert_true((select count(*) = 0 from public.list_open_matches() where match_id = '64000000-0000-4000-8000-000000000002'), 'private match stays out of discovery');
select pg_temp.assert_true((select match_id is null and not match_open from public.get_booking_details('63000000-0000-4000-8000-000000000002')), 'private booking hides match identity');
select pg_temp.assert_true((select count(*) = 0 from public.get_booking_details('63000000-0000-4000-8000-000000000003')), 'another user cancelled booking stays private');
select pg_temp.assert_true((select count(*) = 2 from public.list_booking_roster('63000000-0000-4000-8000-000000000001')), 'public booking roster is browsable');
select pg_temp.assert_true((select count(*) = 1 from public.list_booking_roster('63000000-0000-4000-8000-000000000002')), 'private booking roster hides participants');
select pg_temp.expect_error($q$select * from public.get_match_roster('64000000-0000-4000-8000-000000000002')$q$, 'match_not_visible');
select pg_temp.assert_true((select count(*) = 0 from public.list_my_matches()), 'pending my-matches read is owner scoped');
select pg_temp.assert_true((select count(*) = 0 from public.profiles where id = '61000000-0000-4000-8000-000000000003'), 'browse access cannot reveal private profile/Student ID');
select pg_temp.assert_true((select count(*) = 0 from storage.objects where bucket_id = 'student-verification' and name = '61000000-0000-4000-8000-000000000002/card.webp'), 'another student card stays private');

-- 3. Direct API mutation attempts fail at the database, not just disabled UI.
select pg_temp.expect_error($q$select public.create_booking('62000000-0000-4000-8000-000000000001', date_trunc('hour', now()) + interval '8h')$q$, 'account_not_approved');
select pg_temp.expect_error($q$select public.create_open_match('63000000-0000-4000-8000-000000000001', 0)$q$, 'account_not_approved');
select pg_temp.expect_error($q$select public.join_open_match('64000000-0000-4000-8000-000000000001')$q$, 'account_not_approved');
select pg_temp.expect_error($q$select public.set_match_visibility('64000000-0000-4000-8000-000000000001', 'private')$q$, 'account_not_approved');
select pg_temp.expect_error($q$select public.update_match_reserved_spots('64000000-0000-4000-8000-000000000001', 1)$q$, 'account_not_approved');
select pg_temp.expect_error($q$select public.add_match_reservation('64000000-0000-4000-8000-000000000001', null, 'Guest Name')$q$, 'account_not_approved');
select pg_temp.expect_error($q$select * from public.search_usernames('uv21', 5)$q$, 'account_not_approved');
select pg_temp.expect_error($q$update public.profiles set identity_status = 'verified', status = 'approved' where id = auth.uid()$q$, 'permission denied');
select pg_temp.expect_error($q$insert into public.bookings(user_id, pitch_id, starts_at, ends_at) values (auth.uid(), '62000000-0000-4000-8000-000000000001', now()+interval '10h', now()+interval '11h')$q$, 'permission denied');
select pg_temp.expect_error($q$insert into public.matches(booking_id, organizer_id) values ('63000000-0000-4000-8000-000000000003', auth.uid())$q$, 'permission denied');
select pg_temp.expect_error($q$insert into public.match_participants(match_id, user_id) values ('64000000-0000-4000-8000-000000000001', auth.uid())$q$, 'permission denied');
select pg_temp.expect_error($q$insert into public.match_reservations(match_id, profile_id, created_by) values ('64000000-0000-4000-8000-000000000001', auth.uid(), auth.uid())$q$, 'permission denied');
select pg_temp.expect_error($q$insert into public.identity_verification_attempts(user_id, claimed_student_id, card_storage_path, status) values (auth.uid(), 'S123', 'fake.webp', 'approved')$q$, 'permission denied');

-- 4. All input boundaries use S/s plus digits (1-49 digits), canonically uppercase.
do $$
declare v_id text;
begin
  foreach v_id in array array[null, '', 'S', 'A123', 'S12x', '123', 'S-123', 'S12.3', 'S' || repeat('1', 50)] loop
    perform pg_temp.expect_error(format('select public.update_my_student_id(%L)', v_id), 'invalid_student_id');
    perform pg_temp.expect_error(format('select public.submit_identity_verification(%L, %L)', v_id, '61000000-0000-4000-8000-000000000001/card.webp'), 'invalid_student_id');
  end loop;
end;
$$;
select public.update_my_student_id('s' || repeat('1', 49));
select pg_temp.assert_true((select char_length(student_id) = 50 and left(student_id, 1) = 'S' and identity_status = 'required'
  from public.get_my_account_state()), '50-character normalized ID must be accepted without verification');
select public.update_my_student_id('s123');
select pg_temp.assert_true((select student_id = 'S123' and not can_use_sports from public.get_my_account_state()), 'lowercase short ID correction cannot grant sports');
select pg_temp.expect_error($q$select public.submit_identity_verification('S123', '61000000-0000-4000-8000-000000000002/card.webp')$q$, 'invalid_student_card_path');
select pg_temp.expect_error($q$select public.submit_identity_verification('S123', '61000000-0000-4000-8000-000000000001/missing.webp')$q$, 'student_card_not_found');
select set_config('uv21.old_attempt', (public.submit_identity_verification('s123', '61000000-0000-4000-8000-000000000001/card.webp')).id::text, true);
select pg_temp.assert_true((select identity_status = 'pending' and not can_use_sports from public.get_my_account_state()), 'submission is not approval');
select public.update_my_student_id('S123');
select pg_temp.assert_true((select count(*) = 1 from public.identity_verification_attempts where user_id = auth.uid()), 'no-op ID edit must not replace evidence');
select public.update_my_student_id('s124');
select set_config('uv21.current_attempt', (select id::text from public.identity_verification_attempts where user_id = auth.uid() and status = 'pending'), true);
select pg_temp.assert_true((select count(*) = 1 from public.identity_verification_attempts where user_id = auth.uid() and status = 'pending'
  and claimed_student_id = 'S124' and card_storage_path = '61000000-0000-4000-8000-000000000001/card.webp'), 'pending edit creates exactly one current attempt with preserved evidence');
select pg_temp.assert_true((select status = 'cancelled' and reason_code = 'superseded_by_resubmission' and claimed_student_id = 'S123'
  and reviewed_at is not null and reviewed_by is null and card_storage_path = '61000000-0000-4000-8000-000000000001/card.webp'
  from public.identity_verification_attempts where id = current_setting('uv21.old_attempt')::uuid), 'pending correction preserves cancelled history');
select pg_temp.expect_error(format('select public.review_identity_verification(%L, %L, null)', current_setting('uv21.current_attempt'), 'approved'), 'admin_required');
reset role;

-- Another unverified account can submit the same claim before ownership is approved.
select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000002', true);
set local role authenticated;
select pg_temp.assert_true(private.has_browse_access() and not private.has_app_access(), 'personal confirmed account has the same browse-only gate');
select set_config('uv21.duplicate_attempt', (public.submit_identity_verification('S124', '61000000-0000-4000-8000-000000000002/card.webp')).id::text, true);
select pg_temp.assert_true((select count(*) = 0 from public.identity_verification_attempts where user_id = '61000000-0000-4000-8000-000000000001'), 'verification attempt history remains owner scoped');
reset role;

-- 5. An admin cannot approve the cancelled stale attempt. Current review grants
-- the corrected claim; a competing pending claim becomes an explicit conflict.
select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000004', true);
set local role authenticated;
select pg_temp.expect_error(format('select public.review_identity_verification(%L, %L, null)', current_setting('uv21.old_attempt'), 'approved'), 'verification_attempt_not_pending');
select public.review_identity_verification(current_setting('uv21.current_attempt')::uuid, 'approved', null);
select pg_temp.assert_true((select status = 'approved' and reviewed_by = auth.uid() and reviewed_at is not null
  from public.identity_verification_attempts where id = current_setting('uv21.current_attempt')::uuid), 'review actor and time recorded');
select pg_temp.assert_true((public.review_identity_verification(current_setting('uv21.duplicate_attempt')::uuid, 'approved', null)).status = 'rejected', 'duplicate approval must reject, not steal identity');
select pg_temp.assert_true((select identity_status = 'conflict' and restriction_reason = 'duplicate_student_identity'
  from public.profiles where id = '61000000-0000-4000-8000-000000000002'), 'duplicate review persists recoverable conflict');
reset role;
select pg_temp.assert_true((select count(*) = 1 from public.profiles where student_id = 'S124' and identity_status = 'verified'), 'verified ID has a single owner');
select pg_temp.expect_error($q$update public.profiles set identity_status = 'verified' where id = '61000000-0000-4000-8000-000000000002'$q$, 'duplicate key');

-- 6. Approved identity enables real booking/join RPCs. Ordinary correction and
-- resubmission cannot release the verified claim, even if the input is unchanged.
select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select pg_temp.assert_true((select can_use_sports and not needs_identity_action and student_id = 'S124' and access_status = 'approved'
  from public.get_my_session_context()), 'review unlocks corrected academic identity');
select pg_temp.expect_error($q$select public.update_my_student_id('S124')$q$, 'identity_already_verified');
select pg_temp.expect_error($q$select public.update_my_student_id('S125')$q$, 'identity_already_verified');
select pg_temp.expect_error($q$select public.submit_identity_verification('S125', '61000000-0000-4000-8000-000000000001/card.webp')$q$, 'identity_already_verified');
select pg_temp.assert_true((public.create_booking('62000000-0000-4000-8000-000000000001', date_trunc('hour', now()) + interval '8h')).user_id = auth.uid(), 'verified student can create a real booking');
select pg_temp.assert_true((public.join_open_match('64000000-0000-4000-8000-000000000001')).user_id = auth.uid(), 'verified student can join a real match');
reset role;

-- An organizer cannot enroll an unverified account by reserving its username.
select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000003', true);
set local role authenticated;
select pg_temp.expect_error($q$select public.add_match_reservation('64000000-0000-4000-8000-000000000001', 'uv21_auto', null)$q$, 'reserved_user_not_found');
select pg_temp.assert_true((select count(*) = 0 from public.search_usernames('uv21_auto', 5)), 'username picker excludes unverified participants');
reset role;

-- 7. Conflict/rejection remains editable; new evidence is still needed after an
-- old rejected attempt, and mailbox edits never auto-approve the correction.
select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000002', true);
set local role authenticated;
select pg_temp.assert_true((public.submit_identity_verification('s124', '61000000-0000-4000-8000-000000000002/card.webp')).reason_code = 'duplicate_student_identity', 'already-owned claim is rejected on submission');
select public.update_my_student_id('s125');
select pg_temp.assert_true((select student_id = 'S125' and identity_status = 'required' and not can_use_sports
  from public.get_my_account_state()), 'editing conflicted ID resets to required, not verified');
select set_config('uv21.personal_attempt', (public.submit_identity_verification('S125', '61000000-0000-4000-8000-000000000002/card.webp')).id::text, true);
reset role;
select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000004', true);
set local role authenticated;
select public.review_identity_verification(current_setting('uv21.personal_attempt')::uuid, 'rejected', 'student_card_unreadable');
reset role;
select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000002', true);
set local role authenticated;
select pg_temp.assert_true((select identity_status = 'rejected' and restriction_reason = 'student_card_unreadable' and not can_use_sports
  from public.get_my_account_state()), 'rejection remains blocked with actionable reason');
select set_config('uv21.personal_retry', (public.submit_identity_verification('s125', '61000000-0000-4000-8000-000000000002/card.webp')).id::text, true);
reset role;
select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000004', true);
set local role authenticated;
select public.review_identity_verification(current_setting('uv21.personal_retry')::uuid, 'approved', null);
reset role;
select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000002', true);
set local role authenticated;
select pg_temp.assert_true((select can_use_sports and student_id = 'S125' from public.get_my_account_state()), 'personal email gains sports only after admin approval');
reset role;

-- 8. A legacy approved academic profile and an auto-confirmed signup cannot
-- bypass universal verification. Suspension is independent of identity review.
update public.profiles set status = 'approved' where id = '61000000-0000-4000-8000-000000000005';
select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000005', true);
set local role authenticated;
select pg_temp.assert_true(private.has_browse_access() and not private.has_app_access(), 'legacy academic approval cannot bypass missing identity');
select pg_temp.expect_error($q$select public.join_open_match('64000000-0000-4000-8000-000000000001')$q$, 'account_not_approved');
select pg_temp.expect_error($q$select public.cancel_booking('63000000-0000-4000-8000-000000000004')$q$, 'account_not_approved');
reset role;
select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000006', true);
set local role authenticated;
select set_config('uv21.suspended_attempt', (public.submit_identity_verification('s126', '61000000-0000-4000-8000-000000000006/card.webp')).id::text, true);
reset role;
update public.profiles set status = 'suspended', access_restriction_reason = 'safety' where id = '61000000-0000-4000-8000-000000000006';
set local role authenticated;
select pg_temp.assert_true(not private.has_browse_access() and not private.has_app_access(), 'suspension blocks browsing and sports');
select pg_temp.expect_error($q$select public.update_my_student_id('s127')$q$, 'account_suspended');
select pg_temp.expect_error($q$select public.submit_identity_verification('s127', '61000000-0000-4000-8000-000000000006/card.webp')$q$, 'account_suspended');
select pg_temp.expect_error($q$select * from public.list_open_matches()$q$, 'account_not_approved');
select pg_temp.expect_error($q$select public.cancel_booking('63000000-0000-4000-8000-000000000005')$q$, 'account_not_approved');
reset role;
select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000004', true);
set local role authenticated;
select public.review_identity_verification(current_setting('uv21.suspended_attempt')::uuid, 'approved', null);
reset role;
select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000006', true);
set local role authenticated;
select pg_temp.assert_true((select identity_status = 'verified' and access_status = 'suspended' and restriction_reason = 'safety' and not can_use_sports
  from public.get_my_session_context()), 'identity approval must not restore a suspended account');
select pg_temp.assert_true((public.cancel_booking('63000000-0000-4000-8000-000000000005')).status = 'cancelled', 'verified suspended user retains owner-only self-cancel cleanup');
reset role;

-- An already verified but unconfirmed credential also remains blocked.
select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000007', true);
set local role authenticated;
select pg_temp.assert_true(not private.has_browse_access() and not private.has_app_access(), 'verified profile alone cannot replace mailbox confirmation');
select pg_temp.expect_error($q$select public.create_booking('62000000-0000-4000-8000-000000000001', date_trunc('hour', now()) + interval '10h')$q$, 'account_not_approved');
reset role;

-- New RPCs remain inaccessible to anonymous callers and a claimless session.
select set_config('request.jwt.claim.sub', '', true);
set local role authenticated;
select pg_temp.expect_error($q$select public.update_my_student_id('S123')$q$, 'authentication_required');
select pg_temp.expect_error($q$select public.submit_identity_verification('S123', 'fake.webp')$q$, 'authentication_required');
reset role;
set local role anon;
select pg_temp.expect_error($q$select public.update_my_student_id('S123')$q$, 'permission denied');
reset role;

select 'UNEEM v2.1 universal verification contract passed (transaction will roll back).' as result;
rollback;
