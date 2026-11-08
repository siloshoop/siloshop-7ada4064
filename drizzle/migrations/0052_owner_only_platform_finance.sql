-- Restrict platform-wide sales, revenue, reports, payouts, coupon usage and seller performance to the platform owner (super_admin).
-- Only the role checks change. Function bodies, return columns, grants, owners and every stored record stay exactly as they are.

-- 1. revenue_totals_by_currency
CREATE OR REPLACE FUNCTION public.revenue_totals_by_currency(_scope text DEFAULT 'vendor'::text, _days integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_since timestamptz := now() - make_interval(days => GREATEST(LEAST(COALESCE(_days,30),365),1));
  v_today date := (now() AT TIME ZONE 'UTC')::date;
  v_res jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE='42501'; END IF;
  IF _scope = 'admin' THEN
    IF NOT public.has_role(v_uid, 'super_admin'::public.app_role) THEN
      RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
    END IF;
    SELECT COALESCE(jsonb_object_agg(cur, obj), '{}'::jsonb) INTO v_res FROM (
      SELECT CASE WHEN upper(coalesce(currency,'SYP'))='USD' THEN 'USD' ELSE 'SYP' END AS cur,
        jsonb_build_object(
          'total', COALESCE(SUM(total_amount),0),
          'today', COALESCE(SUM(total_amount) FILTER (WHERE (created_at AT TIME ZONE 'UTC')::date = v_today),0),
          'month', COALESCE(SUM(total_amount) FILTER (WHERE created_at >= date_trunc('month', now())),0),
          'period', COALESCE(SUM(total_amount) FILTER (WHERE created_at >= v_since),0),
          'avg', COALESCE(AVG(total_amount),0),
          'count', COUNT(*)) AS obj
      FROM public.orders
      WHERE public.normalize_order_status(status) IN ('delivered','completed')
      GROUP BY 1) t;
  ELSE
    SELECT COALESCE(jsonb_object_agg(cur, obj), '{}'::jsonb) INTO v_res FROM (
      SELECT cur, jsonb_build_object(
          'total', SUM(amt),
          'today', COALESCE(SUM(amt) FILTER (WHERE (created_at AT TIME ZONE 'UTC')::date = v_today),0),
          'month', COALESCE(SUM(amt) FILTER (WHERE created_at >= date_trunc('month', now())),0),
          'period', COALESCE(SUM(amt) FILTER (WHERE created_at >= v_since),0),
          'avg', SUM(amt) / NULLIF(COUNT(DISTINCT order_id),0),
          'count', COUNT(DISTINCT order_id)) AS obj
      FROM (
        SELECT CASE WHEN upper(coalesce(oi.currency,o.currency,'SYP'))='USD' THEN 'USD' ELSE 'SYP' END AS cur,
               oi.price * oi.quantity AS amt, o.created_at, oi.order_id
        FROM public.order_items oi JOIN public.orders o ON o.id = oi.order_id
        WHERE oi.vendor_id = v_uid
          AND public.normalize_order_status(o.status) IN ('delivered','completed')
      ) s GROUP BY cur) t;
  END IF;
  RETURN v_res;
END $function$;

-- 2. daily_revenue_by_currency
CREATE OR REPLACE FUNCTION public.daily_revenue_by_currency(_scope text DEFAULT 'vendor'::text, _days integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_n int := GREATEST(LEAST(COALESCE(_days,30),365),1);
  v_res jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE='42501'; END IF;
  IF _scope = 'admin' AND NOT public.has_role(v_uid, 'super_admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;
  WITH days AS (
    SELECT generate_series((now() AT TIME ZONE 'UTC')::date - (v_n-1), (now() AT TIME ZONE 'UTC')::date, interval '1 day')::date AS d
  ), src AS (
    SELECT (o.created_at AT TIME ZONE 'UTC')::date AS d,
           CASE WHEN upper(coalesce(o.currency,'SYP'))='USD' THEN 'USD' ELSE 'SYP' END AS cur,
           o.total_amount AS amt
      FROM public.orders o
     WHERE _scope = 'admin' AND public.normalize_order_status(o.status) IN ('delivered','completed')
       AND o.created_at >= now() - make_interval(days => v_n)
    UNION ALL
    SELECT (o.created_at AT TIME ZONE 'UTC')::date,
           CASE WHEN upper(coalesce(oi.currency,o.currency,'SYP'))='USD' THEN 'USD' ELSE 'SYP' END,
           oi.price * oi.quantity
      FROM public.order_items oi JOIN public.orders o ON o.id = oi.order_id
     WHERE _scope <> 'admin' AND oi.vendor_id = v_uid
       AND public.normalize_order_status(o.status) IN ('delivered','completed')
       AND o.created_at >= now() - make_interval(days => v_n)
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'day', days.d,
           'syp', COALESCE((SELECT SUM(amt) FROM src WHERE src.d = days.d AND cur='SYP'),0),
           'usd', COALESCE((SELECT SUM(amt) FROM src WHERE src.d = days.d AND cur='USD'),0)) ORDER BY days.d),'[]'::jsonb)
    INTO v_res FROM days;
  RETURN v_res;
END $function$;

-- 3. admin_dashboard_overview
CREATE OR REPLACE FUNCTION public.admin_dashboard_overview(_days integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  IF NOT public.has_role(v_uid, 'super_admin'::public.app_role) THEN
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
$function$;

-- 4. admin_get_analytics
CREATE OR REPLACE FUNCTION public.admin_get_analytics(_days integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_since timestamptz := now() - make_interval(days => GREATEST(_days, 1));
  v_result jsonb;
  v_users jsonb;
  v_sellers jsonb;
  v_orders jsonb;
  v_products jsonb;
  v_reports jsonb;
  v_daily_users jsonb;
  v_daily_orders jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_role(v_uid, 'super_admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'total', COUNT(*),
    'customers', COUNT(*) FILTER (WHERE p.role = 'customer'),
    'vendors', COUNT(*) FILTER (WHERE p.role = 'vendor'),
    'banned', COUNT(*) FILTER (WHERE p.is_banned),
    'suspended', COUNT(*) FILTER (WHERE p.account_status = 'suspended'),
    'active_period', (SELECT COUNT(DISTINCT user_id) FROM public.activity_logs WHERE created_at >= v_since),
    'new_period', COUNT(*) FILTER (WHERE p.created_at >= v_since),
    'admins', (SELECT COUNT(DISTINCT ur.user_id) FROM public.user_roles ur WHERE ur.role IN ('admin','super_admin','moderator'))
  )
  INTO v_users
  FROM public.profiles p;

  SELECT jsonb_build_object(
    'approved', COUNT(*) FILTER (WHERE status = 'approved'),
    'pending', COUNT(*) FILTER (WHERE status = 'pending'),
    'rejected', COUNT(*) FILTER (WHERE status = 'rejected'),
    'suspended', COUNT(*) FILTER (WHERE status = 'suspended'),
    'total', COUNT(*)
  )
  INTO v_sellers
  FROM public.seller_applications;

  -- Orders + revenue (parent orders only; per-seller sub-orders would double count)
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'pending', COUNT(*) FILTER (WHERE status = 'pending'),
    'processing', COUNT(*) FILTER (WHERE status IN ('processing','confirmed','shipped','out_for_delivery')),
    'delivered', COUNT(*) FILTER (WHERE status = 'delivered'),
    'cancelled', COUNT(*) FILTER (WHERE status = 'cancelled'),
    'returned', COUNT(*) FILTER (WHERE status = 'returned'),
    'period_count', COUNT(*) FILTER (WHERE created_at >= v_since),
    'revenue_total', COALESCE(SUM(total_amount) FILTER (WHERE status = 'delivered'), 0),
    'revenue_period', COALESCE(SUM(total_amount) FILTER (WHERE status = 'delivered' AND created_at >= v_since), 0),
    'avg_order_value', COALESCE(AVG(total_amount) FILTER (WHERE status = 'delivered'), 0)
  )
  INTO v_orders
  FROM public.orders
  WHERE parent_order_id IS NULL;

  SELECT jsonb_build_object(
    'total', COUNT(*),
    'active', COUNT(*) FILTER (WHERE is_active),
    'platform', COUNT(*) FILTER (WHERE product_type = 'platform'),
    'seller', COUNT(*) FILTER (WHERE product_type = 'seller'),
    'pending', COUNT(*) FILTER (WHERE moderation_status = 'pending'),
    'approved', COUNT(*) FILTER (WHERE moderation_status = 'approved'),
    'rejected', COUNT(*) FILTER (WHERE moderation_status = 'rejected'),
    'out_of_stock', COUNT(*) FILTER (WHERE COALESCE(stock_quantity, 0) = 0)
  )
  INTO v_products
  FROM public.products;

  SELECT jsonb_build_object(
    'total', COUNT(*),
    'pending', COUNT(*) FILTER (WHERE status = 'pending'),
    'under_review', COUNT(*) FILTER (WHERE status = 'under_review'),
    'resolved', COUNT(*) FILTER (WHERE status = 'resolved'),
    'rejected', COUNT(*) FILTER (WHERE status = 'rejected')
  )
  INTO v_reports
  FROM public.reports;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.day), '[]'::jsonb)
  INTO v_daily_users
  FROM (
    SELECT date_trunc('day', created_at)::date AS day, COUNT(*)::int AS count
    FROM public.profiles
    WHERE created_at >= v_since
    GROUP BY 1
    ORDER BY 1
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.day), '[]'::jsonb)
  INTO v_daily_orders
  FROM (
    SELECT
      date_trunc('day', created_at)::date AS day,
      COUNT(*)::int AS orders,
      COALESCE(SUM(total_amount) FILTER (WHERE status = 'delivered'), 0)::numeric AS revenue
    FROM public.orders
    WHERE created_at >= v_since
      AND parent_order_id IS NULL
    GROUP BY 1
    ORDER BY 1
  ) t;

  v_result := jsonb_build_object(
    'period_days', _days,
    'generated_at', now(),
    'users', v_users,
    'sellers', v_sellers,
    'orders', v_orders,
    'products', v_products,
    'reports', v_reports,
    'daily_users', v_daily_users,
    'daily_orders', v_daily_orders
  );

  RETURN v_result;
