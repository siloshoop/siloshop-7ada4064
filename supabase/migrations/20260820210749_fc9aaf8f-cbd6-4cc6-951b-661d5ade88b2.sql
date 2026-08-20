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
  FROM public.products p WHERE p.id = _product_id;

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
  FROM public.products p WHERE p.id = _product_id;

  INSERT INTO public.admin_audit_log (actor_id, actor_role, action, target_type, target_id, old_value, new_value)
  VALUES (auth.uid(), public.actor_admin_role(), 'product_flags_changed', 'product', _product_id, v_old, v_new);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_product_flags(uuid, boolean, boolean, boolean, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_product_flags(uuid, boolean, boolean, boolean, boolean) TO authenticated;