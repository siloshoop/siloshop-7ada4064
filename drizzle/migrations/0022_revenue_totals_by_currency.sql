CREATE OR REPLACE FUNCTION public.revenue_totals_by_currency(_scope text DEFAULT 'vendor', _days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_since timestamptz := now() - make_interval(days => GREATEST(LEAST(COALESCE(_days,30),365),1));
  v_today date := (now() AT TIME ZONE 'UTC')::date;
  v_res jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE='42501'; END IF;
  IF _scope = 'admin' THEN
    IF NOT (public.has_role(v_uid,'admin') OR public.has_role(v_uid,'super_admin') OR public.has_role(v_uid,'moderator')) THEN
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
END $$;
REVOKE ALL ON FUNCTION public.revenue_totals_by_currency(text,integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.revenue_totals_by_currency(text,integer) TO authenticated;