
-- 1) Remove orders from realtime publication to prevent vendor PII leakage via UPDATE-triggered broadcasts
ALTER PUBLICATION supabase_realtime DROP TABLE public.orders;

-- 2) Revoke EXECUTE on trigger-only SECURITY DEFINER functions from anon/authenticated.
-- These are fired by triggers and should never be callable via the API.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_brand_followers() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_favorites_deal_ended() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_favorites_new_deal() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_order_status_change() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_price_change() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_price_drop() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_review_owner() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_vendor_low_stock() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_vendor_new_order() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_vendor_new_rating() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.send_push_to_brand_followers() FROM anon, authenticated;
