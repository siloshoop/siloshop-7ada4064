REVOKE EXECUTE ON FUNCTION public.admin_list_orders(text, text, text, timestamptz, timestamptz, integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_product_flags FROM anon;
REVOKE EXECUTE ON FUNCTION public.seller_bulk_update_products FROM anon;
REVOKE EXECUTE ON FUNCTION public.seller_dashboard_overview FROM anon;
REVOKE EXECUTE ON FUNCTION public.seller_request_payout FROM anon;
REVOKE EXECUTE ON FUNCTION public.seller_update_store_profile FROM anon;
REVOKE EXECUTE ON FUNCTION public.seller_wallet_summary FROM anon;
REVOKE EXECUTE ON FUNCTION public.product_analytics FROM anon;