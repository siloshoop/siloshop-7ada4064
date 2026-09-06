-- 1) saved_for_later must remember the chosen variant
ALTER TABLE public.saved_for_later
  ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS saved_for_later_user_product_variant_uidx
  ON public.saved_for_later (user_id, product_id, COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- 2) admin_get_order_detail: products.images is text[], not jsonb
CREATE OR REPLACE FUNCTION public.admin_get_order_detail(_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _result jsonb;
BEGIN
  IF NOT public.has_any_admin_role(auth.uid()) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT jsonb_build_object(
    'order', to_jsonb(o),
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', oi.id,
        'product_id', oi.product_id,
        'product_name', COALESCE(oi.product_name, pr.name),
        'product_image', COALESCE(pr.image_url, pr.images[1]),
        'quantity', oi.quantity,
        'price', oi.price,
        'vendor_id', oi.vendor_id
      ) ORDER BY oi.created_at)
      FROM public.order_items oi
      LEFT JOIN public.products pr ON pr.id = oi.product_id
      WHERE oi.order_id = o.id
    ), '[]'::jsonb),
    'history', COALESCE((
      SELECT jsonb_agg(to_jsonb(h) ORDER BY h.created_at)
      FROM public.order_status_history h
      WHERE h.order_id = o.id
    ), '[]'::jsonb),
    'payments', COALESCE((
      SELECT jsonb_agg(to_jsonb(p) ORDER BY p.created_at)
      FROM public.payments p
      WHERE p.order_id = o.id
    ), '[]'::jsonb),
    'notes', COALESCE((
      SELECT jsonb_agg(to_jsonb(n) ORDER BY n.created_at)
      FROM public.order_notes n
      WHERE n.order_id = o.id
    ), '[]'::jsonb)
  )
  INTO _result
  FROM public.orders o
  WHERE o.id = _order_id;

  RETURN _result;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_get_order_detail(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_order_detail(uuid) TO authenticated;