END;
$function$;

-- 5. order_reports
CREATE OR REPLACE FUNCTION public.order_reports(_from timestamp with time zone DEFAULT (now() - '30 days'::interval), _to timestamp with time zone DEFAULT now())
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _is_admin boolean;
  _is_vendor boolean;
  _res jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  _is_admin := public.has_role(_uid, 'super_admin'::public.app_role);
  _is_vendor := public.has_role(_uid, 'vendor'::public.app_role);
  IF NOT (_is_admin OR _is_vendor) THEN RAISE EXCEPTION 'not_authorized'; END IF;

  WITH scoped AS (
    SELECT DISTINCT o.*
      FROM public.orders o
      LEFT JOIN public.order_items oi ON oi.order_id = o.id
     WHERE o.created_at BETWEEN _from AND _to
       AND (_is_admin OR oi.vendor_id = _uid)
  ),
  scoped_items AS (
    SELECT oi.*, o.created_at AS order_created, o.status AS order_status
      FROM public.order_items oi
      JOIN scoped o ON o.id = oi.order_id
     WHERE (_is_admin OR oi.vendor_id = _uid)
  )
  SELECT jsonb_build_object(
    'totals', jsonb_build_object(
      'orders', (SELECT count(*) FROM scoped),
      'revenue', (SELECT COALESCE(SUM(CASE WHEN public.normalize_order_status(si.order_status) NOT IN ('cancelled','returned','refunded')
                                           THEN COALESCE(si.subtotal,0) ELSE 0 END), 0) FROM scoped_items si),
      'avg_order_value', (SELECT COALESCE(AVG(s.total_amount), 0) FROM scoped s
                           WHERE public.normalize_order_status(s.status) NOT IN ('cancelled','returned','refunded')),
      'cancelled', (SELECT count(*) FROM scoped s WHERE public.normalize_order_status(s.status) = 'cancelled'),
      'completed', (SELECT count(*) FROM scoped s WHERE public.normalize_order_status(s.status) IN ('completed','delivered')),
      'returned', (SELECT count(*) FROM scoped s WHERE public.normalize_order_status(s.status) IN ('returned','refunded'))
    ),
    'by_status', (SELECT COALESCE(jsonb_object_agg(x.s, x.c), '{}'::jsonb) FROM (
        SELECT public.normalize_order_status(s2.status) AS s, count(*) AS c FROM scoped s2 GROUP BY 1) x),
    'daily', (SELECT COALESCE(jsonb_agg(jsonb_build_object('day', y.d, 'orders', y.c, 'revenue', y.r) ORDER BY y.d), '[]'::jsonb) FROM (
        SELECT date_trunc('day', si.order_created)::date AS d, count(DISTINCT si.order_id) AS c, SUM(COALESCE(si.subtotal,0)) AS r
          FROM scoped_items si GROUP BY 1) y),
    'monthly', (SELECT COALESCE(jsonb_agg(jsonb_build_object('month', z.m, 'orders', z.c, 'revenue', z.r) ORDER BY z.m), '[]'::jsonb) FROM (
        SELECT to_char(date_trunc('month', si.order_created), 'YYYY-MM') AS m, count(DISTINCT si.order_id) AS c, SUM(COALESCE(si.subtotal,0)) AS r
          FROM scoped_items si GROUP BY 1) z),
    'top_products', (SELECT COALESCE(jsonb_agg(jsonb_build_object('product_id', tp.pid, 'name', tp.nm, 'quantity', tp.q, 'revenue', tp.r) ORDER BY tp.r DESC), '[]'::jsonb) FROM (
        SELECT si.product_id AS pid, COALESCE(MAX(si.product_name), MAX(p.name)) AS nm, SUM(si.quantity) AS q, SUM(COALESCE(si.subtotal,0)) AS r
          FROM scoped_items si LEFT JOIN public.products p ON p.id = si.product_id
         WHERE public.normalize_order_status(si.order_status) NOT IN ('cancelled','returned','refunded')
         GROUP BY si.product_id ORDER BY r DESC LIMIT 10) tp),
    'top_sellers', (SELECT CASE WHEN _is_admin THEN COALESCE(jsonb_agg(jsonb_build_object('vendor_id', ts.vid, 'name', ts.nm, 'orders', ts.o, 'revenue', ts.r) ORDER BY ts.r DESC), '[]'::jsonb) ELSE '[]'::jsonb END FROM (
        SELECT si.vendor_id AS vid, MAX(pr.full_name) AS nm, count(DISTINCT si.order_id) AS o, SUM(COALESCE(si.subtotal,0)) AS r
          FROM scoped_items si LEFT JOIN public.profiles pr ON pr.id = si.vendor_id
         WHERE public.normalize_order_status(si.order_status) NOT IN ('cancelled','returned','refunded')
         GROUP BY si.vendor_id ORDER BY r DESC LIMIT 10) ts)
  ) INTO _res;

  RETURN _res;
