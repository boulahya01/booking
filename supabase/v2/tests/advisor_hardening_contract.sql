-- UNEEM V2 advisor-hardening contract tests.
-- Run after 024_advisor_hardening.sql. Catalog-only checks; transaction rolls back.

\set ON_ERROR_STOP on

begin;

do $$
declare
  v_signature text;
  v_signatures text[] := array[
    'public.add_my_support_message(uuid,text)',
    'public.admin_archive_pitch(uuid,text)',
    'public.admin_cancel_booking(uuid,text)',
    'public.admin_get_support_messages(uuid)',
    'public.admin_get_support_thread_context(uuid)',
    'public.admin_list_bookings(text,uuid,text,timestamp with time zone,timestamp with time zone,integer,integer)',
    'public.admin_list_support_threads(text,integer)',
    'public.admin_reply_support_thread(uuid,text,text)',
    'public.admin_save_pitch(uuid,text,text,text,integer,time without time zone,time without time zone,integer,integer,boolean,integer,integer,boolean,integer,text)',
    'public.admin_set_support_status(uuid,text)',
    'public.create_my_report_thread(text,uuid,text,text)',
    'public.create_my_support_thread(text,text,text)'
  ];
begin
  foreach v_signature in array v_signatures loop
    if has_function_privilege('anon', v_signature, 'EXECUTE') then
      raise exception 'FAIL: anon can execute %', v_signature;
    end if;

    if not has_function_privilege('authenticated', v_signature, 'EXECUTE') then
      raise exception 'FAIL: authenticated grant was lost for %', v_signature;
    end if;
  end loop;
end;
$$;

do $$
begin
  if not has_function_privilege(
    'anon',
    'public.add_guest_support_message(text,text)',
    'EXECUTE'
  ) then
    raise exception 'FAIL: guest token reply RPC is no longer available to anon';
  end if;

  if not has_function_privilege(
    'anon',
    'public.get_guest_support_thread(text)',
    'EXECUTE'
  ) then
    raise exception 'FAIL: guest token read RPC is no longer available to anon';
  end if;

  if has_function_privilege(
    'anon',
    'public.create_guest_support_thread(text,text,text)',
    'EXECUTE'
  ) then
    raise exception 'FAIL: legacy guest thread creation became anonymously callable again';
  end if;

  if has_function_privilege(
    'anon',
    'public.create_guest_support_thread_server(text,text,text,text)',
    'EXECUTE'
  ) then
    raise exception 'FAIL: trusted guest thread creation RPC is anonymously callable';
  end if;
end;
$$;

do $$
declare
  v_threads_qual text;
  v_messages_qual text;
begin
  select qual
    into v_threads_qual
  from pg_policies
  where schemaname = 'public'
    and tablename = 'support_threads'
    and policyname = 'support threads read own';

  if v_threads_qual is null
     or position('select auth.uid()' in lower(v_threads_qual)) = 0 then
    raise exception 'FAIL: support_threads RLS does not cache auth.uid() via SELECT';
  end if;

  select qual
    into v_messages_qual
  from pg_policies
  where schemaname = 'public'
    and tablename = 'support_messages'
    and policyname = 'support messages read own thread';

  if v_messages_qual is null
     or position('select auth.uid()' in lower(v_messages_qual)) = 0 then
    raise exception 'FAIL: support_messages RLS does not cache auth.uid() via SELECT';
  end if;
end;
$$;

do $$
begin
  if to_regclass('public.support_threads_user_recent_idx') is not null then
    raise exception 'FAIL: duplicate support_threads_user_recent_idx still exists';
  end if;

  if to_regclass('public.support_threads_user_created_idx') is null then
    raise exception 'FAIL: canonical support_threads_user_created_idx is missing';
  end if;
end;
$$;

rollback;
\echo 'UNEEM V2 advisor hardening contract tests passed.'
