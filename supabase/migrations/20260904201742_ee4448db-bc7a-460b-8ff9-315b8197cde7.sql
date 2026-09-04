CREATE OR REPLACE FUNCTION public.get_order_timeline(_order_id uuid)
 RETURNS TABLE(id uuid, status text, from_status text, notes text, changed_by_role text, actor_name text, ip_address text, user_agent text, is_override boolean, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _is_admin boolean; _is_customer boolean; _is_vendor boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  _is_admin := public.has_any_admin_role(_uid);
  SELECT EXISTS (SELECT 1 FROM public.orders o WHERE o.id = _order_id AND o.customer_id = _uid) INTO _is_customer;
  _is_vendor := public.is_order_vendor(_order_id, _uid);
  IF NOT (_is_admin OR _is_customer OR _is_vendor) THEN RAISE EXCEPTION 'not_authorized'; END IF;

  RETURN QUERY
  SELECT h.id, h.status, h.from_status, h.notes,
         COALESCE(h.changed_by_role,'system') AS changed_by_role,
         CASE WHEN _is_admin THEN p.full_name ELSE NULL END AS actor_name,
         CASE WHEN _is_admin THEN h.ip_address ELSE NULL END AS ip_address,
         CASE WHEN _is_admin THEN h.user_agent ELSE NULL END AS user_agent,
         h.is_override, h.created_at
  FROM public.order_status_history h
  LEFT JOIN public.profiles p ON p.id = h.changed_by
  WHERE h.order_id = _order_id
     OR h.order_id IN (SELECT c.id FROM public.orders c WHERE c.parent_order_id = _order_id)
  ORDER BY h.created_at ASC;
END; $function$;

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
  _is_admin := public.has_any_admin_role(_uid);
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