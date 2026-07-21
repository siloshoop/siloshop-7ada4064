
CREATE OR REPLACE FUNCTION public.get_vendor_sales_stats()
RETURNS TABLE(
  total_orders bigint,
  completed_orders bigint,
  cancelled_orders bigint,
  returned_orders bigint,
  products_sold bigint,
  estimated_revenue numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH v AS (SELECT auth.uid() AS vid),
  vendor_orders AS (
    SELECT DISTINCT o.id, o.status
    FROM public.orders o
    JOIN public.order_items oi ON oi.order_id = o.id
    WHERE oi.vendor_id = (SELECT vid FROM v)
  ),
  delivered_items AS (
    SELECT oi.quantity, oi.price
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE oi.vendor_id = (SELECT vid FROM v)
      AND o.status = 'delivered'
  )
  SELECT
    (SELECT COUNT(*) FROM vendor_orders)::bigint AS total_orders,
    (SELECT COUNT(*) FROM vendor_orders WHERE status = 'delivered')::bigint AS completed_orders,
    (SELECT COUNT(*) FROM vendor_orders WHERE status = 'cancelled')::bigint AS cancelled_orders,
    (SELECT COUNT(DISTINCT order_id) FROM public.returns WHERE vendor_id = (SELECT vid FROM v))::bigint AS returned_orders,
    COALESCE((SELECT SUM(quantity) FROM delivered_items), 0)::bigint AS products_sold,
    COALESCE((SELECT SUM(price * quantity) FROM delivered_items), 0)::numeric AS estimated_revenue;
$$;

REVOKE ALL ON FUNCTION public.get_vendor_sales_stats() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_vendor_sales_stats() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_vendor_sales_stats() TO authenticated;
