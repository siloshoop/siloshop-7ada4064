-- Owner-only account type change (customer <-> vendor).
-- The previous client-side profiles UPDATE was silently filtered by RLS (users may
-- only update their own row, and never their own role), so nothing was saved.
-- This keeps profiles.role (used for seller access) and the vendor/customer rows in
-- user_roles in step, and records the change in the admin audit log.
CREATE OR REPLACE FUNCTION public.admin_set_account_type(_user_id uuid, _type public.user_role, _reason text DEFAULT NULL)
 RETURNS public.user_role
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _old public.user_role;
  _new public.user_role;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  IF _user_id IS NULL OR _type IS NULL THEN
    RAISE EXCEPTION 'invalid_input';
  END IF;
  IF _user_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot_target_self';
  END IF;

  SELECT p.role INTO _old FROM public.profiles p WHERE p.id = _user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  UPDATE public.profiles SET role = _type WHERE id = _user_id
  RETURNING role INTO _new;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'customer'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  IF _type = 'vendor'::public.user_role THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'vendor'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    DELETE FROM public.user_roles
     WHERE user_id = _user_id AND role = 'vendor'::public.app_role;
  END IF;

  PERFORM public.log_admin_action(
    'account_type_changed', 'profiles', _user_id,
    jsonb_build_object('role', _old::text),
    jsonb_build_object('role', _new::text), _reason);

  RETURN _new;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_set_account_type(uuid, public.user_role, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_account_type(uuid, public.user_role, text) TO authenticated, service_role;
