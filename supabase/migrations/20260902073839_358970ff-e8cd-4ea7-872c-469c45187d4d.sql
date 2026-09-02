CREATE OR REPLACE FUNCTION public.admin_get_analytics(_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
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
  IF NOT (
    public.has_role(v_uid, 'admin'::public.app_role)
    OR public.has_role(v_uid, 'super_admin'::public.app_role)
    OR public.has_role(v_uid, 'moderator'::public.app_role)
  ) THEN
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