END;
$function$;

-- 6. return_reports
CREATE OR REPLACE FUNCTION public.return_reports(_from timestamp with time zone DEFAULT (now() - '90 days'::interval), _to timestamp with time zone DEFAULT now(), _vendor_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _v uuid := _vendor_id; _orders int; _out jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF public.has_role(_uid, 'super_admin'::public.app_role) THEN
    _v := _vendor_id;
  ELSE
    _v := _uid;
  END IF;

  SELECT count(DISTINCT o.id)::int INTO _orders
    FROM public.orders o
   WHERE o.created_at BETWEEN _from AND _to
     AND (_v IS NULL OR EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = o.id AND oi.vendor_id = _v));

  SELECT jsonb_build_object(
    'total_returns', (SELECT count(*)::int FROM public.returns r WHERE r.created_at BETWEEN _from AND _to AND (_v IS NULL OR r.vendor_id = _v)),
    'total_orders', _orders,
    'return_rate', CASE WHEN _orders = 0 THEN 0 ELSE round(
        (SELECT count(*)::numeric FROM public.returns r WHERE r.created_at BETWEEN _from AND _to AND (_v IS NULL OR r.vendor_id = _v)) * 100 / _orders, 2) END,
    'by_status', COALESCE((SELECT jsonb_object_agg(s.status, s.c) FROM (
        SELECT r.status, count(*)::int c FROM public.returns r
         WHERE r.created_at BETWEEN _from AND _to AND (_v IS NULL OR r.vendor_id = _v) GROUP BY r.status) s), '{}'::jsonb),
    'top_products', COALESCE((SELECT jsonb_agg(x) FROM (
        SELECT ri.product_id, COALESCE(ri.product_name,'—') product_name, sum(ri.quantity)::int qty, count(*)::int requests
          FROM public.return_items ri JOIN public.returns r ON r.id = ri.return_id
         WHERE r.created_at BETWEEN _from AND _to AND (_v IS NULL OR r.vendor_id = _v)
         GROUP BY ri.product_id, ri.product_name ORDER BY sum(ri.quantity) DESC LIMIT 10) x), '[]'::jsonb),
    'top_reasons', COALESCE((SELECT jsonb_agg(x) FROM (
        SELECT r.reason, COALESCE(rr.label_ar, r.reason) label, count(*)::int c
          FROM public.returns r LEFT JOIN public.return_reasons rr ON rr.code = r.reason
         WHERE r.created_at BETWEEN _from AND _to AND (_v IS NULL OR r.vendor_id = _v)
         GROUP BY r.reason, rr.label_ar ORDER BY count(*) DESC LIMIT 10) x), '[]'::jsonb),
    'top_vendors', CASE WHEN public.has_role(_uid, 'super_admin'::public.app_role) THEN COALESCE((SELECT jsonb_agg(x) FROM (
        SELECT r.vendor_id, COALESCE(p.full_name,'—') vendor_name, count(*)::int c
          FROM public.returns r LEFT JOIN public.profiles p ON p.id = r.vendor_id
         WHERE r.created_at BETWEEN _from AND _to GROUP BY r.vendor_id, p.full_name ORDER BY count(*) DESC LIMIT 10) x), '[]'::jsonb) ELSE '[]'::jsonb END,
    'top_customers', COALESCE((SELECT jsonb_agg(x) FROM (
        SELECT r.customer_id, COALESCE(p.full_name,'—') customer_name, count(*)::int c
          FROM public.returns r LEFT JOIN public.profiles p ON p.id = r.customer_id
         WHERE r.created_at BETWEEN _from AND _to AND (_v IS NULL OR r.vendor_id = _v)
         GROUP BY r.customer_id, p.full_name ORDER BY count(*) DESC LIMIT 10) x), '[]'::jsonb)
  ) INTO _out;
  RETURN _out;
