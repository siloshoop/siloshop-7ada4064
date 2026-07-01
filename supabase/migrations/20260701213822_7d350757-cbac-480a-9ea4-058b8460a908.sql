
-- 1) ad_analytics: constrain event_type and slot to prevent arbitrary pollution
ALTER TABLE public.ad_analytics
  DROP CONSTRAINT IF EXISTS ad_analytics_event_type_check,
  DROP CONSTRAINT IF EXISTS ad_analytics_ad_slot_check,
  DROP CONSTRAINT IF EXISTS ad_analytics_page_url_check,
  DROP CONSTRAINT IF EXISTS ad_analytics_session_id_check;

ALTER TABLE public.ad_analytics
  ADD CONSTRAINT ad_analytics_event_type_check
    CHECK (event_type IN ('impression','click')),
  ADD CONSTRAINT ad_analytics_ad_slot_check
    CHECK (char_length(ad_slot) BETWEEN 1 AND 100 AND ad_slot ~ '^[A-Za-z0-9_\-]+$'),
  ADD CONSTRAINT ad_analytics_page_url_check
    CHECK (page_url IS NULL OR char_length(page_url) <= 500),
  ADD CONSTRAINT ad_analytics_session_id_check
    CHECK (session_id IS NULL OR char_length(session_id) <= 100);

-- 2) delivery_ratings: admin SELECT policy
DROP POLICY IF EXISTS "Admins can view all delivery ratings" ON public.delivery_ratings;
CREATE POLICY "Admins can view all delivery ratings"
  ON public.delivery_ratings
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 3) notifications: remove direct INSERT policy; force through SECURITY DEFINER functions
DROP POLICY IF EXISTS "Users can insert own notifications" ON public.notifications;

-- 4) order_status_history: vendor SELECT for their own orders
DROP POLICY IF EXISTS "Vendors can view status history for their orders" ON public.order_status_history;
CREATE POLICY "Vendors can view status history for their orders"
  ON public.order_status_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.order_items oi
      WHERE oi.order_id = order_status_history.order_id
        AND oi.vendor_id = auth.uid()
    )
  );

-- 5) orders: vendor SELECT scoped to orders containing their items
DROP POLICY IF EXISTS "Vendors can view orders containing their items" ON public.orders;
CREATE POLICY "Vendors can view orders containing their items"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.order_items oi
      WHERE oi.order_id = orders.id
        AND oi.vendor_id = auth.uid()
    )
  );
