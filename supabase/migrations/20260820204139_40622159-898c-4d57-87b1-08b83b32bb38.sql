
-- 1) Store profile extra fields
ALTER TABLE public.seller_applications
  ADD COLUMN IF NOT EXISTS working_hours text,
  ADD COLUMN IF NOT EXISTS return_policy text,
  ADD COLUMN IF NOT EXISTS shipping_policy text,
  ADD COLUMN IF NOT EXISTS business_info text;

-- 2) Payout requests
CREATE TABLE IF NOT EXISTS public.payout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  method text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'pending',
  review_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payout_requests_status_chk CHECK (status IN ('pending','approved','rejected','completed'))
);

GRANT SELECT ON public.payout_requests TO authenticated;
GRANT ALL ON public.payout_requests TO service_role;

ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payouts_vendor_select_own" ON public.payout_requests;
CREATE POLICY "payouts_vendor_select_own" ON public.payout_requests
  FOR SELECT TO authenticated USING (vendor_id = auth.uid());

DROP POLICY IF EXISTS "payouts_admin_select" ON public.payout_requests;
CREATE POLICY "payouts_admin_select" ON public.payout_requests
  FOR SELECT TO authenticated USING (public.has_any_admin_role(auth.uid()));

DROP POLICY IF EXISTS "payouts_admin_update" ON public.payout_requests;
CREATE POLICY "payouts_admin_update" ON public.payout_requests
  FOR UPDATE TO authenticated USING (public.has_any_admin_role(auth.uid()))
  WITH CHECK (public.has_any_admin_role(auth.uid()));

GRANT UPDATE ON public.payout_requests TO authenticated;

CREATE INDEX IF NOT EXISTS idx_payout_requests_vendor ON public.payout_requests(vendor_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_payout_requests_touch ON public.payout_requests;
CREATE TRIGGER trg_payout_requests_touch BEFORE UPDATE ON public.payout_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3) Wallet summary
CREATE OR REPLACE FUNCTION public.seller_wallet_summary()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_settled numeric := 0;
  v_pending numeric := 0;
  v_refunded numeric := 0;
  v_paid numeric := 0;
  v_locked numeric := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;

  SELECT
    COALESCE(SUM(oi.price * oi.quantity) FILTER (WHERE public.normalize_order_status(o.status) IN ('delivered','completed')), 0),
    COALESCE(SUM(oi.price * oi.quantity) FILTER (WHERE public.normalize_order_status(o.status) IN ('pending','confirmed','preparing','ready_for_shipping','shipped','out_for_delivery')), 0),
    COALESCE(SUM(oi.price * oi.quantity) FILTER (WHERE public.normalize_order_status(o.status) IN ('cancelled','returned')), 0)
  INTO v_settled, v_pending, v_refunded
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  WHERE oi.vendor_id = v_uid;

  SELECT
    COALESCE(SUM(amount) FILTER (WHERE status = 'completed'), 0),
    COALESCE(SUM(amount) FILTER (WHERE status IN ('pending','approved')), 0)
  INTO v_paid, v_locked
  FROM public.payout_requests WHERE vendor_id = v_uid;

  RETURN jsonb_build_object(
    'settled_revenue', v_settled,
    'pending_revenue', v_pending,
    'refunded_revenue', v_refunded,
    'paid_out', v_paid,
    'locked_in_requests', v_locked,
    'withdrawable', GREATEST(v_settled - v_paid - v_locked, 0)
  );
END; $$;

REVOKE ALL ON FUNCTION public.seller_wallet_summary() FROM public;
GRANT EXECUTE ON FUNCTION public.seller_wallet_summary() TO authenticated;

