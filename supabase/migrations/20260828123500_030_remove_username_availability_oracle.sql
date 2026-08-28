-- Restore the V2 registration non-enumeration boundary.
-- Username uniqueness remains authoritative through profiles_username_unique_idx
-- and private.handle_new_user(); registration must not expose a public lookup
-- endpoint that answers whether a case-insensitive handle already exists.

begin;

revoke all on function public.registration_username_available(text)
  from public, anon, authenticated;

drop function public.registration_username_available(text);

commit;
