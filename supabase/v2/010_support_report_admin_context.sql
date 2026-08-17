-- UNEEM V2 narrow admin context for support/report threads.
-- Apply after 009_support_reports_abuse_controls.sql.

create or replace function public.admin_get_support_thread_context(p_thread_id uuid)
returns table(
  id uuid,
  user_id uuid,
  contact_email text,
  kind text,
  status text,
  subject text,
  target_type text,
  target_id uuid,
  reason_code text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, private, auth
as $$
begin
  if not private.is_admin() then
    raise exception 'admin_required';
  end if;

  return query
  select
    t.id,
    t.user_id,
    t.contact_email,
    t.kind,
    t.status,
    t.subject,
    t.target_type,
    t.target_id,
    t.reason_code,
    t.created_at,
    t.updated_at
  from public.support_threads t
  where t.id = p_thread_id;
end;
$$;

revoke all on function public.admin_get_support_thread_context(uuid) from public;
grant execute on function public.admin_get_support_thread_context(uuid) to authenticated;
