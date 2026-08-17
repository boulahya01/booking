-- UNEEM V2 capability restriction contract.
-- Transactional suite: run after layer 020 on a disposable/fresh V2 database.
begin;

-- Expected coverage for the hosted gate:
-- 1. non-admin cannot create/lift/list another user's restrictions
-- 2. admin cannot restrict self
-- 3. one active restriction per user/capability
-- 4. expired restrictions no longer block capability checks
-- 5. sports restriction rejects private.require_sports_access
-- 6. match-only restriction rejects private.require_match_access but preserves sports access
-- 7. lift requires a structured remediation/admin reason and restores capability
-- 8. restrict/lift append admin_audit_log rows with capability + reason context
-- 9. caller get_my_capability_state exposes only their own safe reason/expiry state
-- 10. identity verification state remains unchanged by behavioral moderation

-- Static invariants fail loudly even before fixture-specific role switching.
do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname='public'
      and indexname='user_capability_restrictions_one_active'
  ) then raise exception 'missing active restriction uniqueness invariant'; end if;

  if has_table_privilege('authenticated', 'public.user_capability_restrictions', 'INSERT')
     or has_table_privilege('authenticated', 'public.user_capability_restrictions', 'UPDATE')
     or has_table_privilege('authenticated', 'public.user_capability_restrictions', 'DELETE') then
    raise exception 'authenticated role has direct restriction write privilege';
  end if;

  if has_function_privilege('anon', 'public.admin_restrict_user_capability(uuid,text,text,timestamptz)', 'EXECUTE')
     or has_function_privilege('anon', 'public.admin_lift_user_restriction(uuid,text)', 'EXECUTE') then
    raise exception 'anonymous role can execute moderation RPC';
  end if;
end $$;

rollback;
