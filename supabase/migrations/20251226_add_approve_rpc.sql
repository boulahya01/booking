-- =====================================================
-- Add SECURITY DEFINER RPC to approve/reject profiles
-- This function requires the caller to be an admin (checked by is_admin())
-- and performs the status update with SECURITY DEFINER to avoid RLS recursion issues.
-- =====================================================

CREATE OR REPLACE FUNCTION public.approve_profile(target_id uuid, new_status text)
RETURNS TABLE(id uuid, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ensure helper exists and check admin privileges
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'permission denied: caller is not admin';
  END IF;

  -- Perform update with fully-qualified column references to avoid
  -- ambiguity between OUT variables and table columns.
  RETURN QUERY
  UPDATE public.profiles
  SET status = new_status,
      updated_at = NOW()
  WHERE public.profiles.id = target_id
  RETURNING public.profiles.id AS id, public.profiles.status AS status;
END;
$$;

-- Grant execute to authenticated role so Supabase JWT users can call it
GRANT EXECUTE ON FUNCTION public.approve_profile(uuid, text) TO authenticated;

-- Note: This function intentionally verifies admin status before performing updates.
-- Use this RPC from the frontend via `supabase.rpc('approve_profile', { target_id, new_status })`.
CREATE OR REPLACE FUNCTION public.approve_profile(target_id uuid , new_status text)
RETURNS TABLE(id  uuid, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$

BEGIN
--Ensure helper exists and check main privileges 
IF NOT is_admin() THEN 
  RAISE EXCEPTION 'permission denied: caller is not admin ';
END IF;
-- perform update with full-qualified colum references to avoid 
-- ambiguity between OUT variables and table colums
RETURN QUERY

UPDATE public.profiles
  SET status = new_status,
  updated_at = NOW()
WHERE public.profiles.id = target_id
RETURNING public.profiles.id AS id, public.profiles.status AS status;

END;
$$;