-- 4) Payout request
CREATE OR REPLACE FUNCTION public.seller_request_payout(_amount numeric, _method text, _details text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_avail numeric;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.seller_applications WHERE user_id = v_uid AND status = 'approved') THEN
    RAISE EXCEPTION 'not_approved_seller' USING ERRCODE = '42501';
  END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  IF _method IS NULL OR length(btrim(_method)) = 0 THEN RAISE EXCEPTION 'invalid_method'; END IF;
  IF _details IS NOT NULL AND length(_details) > 500 THEN RAISE EXCEPTION 'details_too_long'; END IF;

  IF EXISTS (SELECT 1 FROM public.payout_requests WHERE vendor_id = v_uid AND status = 'pending') THEN
    RAISE EXCEPTION 'pending_request_exists';
  END IF;

  v_avail := (public.seller_wallet_summary() ->> 'withdrawable')::numeric;
  IF _amount > v_avail THEN RAISE EXCEPTION 'amount_exceeds_balance'; END IF;

  INSERT INTO public.payout_requests (vendor_id, amount, method, details)
  VALUES (v_uid, _amount, btrim(_method), NULLIF(btrim(COALESCE(_details, '')), ''))
  RETURNING id INTO v_id;

  INSERT INTO public.activity_logs (user_id, action_type, action_details)
  VALUES (v_uid, 'payout_requested', jsonb_build_object('payout_id', v_id, 'amount', _amount, 'method', btrim(_method)));

  RETURN v_id;
END; $$;

