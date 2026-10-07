DROP FUNCTION IF EXISTS public.get_vendor_orders();
CREATE FUNCTION public.get_vendor_orders()
 RETURNS TABLE(id uuid, created_at timestamp with time zone, status text, total_amount numeric, customer_name text, city text, currency text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT DISTINCT o.id, o.created_at, o.status, o.total_amount, p.full_name,
    NULLIF(split_part(COALESCE(o.shipping_address, ''), ',', 1), ''),
    COALESCE(o.currency, 'SYP')::text
  FROM public.orders o
  JOIN public.order_items oi ON oi.order_id = o.id
  LEFT JOIN public.profiles p ON p.id = o.customer_id
  WHERE oi.vendor_id = auth.uid()
  ORDER BY o.created_at DESC;
$function$;
REVOKE ALL ON FUNCTION public.get_vendor_orders() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_vendor_orders() TO authenticated;