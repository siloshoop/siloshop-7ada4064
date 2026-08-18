CREATE OR REPLACE FUNCTION public.bootstrap_first_super_admin(_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid;
BEGIN
  -- service_role only: never reachable from the browser / anon / authenticated
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- one-shot: refuses as soon as any super_admin exists
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'super_admin') THEN
    RAISE EXCEPTION 'super_admin_already_exists';
  END IF;

  SELECT id INTO _uid FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1;
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_uid, 'super_admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.admin_audit_log (actor_id, actor_role, action, target_type, target_id, new_value, reason)
  VALUES (_uid, 'super_admin', 'bootstrap_super_admin', 'user_roles', _uid,
          jsonb_build_object('role', 'super_admin'),
          'One-time first super admin bootstrap');

  RETURN jsonb_build_object('user_id', _uid, 'role', 'super_admin');
END;
$$;

REVOKE ALL ON FUNCTION public.bootstrap_first_super_admin(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_first_super_admin(text) TO service_role;