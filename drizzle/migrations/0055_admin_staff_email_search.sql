-- Super Admin only: find staff accounts (moderator/admin/super_admin) on the Roles & Permissions page
-- by part of their sign-in email. Returns account ids only, never the emails themselves.
CREATE OR REPLACE FUNCTION public.admin_search_staff_by_email(p_query text)
RETURNS SETOF uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_q text := lower(btrim(COALESCE(p_query, '')));
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  IF length(v_q) < 3 OR length(v_q) > 254 THEN
    RETURN;
  END IF;
  v_q := replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_');
  RETURN QUERY
    SELECT DISTINCT r.user_id
    FROM public.user_roles r
    JOIN auth.users u ON u.id = r.user_id
    WHERE r.role IN ('moderator', 'admin', 'super_admin')
      AND lower(u.email) LIKE '%' || v_q || '%' ESCAPE '\'
    LIMIT 100;
END $$;

REVOKE ALL ON FUNCTION public.admin_search_staff_by_email(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_search_staff_by_email(text) TO authenticated, service_role;