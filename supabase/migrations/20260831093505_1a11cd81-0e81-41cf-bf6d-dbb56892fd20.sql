DROP FUNCTION IF EXISTS public.create_order(jsonb, text, text, text, text);

REVOKE ALL ON FUNCTION public.is_order_vendor(uuid, uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.seller_order_items(uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.admin_order_sub_orders(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_order_vendor(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seller_order_items(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_order_sub_orders(uuid) TO authenticated;