END; $function$;

-- 7. get_seller_performance
CREATE OR REPLACE FUNCTION public.get_seller_performance(_vendor_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(total_orders bigint, delivered_orders bigint, cancelled_orders bigint, returned_orders bigint, avg_prep_hours numeric, avg_delivery_hours numeric, cancellation_rate numeric, return_rate numeric, satisfaction_score numeric, ratings_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _vid uuid := COALESCE(_vendor_id, auth.uid());
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _vid <> auth.uid() AND NOT public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN RAISE EXCEPTION 'not_authorized'; END IF;

  RETURN QUERY
  WITH vo AS (
    SELECT DISTINCT o.id, o.status FROM public.orders o
    JOIN public.order_items oi ON oi.order_id = o.id
    WHERE oi.vendor_id = _vid
  ),
  prep AS (
    SELECT h.order_id,
           EXTRACT(EPOCH FROM (MIN(CASE WHEN h.status IN ('shipped','ready_for_shipping') THEN h.created_at END)
                             - MIN(CASE WHEN h.status = 'confirmed' THEN h.created_at END)))/3600 AS hrs
    FROM public.order_status_history h
    WHERE h.order_id IN (SELECT id FROM vo)
    GROUP BY h.order_id
  ),
  deliv AS (
    SELECT h.order_id,
           EXTRACT(EPOCH FROM (MIN(CASE WHEN h.status = 'delivered' THEN h.created_at END)
                             - MIN(CASE WHEN h.status = 'shipped' THEN h.created_at END)))/3600 AS hrs
    FROM public.order_status_history h
    WHERE h.order_id IN (SELECT id FROM vo)
    GROUP BY h.order_id
  ),
  tot AS (SELECT COUNT(*)::numeric AS n FROM vo)
  SELECT
    (SELECT COUNT(*) FROM vo)::bigint,
    (SELECT COUNT(*) FROM vo WHERE status IN ('delivered','completed'))::bigint,
    (SELECT COUNT(*) FROM vo WHERE status = 'cancelled')::bigint,
    (SELECT COUNT(DISTINCT order_id) FROM public.returns WHERE vendor_id = _vid)::bigint,
    ROUND(COALESCE((SELECT AVG(hrs) FROM prep WHERE hrs IS NOT NULL AND hrs >= 0), 0)::numeric, 2),
    ROUND(COALESCE((SELECT AVG(hrs) FROM deliv WHERE hrs IS NOT NULL AND hrs >= 0), 0)::numeric, 2),
    CASE WHEN (SELECT n FROM tot) > 0
      THEN ROUND((SELECT COUNT(*) FROM vo WHERE status = 'cancelled')::numeric * 100 / (SELECT n FROM tot), 2)
      ELSE 0 END,
    CASE WHEN (SELECT n FROM tot) > 0
      THEN ROUND((SELECT COUNT(DISTINCT order_id) FROM public.returns WHERE vendor_id = _vid)::numeric * 100 / (SELECT n FROM tot), 2)
      ELSE 0 END,
    ROUND(COALESCE((SELECT AVG(rating) FROM public.vendor_ratings WHERE vendor_id = _vid), 0)::numeric, 2),
    (SELECT COUNT(*) FROM public.vendor_ratings WHERE vendor_id = _vid)::bigint;
END; $function$;

-- 8. seller_coupon_stats
CREATE OR REPLACE FUNCTION public.seller_coupon_stats()
 RETURNS TABLE(coupon_id uuid, reserved_units bigint, used_units bigint, redemptions bigint, customers bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT c.id,
         COALESCE(sum(r.units) FILTER (WHERE r.status = 'reserved'), 0),
         COALESCE(sum(r.units) FILTER (WHERE r.status = 'used'), 0),
         count(r.id) FILTER (WHERE r.status <> 'released'),
         count(DISTINCT r.customer_id) FILTER (WHERE r.status <> 'released')
    FROM public.coupons c
    LEFT JOIN public.coupon_redemptions r ON r.coupon_id = c.id
   WHERE c.vendor_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
   GROUP BY c.id
$function$;

-- 9. admin_list_coupons
CREATE OR REPLACE FUNCTION public.admin_list_coupons(_search text DEFAULT NULL::text, _limit integer DEFAULT 200)
 RETURNS TABLE(id uuid, code text, vendor_id uuid, vendor_name text, discount_type text, discount_value numeric, min_purchase numeric, max_uses integer, used_count integer, expires_at timestamp with time zone, is_active boolean, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  RETURN QUERY
  SELECT c.id, c.code, c.vendor_id, p.full_name, c.discount_type, c.discount_value,
         c.min_purchase, c.max_uses, c.used_count, c.expires_at, c.is_active, c.created_at
  FROM public.coupons c
  LEFT JOIN public.profiles p ON p.id = c.vendor_id
  WHERE _search IS NULL OR _search = ''
     OR c.code ILIKE '%' || _search || '%'
     OR COALESCE(p.full_name,'') ILIKE '%' || _search || '%'
  ORDER BY c.created_at DESC
  LIMIT LEAST(COALESCE(_limit, 200), 500);
END; $function$;

-- 10. admin_list_orders
CREATE OR REPLACE FUNCTION public.admin_list_orders(_search text DEFAULT NULL::text, _status text DEFAULT NULL::text, _payment_status text DEFAULT NULL::text, _from timestamp with time zone DEFAULT NULL::timestamp with time zone, _to timestamp with time zone DEFAULT NULL::timestamp with time zone, _limit integer DEFAULT 50, _offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, created_at timestamp with time zone, updated_at timestamp with time zone, status text, payment_status text, total_amount numeric, discount_amount numeric, coupon_code text, phone text, shipping_address text, tracking_number text, courier_name text, delivered_at timestamp with time zone, cancelled_at timestamp with time zone, cancellation_reason text, customer_id uuid, customer_name text, customer_email text, items_count bigint, vendors_count bigint, order_number text, invoice_number text, payment_method text, estimated_delivery timestamp with time zone, is_frozen boolean, total_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT o.*
      FROM public.orders o
     WHERE public.has_role(auth.uid(), 'super_admin'::public.app_role)
       AND o.parent_order_id IS NULL
       AND (_status IS NULL OR public.normalize_order_status(o.status) = public.normalize_order_status(_status))
       AND (_payment_status IS NULL OR o.payment_status = _payment_status)
       AND (_from IS NULL OR o.created_at >= _from)
       AND (_to IS NULL OR o.created_at <= _to)
       AND (
         _search IS NULL OR length(trim(_search)) = 0
         OR COALESCE(o.order_number,'') ILIKE '%' || _search || '%'
         OR COALESCE(o.invoice_number,'') ILIKE '%' || _search || '%'
         OR o.id::text ILIKE '%' || _search || '%'
         OR COALESCE(o.phone,'') ILIKE '%' || _search || '%'
         OR COALESCE(o.tracking_number,'') ILIKE '%' || _search || '%'
         OR COALESCE(o.coupon_code,'') ILIKE '%' || _search || '%'
         OR EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = o.customer_id
                      AND COALESCE(pr.full_name,'') ILIKE '%' || _search || '%')
         OR EXISTS (SELECT 1 FROM auth.users u WHERE u.id = o.customer_id
                      AND COALESCE(u.email,'') ILIKE '%' || _search || '%')
         OR EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = o.id
                      AND COALESCE(oi.product_name,'') ILIKE '%' || _search || '%')
       )
  ), counted AS (SELECT count(*) AS c FROM base)
  SELECT b.id, b.created_at, b.updated_at, public.normalize_order_status(b.status), b.payment_status,
         b.total_amount, b.discount_amount, b.coupon_code, b.phone, b.shipping_address,
         b.tracking_number, b.courier_name, b.delivered_at, b.cancelled_at, b.cancellation_reason,
         b.customer_id, pr.full_name,
         (SELECT u.email::text FROM auth.users u WHERE u.id = b.customer_id),
         (SELECT count(*) FROM public.order_items oi WHERE oi.order_id = b.id),
         (SELECT count(DISTINCT oi.vendor_id) FROM public.order_items oi WHERE oi.order_id = b.id),
         b.order_number, b.invoice_number, b.payment_method, b.estimated_delivery,
         COALESCE(b.is_frozen,false), (SELECT c FROM counted)
    FROM base b
    LEFT JOIN public.profiles pr ON pr.id = b.customer_id
   ORDER BY b.created_at DESC
   LIMIT GREATEST(LEAST(COALESCE(_limit,50), 200), 1)
  OFFSET GREATEST(COALESCE(_offset,0), 0);
$function$;

-- 11. admin_get_order_detail
CREATE OR REPLACE FUNCTION public.admin_get_order_detail(_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT jsonb_build_object(
    'order', to_jsonb(o),
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', oi.id,
        'product_id', oi.product_id,
        'product_name', COALESCE(oi.product_name, pr.name),
        'product_image', COALESCE(pr.image_url, pr.images[1]),
        'quantity', oi.quantity,
        'price', oi.price,
        'vendor_id', oi.vendor_id
      ) ORDER BY oi.created_at)
      FROM public.order_items oi
      LEFT JOIN public.products pr ON pr.id = oi.product_id
      WHERE oi.order_id = o.id
    ), '[]'::jsonb),
    'history', COALESCE((
      SELECT jsonb_agg(to_jsonb(h) ORDER BY h.created_at)
      FROM public.order_status_history h
      WHERE h.order_id = o.id
    ), '[]'::jsonb),
    'payments', COALESCE((
      SELECT jsonb_agg(to_jsonb(p) ORDER BY p.created_at)
      FROM public.payments p
      WHERE p.order_id = o.id
    ), '[]'::jsonb),
    'notes', COALESCE((
      SELECT jsonb_agg(to_jsonb(n) ORDER BY n.created_at)
      FROM public.order_notes n
      WHERE n.order_id = o.id
    ), '[]'::jsonb)
  )
  INTO _result
  FROM public.orders o
  WHERE o.id = _order_id;

  RETURN _result;
