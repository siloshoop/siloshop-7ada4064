
-- 1) Revert vendor SELECT on orders — exposed customer GPS columns.
-- Vendors should use the get_vendor_orders() RPC which returns minimal columns.
DROP POLICY IF EXISTS "Vendors can view orders with their items" ON public.orders;

-- 2) Remove duplicate coupons UPDATE policy. Keep a single one that excludes used_count via column GRANT.
DROP POLICY IF EXISTS "Vendors can update their own coupons" ON public.coupons;
-- (The "Vendors can update their coupons" policy + REVOKE UPDATE(used_count) from authenticated remains in place.)

-- 3) Restrict deletion of anonymous push subscriptions to the anon role only.
DROP POLICY IF EXISTS "Anonymous subscriptions can be deleted" ON public.push_subscriptions;
CREATE POLICY "Anon role can delete anonymous push subscription"
ON public.push_subscriptions
FOR DELETE
TO anon
USING (user_id IS NULL);

-- 4) Strip GPS coordinates from the customer-facing read path on order_status_history.
-- Customers retain SELECT on the table but NOT on the GPS columns.
REVOKE SELECT (location_lat, location_lng) ON public.order_status_history FROM authenticated;
-- service_role and admins (via has_role check in their own policy/RPC paths) retain access.