REVOKE ALL ON FUNCTION public.seller_request_payout(numeric, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.seller_request_payout(numeric, text, text) TO authenticated;

-- 5) Store profile update
CREATE OR REPLACE FUNCTION public.seller_update_store_profile(
  _store_name text DEFAULT NULL, _store_description text DEFAULT NULL,
  _contact_email text DEFAULT NULL, _contact_phone text DEFAULT NULL,
  _address text DEFAULT NULL, _city text DEFAULT NULL,
  _logo_url text DEFAULT NULL, _cover_image_url text DEFAULT NULL,
  _working_hours text DEFAULT NULL, _return_policy text DEFAULT NULL,
  _shipping_policy text DEFAULT NULL, _business_info text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;

  UPDATE public.seller_applications SET
    store_name = COALESCE(NULLIF(btrim(_store_name), ''), store_name),
    store_description = COALESCE(_store_description, store_description),
    contact_email = COALESCE(_contact_email, contact_email),
    contact_phone = COALESCE(_contact_phone, contact_phone),
    address = COALESCE(_address, address),
    city = COALESCE(_city, city),
    logo_url = COALESCE(_logo_url, logo_url),
    cover_image_url = COALESCE(_cover_image_url, cover_image_url),
    working_hours = COALESCE(_working_hours, working_hours),
    return_policy = COALESCE(_return_policy, return_policy),
    shipping_policy = COALESCE(_shipping_policy, shipping_policy),
    business_info = COALESCE(_business_info, business_info),
    updated_at = now()
  WHERE user_id = v_uid AND status IN ('approved','pending','suspended');

  INSERT INTO public.activity_logs (user_id, action_type, action_details)
  VALUES (v_uid, 'store_profile_updated', jsonb_build_object('at', now()));
END; $$;

REVOKE ALL ON FUNCTION public.seller_update_store_profile(text,text,text,text,text,text,text,text,text,text,text,text) FROM public;
GRANT EXECUTE ON FUNCTION public.seller_update_store_profile(text,text,text,text,text,text,text,text,text,text,text,text) TO authenticated;

-- 6) Seller dashboard overview
CREATE OR REPLACE FUNCTION public.seller_dashboard_overview(_days integer DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_days integer := GREATEST(LEAST(COALESCE(_days, 30), 365), 1);
  v_since timestamptz := now() - make_interval(days => v_days);
  v_today date := (now() AT TIME ZONE 'UTC')::date;
  v_sales jsonb; v_orders jsonb; v_products jsonb; v_engage jsonb;
  v_series jsonb; v_top jsonb; v_latest_orders jsonb; v_latest_reviews jsonb; v_latest_messages jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;

  WITH items AS (
    SELECT oi.quantity, oi.price, o.created_at, public.normalize_order_status(o.status) AS st
    FROM public.order_items oi JOIN public.orders o ON o.id = oi.order_id
    WHERE oi.vendor_id = v_uid
  ), settled AS (SELECT * FROM items WHERE st IN ('delivered','completed'))
  SELECT jsonb_build_object(
    'today', COALESCE((SELECT SUM(price*quantity) FROM settled WHERE (created_at AT TIME ZONE 'UTC')::date = v_today), 0),
    'yesterday', COALESCE((SELECT SUM(price*quantity) FROM settled WHERE (created_at AT TIME ZONE 'UTC')::date = v_today - 1), 0),
    'week', COALESCE((SELECT SUM(price*quantity) FROM settled WHERE created_at >= now() - interval '7 days'), 0),
    'month', COALESCE((SELECT SUM(price*quantity) FROM settled WHERE created_at >= date_trunc('month', now())), 0),
    'total', COALESCE((SELECT SUM(price*quantity) FROM settled), 0),
    'period', COALESCE((SELECT SUM(price*quantity) FROM settled WHERE created_at >= v_since), 0),
    'units_sold', COALESCE((SELECT SUM(quantity) FROM settled), 0)
  ) INTO v_sales;

  WITH vo AS (
    SELECT DISTINCT o.id, public.normalize_order_status(o.status) AS st, o.created_at
    FROM public.orders o JOIN public.order_items oi ON oi.order_id = o.id
    WHERE oi.vendor_id = v_uid
  )
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'pending', COUNT(*) FILTER (WHERE st = 'pending'),
    'confirmed', COUNT(*) FILTER (WHERE st = 'confirmed'),
    'preparing', COUNT(*) FILTER (WHERE st = 'preparing'),
    'ready_for_shipping', COUNT(*) FILTER (WHERE st = 'ready_for_shipping'),
    'shipped', COUNT(*) FILTER (WHERE st = 'shipped'),
    'out_for_delivery', COUNT(*) FILTER (WHERE st = 'out_for_delivery'),
    'delivered', COUNT(*) FILTER (WHERE st = 'delivered'),
    'completed', COUNT(*) FILTER (WHERE st = 'completed'),
    'cancelled', COUNT(*) FILTER (WHERE st = 'cancelled'),
    'period', COUNT(*) FILTER (WHERE created_at >= v_since),
    'returns_pending', (SELECT COUNT(*) FROM public.returns WHERE vendor_id = v_uid AND status = 'pending'),
    'returns_total', (SELECT COUNT(*) FROM public.returns WHERE vendor_id = v_uid)
  ) INTO v_orders FROM vo;

  SELECT jsonb_build_object(
    'total', COUNT(*),
    'active', COUNT(*) FILTER (WHERE COALESCE(is_active, false) AND moderation_status = 'approved'),
    'pending', COUNT(*) FILTER (WHERE moderation_status = 'pending'),
    'rejected', COUNT(*) FILTER (WHERE moderation_status = 'rejected'),
    'archived', COUNT(*) FILTER (WHERE NOT COALESCE(is_active, false)),
    'out_of_stock', COUNT(*) FILTER (WHERE COALESCE(stock_quantity, 0) = 0),
    'low_stock', COUNT(*) FILTER (WHERE COALESCE(stock_quantity, 0) > 0 AND COALESCE(stock_quantity, 0) <= 5)
  ) INTO v_products FROM public.products WHERE vendor_id = v_uid;

  SELECT jsonb_build_object(
    'views', (SELECT COUNT(*) FROM public.recently_viewed rv JOIN public.products p ON p.id = rv.product_id WHERE p.vendor_id = v_uid),
    'views_period', (SELECT COUNT(*) FROM public.recently_viewed rv JOIN public.products p ON p.id = rv.product_id WHERE p.vendor_id = v_uid AND rv.viewed_at >= v_since),
    'avg_rating', COALESCE((SELECT ROUND(AVG(r.rating)::numeric, 2) FROM public.reviews r JOIN public.products p ON p.id = r.product_id WHERE p.vendor_id = v_uid AND NOT r.is_hidden), 0),
    'reviews_count', (SELECT COUNT(*) FROM public.reviews r JOIN public.products p ON p.id = r.product_id WHERE p.vendor_id = v_uid),
    'unread_messages', (SELECT COUNT(*) FROM public.messages m JOIN public.conversations c ON c.id = m.conversation_id WHERE c.vendor_id = v_uid AND m.sender_id <> v_uid AND NOT m.is_read AND NOT m.is_deleted),
    'conversations', (SELECT COUNT(*) FROM public.conversations WHERE vendor_id = v_uid),
    'followers', (SELECT COUNT(*) FROM public.vendor_followers WHERE vendor_id = v_uid),
    'customers', (SELECT COUNT(DISTINCT o.customer_id) FROM public.orders o JOIN public.order_items oi ON oi.order_id = o.id WHERE oi.vendor_id = v_uid)
  ) INTO v_engage;

  WITH days AS (
    SELECT generate_series((v_since AT TIME ZONE 'UTC')::date, v_today, interval '1 day')::date AS d
  ), agg AS (
    SELECT (o.created_at AT TIME ZONE 'UTC')::date AS d,
           SUM(oi.price * oi.quantity) FILTER (WHERE public.normalize_order_status(o.status) IN ('delivered','completed')) AS revenue,
           COUNT(DISTINCT o.id) AS orders
    FROM public.orders o JOIN public.order_items oi ON oi.order_id = o.id
    WHERE oi.vendor_id = v_uid AND o.created_at >= v_since
    GROUP BY 1
  ), views AS (
    SELECT (rv.viewed_at AT TIME ZONE 'UTC')::date AS d, COUNT(*) AS views
    FROM public.recently_viewed rv JOIN public.products p ON p.id = rv.product_id
    WHERE p.vendor_id = v_uid AND rv.viewed_at >= v_since GROUP BY 1
  )
  SELECT jsonb_agg(jsonb_build_object(
    'date', days.d,
    'revenue', COALESCE(agg.revenue, 0),
    'orders', COALESCE(agg.orders, 0),
    'views', COALESCE(views.views, 0)
  ) ORDER BY days.d) INTO v_series
  FROM days LEFT JOIN agg ON agg.d = days.d LEFT JOIN views ON views.d = days.d;

  SELECT jsonb_agg(t) INTO v_top FROM (
    SELECT p.id, p.name, p.image_url, SUM(oi.quantity) AS units, SUM(oi.price * oi.quantity) AS revenue
    FROM public.order_items oi JOIN public.products p ON p.id = oi.product_id
    JOIN public.orders o ON o.id = oi.order_id
    WHERE oi.vendor_id = v_uid AND public.normalize_order_status(o.status) IN ('delivered','completed')
    GROUP BY p.id, p.name, p.image_url ORDER BY units DESC LIMIT 8
  ) t;

  SELECT jsonb_agg(t) INTO v_latest_orders FROM (
    SELECT DISTINCT o.id, o.created_at, o.status, o.total_amount,
           NULLIF(split_part(COALESCE(o.shipping_address, ''), ',', 1), '') AS city
    FROM public.orders o JOIN public.order_items oi ON oi.order_id = o.id
    WHERE oi.vendor_id = v_uid ORDER BY o.created_at DESC LIMIT 8
  ) t;

  SELECT jsonb_agg(t) INTO v_latest_reviews FROM (
    SELECT r.id, r.rating, r.comment, r.created_at, p.name AS product_name
    FROM public.reviews r JOIN public.products p ON p.id = r.product_id
    WHERE p.vendor_id = v_uid AND NOT r.is_hidden ORDER BY r.created_at DESC LIMIT 6
  ) t;

  SELECT jsonb_agg(t) INTO v_latest_messages FROM (
    SELECT m.id, m.conversation_id, m.content, m.created_at, m.is_read
    FROM public.messages m JOIN public.conversations c ON c.id = m.conversation_id
    WHERE c.vendor_id = v_uid AND m.sender_id <> v_uid AND NOT m.is_deleted
    ORDER BY m.created_at DESC LIMIT 6
  ) t;

  RETURN jsonb_build_object(
    'days', v_days,
    'sales', v_sales,
    'orders', v_orders,
    'products', v_products,
    'engagement', v_engage,
    'wallet', public.seller_wallet_summary(),
    'series', COALESCE(v_series, '[]'::jsonb),
    'top_products', COALESCE(v_top, '[]'::jsonb),
    'latest_orders', COALESCE(v_latest_orders, '[]'::jsonb),
    'latest_reviews', COALESCE(v_latest_reviews, '[]'::jsonb),
    'latest_messages', COALESCE(v_latest_messages, '[]'::jsonb)
  );
END; $$;

REVOKE ALL ON FUNCTION public.seller_dashboard_overview(integer) FROM public;
GRANT EXECUTE ON FUNCTION public.seller_dashboard_overview(integer) TO authenticated;
