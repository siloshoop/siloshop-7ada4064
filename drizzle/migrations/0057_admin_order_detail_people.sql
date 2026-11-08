-- Owner-only order details: add the seller's name, store name and account email to
-- each item, and the shopper's name/email/account status. Access check unchanged.
CREATE OR REPLACE FUNCTION public.admin_get_order_detail(_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT jsonb_build_object(
    'order', to_jsonb(o),
    'customer', (
      SELECT jsonb_build_object(
        'full_name', cp.full_name,
        'email', (SELECT u.email::text FROM auth.users u WHERE u.id = o.customer_id),
        'account_status', cp.account_status
      )
      FROM public.profiles cp
      WHERE cp.id = o.customer_id
    ),
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', oi.id,
        'product_id', oi.product_id,
        'product_name', COALESCE(oi.product_name, pr.name),
        'product_image', COALESCE(pr.image_url, pr.images[1]),
        'quantity', oi.quantity,
        'price', oi.price,
        'vendor_id', oi.vendor_id,
        'vendor_name', vp.full_name,
        'vendor_store_name', (
          SELECT sa.store_name FROM public.seller_applications sa
           WHERE sa.user_id = oi.vendor_id AND sa.status = 'approved'
           ORDER BY sa.updated_at DESC NULLS LAST LIMIT 1
        ),
        'vendor_email', (SELECT u.email::text FROM auth.users u WHERE u.id = oi.vendor_id)
      ) ORDER BY oi.created_at)
      FROM public.order_items oi
      LEFT JOIN public.products pr ON pr.id = oi.product_id
      LEFT JOIN public.profiles vp ON vp.id = oi.vendor_id
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
