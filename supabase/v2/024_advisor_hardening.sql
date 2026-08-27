-- UNEEM V2 advisor hardening.
-- Apply after 023_guest_support_ip_gate.sql.
--
-- This layer resolves the actionable Supabase Advisor findings without changing
-- the intentional RPC-only architecture:
-- - cache auth.uid() once per statement in the two support read RLS policies
-- - remove the duplicate support-thread user/created_at index
-- - explicitly revoke anonymous execution from authenticated/admin-only
--   SECURITY DEFINER RPCs
-- - keep the two capability-token guest read/reply RPCs anonymously callable
-- - make future public-schema function execution fail closed by default

begin;

-- Supabase recommends wrapping auth.uid() in SELECT so PostgreSQL can use an
-- initPlan instead of re-evaluating it for every candidate row.
drop policy if exists "support threads read own" on public.support_threads;
create policy "support threads read own"
  on public.support_threads for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "support messages read own thread" on public.support_messages;
create policy "support messages read own thread"
  on public.support_messages for select
  to authenticated
  using (
    exists (
      select 1
      from public.support_threads t
      where t.id = support_messages.thread_id
        and t.user_id = (select auth.uid())
    )
  );

-- 007_support_threads.sql and 009_support_reports_abuse_controls.sql created the
-- same partial index under two names. Keep the older canonical index.
drop index if exists public.support_threads_user_recent_idx;

-- PostgreSQL grants EXECUTE on new functions to PUBLIC by default. Several
-- authenticated/admin-only RPCs already enforce their own authorization but
-- inherited anonymous EXECUTE through PUBLIC. Close that unnecessary API
-- surface explicitly while preserving the authenticated grants.
revoke execute on function public.add_my_support_message(uuid, text)
  from public, anon;
revoke execute on function public.admin_archive_pitch(uuid, text)
  from public, anon;
revoke execute on function public.admin_cancel_booking(uuid, text)
  from public, anon;
revoke execute on function public.admin_get_support_messages(uuid)
  from public, anon;
revoke execute on function public.admin_get_support_thread_context(uuid)
  from public, anon;
revoke execute on function public.admin_list_bookings(text, uuid, text, timestamptz, timestamptz, integer, integer)
  from public, anon;
revoke execute on function public.admin_list_support_threads(text, integer)
  from public, anon;
revoke execute on function public.admin_reply_support_thread(uuid, text, text)
  from public, anon;
revoke execute on function public.admin_save_pitch(uuid, text, text, text, integer, time, time, integer, integer, boolean, integer, integer, boolean, integer, text)
  from public, anon;
revoke execute on function public.admin_set_support_status(uuid, text)
  from public, anon;
revoke execute on function public.create_my_report_thread(text, uuid, text, text)
  from public, anon;
revoke execute on function public.create_my_support_thread(text, text, text)
  from public, anon;

-- These two guest operations are intentionally capability-based. Possession of
-- the high-entropy token grants access only to the matching support thread.
grant execute on function public.add_guest_support_message(text, text)
  to anon, authenticated;
grant execute on function public.get_guest_support_thread(text)
  to anon, authenticated;

-- Future migrations must opt functions into API execution explicitly instead of
-- inheriting PostgreSQL's default PUBLIC EXECUTE privilege.
alter default privileges in schema public
  revoke execute on functions from public, anon, authenticated, service_role;

commit;
