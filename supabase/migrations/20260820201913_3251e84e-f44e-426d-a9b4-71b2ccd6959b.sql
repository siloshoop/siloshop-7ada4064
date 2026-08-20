CREATE OR REPLACE FUNCTION public.admin_dashboard_overview(_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_days integer := GREATEST(LEAST(COALESCE(_days, 30), 365), 1);
  v_since timestamptz := now() - make_interval(days => v_days);
  v_today date := (now() AT TIME ZONE 'UTC')::date;
  v_orders jsonb;
  v_revenue jsonb;
  v_users jsonb;
  v_products jsonb;
  v_returns jsonb;
  v_series jsonb;
  v_users_series jsonb;
  v_top_products jsonb;
  v_top_sellers jsonb;
  v_latest jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT (
    public.has_role(v_uid, 'admin'::public.app_role)
    OR public.has_role(v_uid, 'super_admin'::public.app_role)
    OR public.has_role(v_uid, 'moderator'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'total', COUNT(*),
    'pending', COUNT(*) FILTER (WHERE public.normalize_order_status(status) = 'pending'),
    'confirmed', COUNT(*) FILTER (WHERE public.normalize_order_status(status) = 'confirmed'),
    'preparing', COUNT(*) FILTER (WHERE public.normalize_order_status(status) = 'preparing'),
    'ready_for_shipping', COUNT(*) FILTER (WHERE public.normalize_order_status(status) = 'ready_for_shipping'),
    'shipped', COUNT(*) FILTER (WHERE public.normalize_order_status(status) = 'shipped'),
    'out_for_delivery', COUNT(*) FILTER (WHERE public.normalize_order_status(status) = 'out_for_delivery'),
    'delivered', COUNT(*) FILTER (WHERE public.normalize_order_status(status) = 'delivered'),
    'completed', COUNT(*) FILTER (WHERE public.normalize_order_status(status) = 'completed'),
    'cancelled', COUNT(*) FILTER (WHERE public.normalize_order_status(status) = 'cancelled'),
    'returned', COUNT(*) FILTER (WHERE public.normalize_order_status(status) = 'returned'),
    'frozen', COUNT(*) FILTER (WHERE is_frozen),
    'period', COUNT(*) FILTER (WHERE created_at >= v_since),
    'today', COUNT(*) FILTER (WHERE (created_at AT TIME ZONE 'UTC')::date = v_today)
  ) INTO v_orders
  FROM public.orders;

  SELECT jsonb_build_object(
    'total', COALESCE(SUM(total_amount) FILTER (WHERE public.normalize_order_status(status) IN ('delivered','completed')), 0),
    'today', COALESCE(SUM(total_amount) FILTER (WHERE public.normalize_order_status(status) IN ('delivered','completed') AND (created_at AT TIME ZONE 'UTC')::date = v_today), 0),
    'month', COALESCE(SUM(total_amount) FILTER (WHERE public.normalize_order_status(status) IN ('delivered','completed') AND created_at >= date_trunc('month', now())), 0),
    'period', COALESCE(SUM(total_amount) FILTER (WHERE public.normalize_order_status(status) IN ('delivered','completed') AND created_at >= v_since), 0),
    'avg_order_value', COALESCE(AVG(total_amount) FILTER (WHERE public.normalize_order_status(status) IN ('delivered','completed')), 0),
    'pending_payment', COALESCE(SUM(total_amount) FILTER (WHERE payment_status = 'pending'), 0)
  ) INTO v_revenue
  FROM public.orders;

  SELECT jsonb_build_object(
    'total', COUNT(*),
    'customers', COUNT(*) FILTER (WHERE p.role = 'customer'),
    'vendors', COUNT(*) FILTER (WHERE p.role = 'vendor'),
    'active_customers', COUNT(*) FILTER (WHERE p.role = 'customer' AND NOT p.is_banned AND p.account_status = 'active'),
    'suspended', COUNT(*) FILTER (WHERE p.account_status = 'suspended'),
    'banned', COUNT(*) FILTER (WHERE p.is_banned),
    'new_period', COUNT(*) FILTER (WHERE p.created_at >= v_since),
    'sellers_approved', (SELECT COUNT(*) FROM public.seller_applications WHERE status = 'approved'),
    'sellers_pending', (SELECT COUNT(*) FROM public.seller_applications WHERE status = 'pending'),
    'sellers_suspended', (SELECT COUNT(*) FROM public.seller_applications WHERE status = 'suspended'),
    'reports_pending', (SELECT COUNT(*) FROM public.reports WHERE status = 'pending')
  ) INTO v_users
  FROM public.profiles p;

  SELECT jsonb_build_object(
    'total', COUNT(*),
    'pending', COUNT(*) FILTER (WHERE moderation_status = 'pending'),
    'approved', COUNT(*) FILTER (WHERE moderation_status = 'approved'),
    'rejected', COUNT(*) FILTER (WHERE moderation_status = 'rejected'),
    'archived', COUNT(*) FILTER (WHERE NOT COALESCE(is_active, false)),
    'active', COUNT(*) FILTER (WHERE COALESCE(is_active, false)),
    'low_stock', COUNT(*) FILTER (WHERE COALESCE(stock_quantity, 0) > 0 AND COALESCE(stock_quantity, 0) <= 5),
    'out_of_stock', COUNT(*) FILTER (WHERE COALESCE(stock_quantity, 0) = 0)
  ) INTO v_products
  FROM public.products;

  SELECT jsonb_build_object(
    'total', COUNT(*),
    'pending', COUNT(*) FILTER (WHERE status IN ('pending','pending_review')),
    'approved', COUNT(*) FILTER (WHERE status = 'approved'),
    'rejected', COUNT(*) FILTER (WHERE status = 'rejected'),
    'period', COUNT(*) FILTER (WHERE created_at >= v_since)
  ) INTO v_returns
  FROM public.returns;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_series
  FROM (
    SELECT d.day::date AS day,
           COALESCE(o.orders_count, 0) AS orders,
           COALESCE(o.revenue, 0) AS revenue
    FROM generate_series(v_since::date, v_today, interval '1 day') AS d(day)
    LEFT JOIN (
      SELECT (created_at AT TIME ZONE 'UTC')::date AS day,
             COUNT(*) AS orders_count,
             SUM(total_amount) FILTER (WHERE public.normalize_order_status(status) IN ('delivered','completed')) AS revenue
      FROM public.orders
      WHERE created_at >= v_since
      GROUP BY 1
    ) o ON o.day = d.day::date
    ORDER BY d.day
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_users_series
  FROM (
    SELECT d.day::date AS day, COALESCE(u.new_users, 0) AS users
    FROM generate_series(v_since::date, v_today, interval '1 day') AS d(day)
    LEFT JOIN (
      SELECT (created_at AT TIME ZONE 'UTC')::date AS day, COUNT(*) AS new_users
      FROM public.profiles
      WHERE created_at >= v_since
      GROUP BY 1
    ) u ON u.day = d.day::date
    ORDER BY d.day
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_top_products
  FROM (
    SELECT p.id, p.name, p.image_url,
           SUM(oi.quantity)::int AS units,
           SUM(oi.quantity * oi.price) AS revenue
    FROM public.order_items oi
    JOIN public.products p ON p.id = oi.product_id
    JOIN public.orders o ON o.id = oi.order_id
    WHERE o.created_at >= v_since
      AND public.normalize_order_status(o.status) <> 'cancelled'
    GROUP BY p.id, p.name, p.image_url
    ORDER BY revenue DESC
    LIMIT 8
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_top_sellers
  FROM (
    SELECT pr.id, COALESCE(sa.store_name, pr.full_name, 'بائع') AS name,
           COUNT(DISTINCT oi.order_id)::int AS orders,
           SUM(oi.quantity * oi.price) AS revenue
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    JOIN public.profiles pr ON pr.id = oi.vendor_id
    LEFT JOIN public.seller_applications sa ON sa.user_id = pr.id
    WHERE o.created_at >= v_since
      AND public.normalize_order_status(o.status) <> 'cancelled'
    GROUP BY pr.id, sa.store_name, pr.full_name
    ORDER BY revenue DESC
    LIMIT 8
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_latest
  FROM (
    SELECT o.id, o.total_amount, o.status, o.payment_status, o.created_at,
           COALESCE(p.full_name, 'عميل') AS customer_name
    FROM public.orders o
    LEFT JOIN public.profiles p ON p.id = o.customer_id
    ORDER BY o.created_at DESC
    LIMIT 10
  ) t;

  RETURN jsonb_build_object(
    'days', v_days,
    'generated_at', now(),
    'orders', v_orders,
    'revenue', v_revenue,
    'users', v_users,
    'products', v_products,
    'returns', v_returns,
    'series', v_series,
    'users_series', v_users_series,
    'top_products', v_top_products,
    'top_sellers', v_top_sellers,
    'latest_orders', v_latest
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_dashboard_overview(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_overview(integer) TO authenticated;