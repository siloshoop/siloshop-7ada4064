CREATE OR REPLACE FUNCTION public.daily_revenue_by_currency(_scope text DEFAULT 'vendor', _days integer DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_n int := GREATEST(LEAST(COALESCE(_days,30),365),1);
  v_res jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE='42501'; END IF;
  IF _scope = 'admin' AND NOT (public.has_role(v_uid,'admin') OR public.has_role(v_uid,'super_admin') OR public.has_role(v_uid,'moderator')) THEN
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
END $$;
REVOKE ALL ON FUNCTION public.daily_revenue_by_currency(text,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.daily_revenue_by_currency(text,integer) TO authenticated;