CREATE OR REPLACE FUNCTION public.notification_push_eligible(_type text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT coalesce(_type, '') IN (
    'new_order', 'order', 'order_status', 'order_cancelled', 'order_refunded', 'return_status',
    'staff_store_request', 'seller_approved', 'seller_rejected', 'seller_suspended', 'seller_reactivated',
    'product_approve', 'product_reject', 'product_suspend',
    'admin', 'warning', 'announcement',
    'account_suspended', 'account_activated', 'account_banned'
  )
$$;