-- Owner order list: show every seller's name, approved store name and email on each
-- order row (same lookups as admin_get_order_detail), and let the owner search by them.
-- The return type gains a column, so the function is dropped and recreated with the
-- same owner-only check and the same execute grants.
DROP FUNCTION IF EXISTS public.admin_list_orders(text, text, text, timestamp with time zone, timestamp with time zone, integer, integer);

CREATE FUNCTION public.admin_list_orders(_search text DEFAULT NULL::text, _status text DEFAULT NULL::text, _payment_status text DEFAULT NULL::text, _from timestamp with time zone DEFAULT NULL::timestamp with time zone, _to timestamp with time zone DEFAULT NULL::timestamp with time zone, _limit integer DEFAULT 50, _offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, created_at timestamp with time zone, updated_at timestamp with time zone, status text, payment_status text, total_amount numeric, discount_amount numeric, coupon_code text, phone text, shipping_address text, tracking_number text, courier_name text, delivered_at timestamp with time zone, cancelled_at timestamp with time zone, cancellation_reason text, customer_id uuid, customer_name text, customer_email text, items_count bigint, vendors_count bigint, order_number text, invoice_number text, payment_method text, estimated_delivery timestamp with time zone, is_frozen boolean, total_count bigint, sellers jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT o.*
      FROM public.orders o
     WHERE public.has_role(auth.uid(), 'super_admin'::public.app_role)
       AND o.parent_order_id IS NULL
       AND (_status IS NULL OR public.normalize_order_status(o.status) = public.normalize_order_status(_status))
       AND (_payment_status IS NULL OR o.payment_status = _payment_status)
       AND (_from IS NULL OR o.created_at >= _from)
       AND (_to IS NULL OR o.created_at <= _to)
       AND (
         _search IS NULL OR length(trim(_search)) = 0
         OR COALESCE(o.order_number,'') ILIKE '%' || _search || '%'
         OR COALESCE(o.invoice_number,'') ILIKE '%' || _search || '%'
         OR o.id::text ILIKE '%' || _search || '%'
         OR COALESCE(o.phone,'') ILIKE '%' || _search || '%'
         OR COALESCE(o.tracking_number,'') ILIKE '%' || _search || '%'
         OR COALESCE(o.coupon_code,'') ILIKE '%' || _search || '%'
         OR EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = o.customer_id
                      AND COALESCE(pr.full_name,'') ILIKE '%' || _search || '%')
         OR EXISTS (SELECT 1 FROM auth.users u WHERE u.id = o.customer_id
                      AND COALESCE(u.email,'') ILIKE '%' || _search || '%')
         OR EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = o.id
                      AND COALESCE(oi.product_name,'') ILIKE '%' || _search || '%')
         OR EXISTS (SELECT 1 FROM public.order_items oi
                      LEFT JOIN public.profiles vp ON vp.id = oi.vendor_id
                      LEFT JOIN auth.users vu ON vu.id = oi.vendor_id
                     WHERE oi.order_id = o.id
                       AND (COALESCE(vp.full_name,'') ILIKE '%' || _search || '%'
                         OR COALESCE(vu.email,'') ILIKE '%' || _search || '%'
                         OR EXISTS (SELECT 1 FROM public.seller_applications sa
                                     WHERE sa.user_id = oi.vendor_id AND sa.status = 'approved'
                                       AND COALESCE(sa.store_name,'') ILIKE '%' || _search || '%')))
       )
  ), counted AS (SELECT count(*) AS c FROM base)
  SELECT b.id, b.created_at, b.updated_at, public.normalize_order_status(b.status), b.payment_status,
         b.total_amount, b.discount_amount, b.coupon_code, b.phone, b.shipping_address,
         b.tracking_number, b.courier_name, b.delivered_at, b.cancelled_at, b.cancellation_reason,
         b.customer_id, pr.full_name,
         (SELECT u.email::text FROM auth.users u WHERE u.id = b.customer_id),
         (SELECT count(*) FROM public.order_items oi WHERE oi.order_id = b.id),
         (SELECT count(DISTINCT oi.vendor_id) FROM public.order_items oi WHERE oi.order_id = b.id),
         b.order_number, b.invoice_number, b.payment_method, b.estimated_delivery,
         COALESCE(b.is_frozen,false), (SELECT c FROM counted),
         COALESCE((
           SELECT jsonb_agg(jsonb_build_object(
                    'id', v.vendor_id,
                    'name', vp.full_name,
                    'store_name', (
                      SELECT sa.store_name FROM public.seller_applications sa
                       WHERE sa.user_id = v.vendor_id AND sa.status = 'approved'
                       ORDER BY sa.updated_at DESC NULLS LAST LIMIT 1
                    ),
                    'email', (SELECT u.email::text FROM auth.users u WHERE u.id = v.vendor_id)
                  ) ORDER BY v.first_at)
             FROM (SELECT oi.vendor_id, min(oi.created_at) AS first_at
                     FROM public.order_items oi
                    WHERE oi.order_id = b.id AND oi.vendor_id IS NOT NULL
                    GROUP BY oi.vendor_id) v
             LEFT JOIN public.profiles vp ON vp.id = v.vendor_id
         ), '[]'::jsonb)
    FROM base b
    LEFT JOIN public.profiles pr ON pr.id = b.customer_id
   ORDER BY b.created_at DESC
   LIMIT GREATEST(LEAST(COALESCE(_limit,50), 200), 1)
  OFFSET GREATEST(COALESCE(_offset,0), 0);
$function$;

REVOKE ALL ON FUNCTION public.admin_list_orders(text, text, text, timestamp with time zone, timestamp with time zone, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_orders(text, text, text, timestamp with time zone, timestamp with time zone, integer, integer) TO authenticated, service_role;
