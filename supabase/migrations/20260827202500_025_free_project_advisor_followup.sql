-- UNEEM V2 free-project advisor follow-up.
-- Apply after 024_advisor_hardening.sql.
--
-- The current Supabase advisor additionally flags anonymous GraphQL discovery
-- for support storage/read surfaces and several uncovered foreign keys. Guest
-- Help remains capability-RPC based; anonymous clients never need direct table
-- or booking timeline reads.

begin;

revoke select on public.support_threads from anon;
revoke select on public.support_messages from anon;
revoke select on public.booking_timeline from anon;

create index if not exists admin_bootstrap_log_target_profile_idx
  on private.admin_bootstrap_log(target_profile_id);
create index if not exists admin_audit_log_actor_idx
  on public.admin_audit_log(actor_id);
create index if not exists announcement_dismissals_announcement_idx
  on public.announcement_dismissals(announcement_id);
create index if not exists announcements_created_by_idx
  on public.announcements(created_by);
create index if not exists bookings_cancelled_by_idx
  on public.bookings(cancelled_by)
  where cancelled_by is not null;
create index if not exists identity_attempts_reviewed_by_idx
  on public.identity_verification_attempts(reviewed_by)
  where reviewed_by is not null;
create index if not exists matches_organizer_idx
  on public.matches(organizer_id);
create index if not exists support_messages_sender_user_idx
  on public.support_messages(sender_user_id)
  where sender_user_id is not null;

commit;
