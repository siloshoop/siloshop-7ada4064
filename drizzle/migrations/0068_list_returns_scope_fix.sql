CREATE OR REPLACE FUNCTION public.list_returns(_scope text DEFAULT 'customer'::text, _status text DEFAULT NULL::text, _search text DEFAULT NULL::text, _limit integer DEFAULT 20, _offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _total int; _rows jsonb; _q text := NULLIF(trim(COALESCE(_search,'')),'');
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _scope IS NULL OR _scope NOT IN ('customer', 'vendor', 'admin') THEN RAISE EXCEPTION 'invalid_scope'; END IF;
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
              WHEN 'admin' THEN public.has_role(_uid, 'super_admin'::public.app_role)
              ELSE false END)
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