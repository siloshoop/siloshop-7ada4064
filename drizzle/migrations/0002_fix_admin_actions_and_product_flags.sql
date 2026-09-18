CREATE OR REPLACE FUNCTION public.admin_set_product_flags(
  _product_id uuid,
  _is_featured boolean DEFAULT NULL,
  _is_trending boolean DEFAULT NULL,
  _is_recommended boolean DEFAULT NULL,
  _is_active boolean DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old jsonb;
  v_new jsonb;
BEGIN
  IF NOT public.has_any_admin_role(auth.uid()) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT jsonb_build_object(
    'is_featured', p.is_featured,
    'is_trending', p.is_trending,
    'is_recommended', p.is_recommended,
    'is_active', p.is_active
  ) INTO v_old
  FROM public.products p
  WHERE p.id = _product_id;

  IF v_old IS NULL THEN
    RAISE EXCEPTION 'product_not_found';
  END IF;

  UPDATE public.products SET
    is_featured = COALESCE(_is_featured, is_featured),
    is_trending = COALESCE(_is_trending, is_trending),
    is_recommended = COALESCE(_is_recommended, is_recommended),
    is_active = COALESCE(_is_active, is_active),
    updated_at = now()
  WHERE id = _product_id;

  SELECT jsonb_build_object(
    'is_featured', p.is_featured,
    'is_trending', p.is_trending,
    'is_recommended', p.is_recommended,
    'is_active', p.is_active
  ) INTO v_new
  FROM public.products p
  WHERE p.id = _product_id;

  INSERT INTO public.admin_audit_log
    (actor_id, actor_role, action, target_type, target_id, old_value, new_value)
  VALUES
    (auth.uid(), public.actor_admin_role(auth.uid()), 'product_flags_changed', 'product', _product_id, v_old, v_new);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_product_flags(uuid, boolean, boolean, boolean, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_product_flags(uuid, boolean, boolean, boolean, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_set_product_flags(uuid, boolean, boolean, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_product_flags(uuid, boolean, boolean, boolean, boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_suspend_user(_user_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF _user_id = auth.uid() THEN RAISE EXCEPTION 'cannot_target_self'; END IF;
  IF nullif(btrim(_reason), '') IS NULL THEN RAISE EXCEPTION 'reason_required'; END IF;

  UPDATE public.profiles
  SET account_status = 'suspended', is_banned = false, banned_at = NULL, ban_reason = NULL,
      status_reason = btrim(_reason), status_changed_at = now(),
      status_changed_by = auth.uid(), updated_at = now()
  WHERE id = _user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'user_not_found'; END IF;

  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (_user_id, 'تم إيقاف حسابك', 'تم إيقاف حسابك: ' || btrim(_reason), 'account_suspended');
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_activate_user(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF _user_id = auth.uid() THEN RAISE EXCEPTION 'cannot_target_self'; END IF;

  UPDATE public.profiles
  SET account_status = 'active', is_banned = false, banned_at = NULL, ban_reason = NULL,
      status_reason = NULL, status_changed_at = now(),
      status_changed_by = auth.uid(), updated_at = now()
  WHERE id = _user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'user_not_found'; END IF;

  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (_user_id, 'تم إعادة تفعيل حسابك', 'تم إعادة تفعيل حسابك، يمكنك متابعة استخدام المنصة.', 'account_activated');
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_ban_user(_user_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF _user_id = auth.uid() THEN RAISE EXCEPTION 'cannot_target_self'; END IF;
  IF nullif(btrim(_reason), '') IS NULL THEN RAISE EXCEPTION 'reason_required'; END IF;

  UPDATE public.profiles
  SET account_status = 'banned', is_banned = true, banned_at = now(), ban_reason = btrim(_reason),
      status_reason = btrim(_reason), status_changed_at = now(),
      status_changed_by = auth.uid(), updated_at = now()
  WHERE id = _user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'user_not_found'; END IF;

  DELETE FROM public.user_roles
  WHERE user_id = _user_id AND role IN ('vendor'::public.app_role, 'admin'::public.app_role);

  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (_user_id, 'تم حظر حسابك', 'تم حظر حسابك بشكل دائم: ' || btrim(_reason), 'account_banned');
END;
$$;

REVOKE ALL ON FUNCTION public.admin_suspend_user(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_suspend_user(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_suspend_user(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_suspend_user(uuid, text) TO service_role;
REVOKE ALL ON FUNCTION public.admin_activate_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_activate_user(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_activate_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_activate_user(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.admin_ban_user(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_ban_user(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_ban_user(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_ban_user(uuid, text) TO service_role;