END;
$function$;

-- 12. admin_order_sub_orders
CREATE OR REPLACE FUNCTION public.admin_order_sub_orders(_order_id uuid)
 RETURNS TABLE(id uuid, vendor_id uuid, vendor_name text, order_number text, status text, total_amount numeric, items_count bigint, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  RETURN QUERY
  SELECT c.id, c.vendor_id, p.full_name, c.order_number,
         public.normalize_order_status(c.status), c.total_amount,
         (SELECT count(*) FROM public.order_items oi
           WHERE oi.order_id = _order_id AND oi.vendor_id = c.vendor_id),
         c.created_at
    FROM public.orders c
    LEFT JOIN public.profiles p ON p.id = c.vendor_id
   WHERE c.parent_order_id = _order_id
   ORDER BY c.created_at ASC;
END; $function$;

-- 13. seller_order_items
CREATE OR REPLACE FUNCTION public.seller_order_items(_order_id uuid)
 RETURNS TABLE(id uuid, product_name text, product_image text, variant_label text, quantity integer, price numeric, subtotal numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _is_admin boolean;
  _items_order uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  _is_admin := public.has_role(_uid, 'super_admin'::public.app_role);
  IF NOT _is_admin AND NOT public.is_order_vendor(_order_id, _uid) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT COALESCE(o.parent_order_id, o.id) INTO _items_order
    FROM public.orders o WHERE o.id = _order_id;
  IF _items_order IS NULL THEN RAISE EXCEPTION 'order_not_found'; END IF;

  RETURN QUERY
  SELECT oi.id, oi.product_name, oi.product_image, oi.variant_label,
         oi.quantity, oi.price, oi.subtotal
    FROM public.order_items oi
   WHERE oi.order_id = _items_order
     AND (_is_admin OR oi.vendor_id = _uid);
END;
$function$;

-- 14. list_returns
CREATE OR REPLACE FUNCTION public.list_returns(_scope text DEFAULT 'customer'::text, _status text DEFAULT NULL::text, _search text DEFAULT NULL::text, _limit integer DEFAULT 20, _offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _total int; _rows jsonb; _q text := NULLIF(trim(COALESCE(_search,'')),'');
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _scope = 'admin' AND NOT public.has_role(_uid, 'super_admin'::public.app_role) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  _limit := LEAST(GREATEST(COALESCE(_limit,20),1),100);
  _offset := GREATEST(COALESCE(_offset,0),0);

  WITH base AS (
    SELECT r.*, o.order_number, o.total_amount,
           cp.full_name AS customer_name, vp.full_name AS vendor_name,
           rr.label_ar AS reason_label,
           (SELECT count(*) FROM public.return_messages m WHERE m.return_id = r.id AND NOT m.is_read AND m.sender_id <> _uid) AS unread_count,
           (SELECT count(*) FROM public.return_items ri WHERE ri.return_id = r.id) AS items_count
      FROM public.returns r
      JOIN public.orders o ON o.id = r.order_id
      LEFT JOIN public.profiles cp ON cp.id = r.customer_id
      LEFT JOIN public.profiles vp ON vp.id = r.vendor_id
      LEFT JOIN public.return_reasons rr ON rr.code = r.reason
     WHERE (CASE _scope
              WHEN 'customer' THEN r.customer_id = _uid
              WHEN 'vendor' THEN r.vendor_id = _uid
              ELSE true END)
       AND (_status IS NULL OR _status = 'all' OR r.status = _status)
       AND (_q IS NULL
            OR r.return_number ILIKE '%'||_q||'%'
            OR o.order_number ILIKE '%'||_q||'%'
            OR cp.full_name ILIKE '%'||_q||'%'
            OR vp.full_name ILIKE '%'||_q||'%')
  )
  SELECT count(*)::int,
         COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC) FILTER (WHERE t.rn > _offset AND t.rn <= _offset + _limit), '[]'::jsonb)
    INTO _total, _rows
    FROM (SELECT b.*, row_number() OVER (ORDER BY b.created_at DESC) rn FROM base b) t;

  RETURN jsonb_build_object('total', _total, 'rows', _rows, 'limit', _limit, 'offset', _offset);
END; $function$;

-- 15. admin_user_order_history
CREATE OR REPLACE FUNCTION public.admin_user_order_history(_user_id uuid, _limit integer DEFAULT 20)
 RETURNS TABLE(id uuid, created_at timestamp with time zone, status text, total_amount numeric, role text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT o.id, o.created_at, o.status, o.total_amount, 'customer'::text AS role
  FROM public.orders o
  WHERE public.has_role(auth.uid(), 'super_admin'::public.app_role) AND o.customer_id = _user_id
  UNION ALL
  SELECT o.id, o.created_at, o.status, o.total_amount, 'seller'::text AS role
  FROM public.orders o
  WHERE public.has_role(auth.uid(), 'super_admin'::public.app_role)
    AND EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = o.id AND oi.vendor_id = _user_id)
  ORDER BY created_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 100));
$function$;

-- Direct table reads/updates (access rules). Names, commands and target roles are unchanged; only the condition changes.
ALTER POLICY "payouts_admin_select" ON public.payout_requests USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));
ALTER POLICY "payouts_admin_update" ON public.payout_requests USING (public.has_role(auth.uid(), 'super_admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));
ALTER POLICY "Redemptions visible to buyer, seller and admins" ON public.coupon_redemptions USING (((customer_id = auth.uid()) OR (vendor_id = auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));
ALTER POLICY "Admins can view all payments" ON public.payments USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));
ALTER POLICY "Admins can view all payment transactions" ON public.payment_transactions USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));
ALTER POLICY "Admins can view payment webhook events" ON public.payment_webhook_events USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));
ALTER POLICY "Admins can view all returns" ON public.returns USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));