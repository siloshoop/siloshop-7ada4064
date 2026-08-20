-- lock down trigger helper functions
REVOKE ALL ON FUNCTION public.returns_set_number() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.returns_status_event() FROM PUBLIC;

DROP FUNCTION IF EXISTS public.create_return_request(uuid, uuid, text, text, text[], text);
DROP FUNCTION IF EXISTS public.review_return_request(uuid, text, text, text, text);
DROP FUNCTION IF EXISTS public.update_return_status(uuid, text, text);
DROP FUNCTION IF EXISTS public.customer_ship_return(uuid, text);

-- =============== CREATE ===============
CREATE OR REPLACE FUNCTION public.create_return_request(
  _order_id uuid, _reason text, _description text,
  _items jsonb DEFAULT '[]'::jsonb, _images jsonb DEFAULT '[]'::jsonb, _customer_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _order public.orders%ROWTYPE;
  _window int;
  _vendor uuid;
  _rid uuid;
  _it jsonb; _img jsonb;
  _oi public.order_items%ROWTYPE;
  _qty int; _count int := 0; _amount numeric := 0;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO _order FROM public.orders WHERE id = _order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;
  IF _order.customer_id <> _uid THEN RAISE EXCEPTION 'not_order_owner'; END IF;
  IF _order.status <> 'delivered' THEN RAISE EXCEPTION 'order_not_delivered'; END IF;

  SELECT COALESCE(return_window_days, 7) INTO _window FROM public.platform_settings WHERE id = 1;
  _window := COALESCE(_window, 7);
  IF _order.delivered_at IS NULL OR _order.delivered_at < (now() - (_window || ' days')::interval) THEN
    RAISE EXCEPTION 'return_window_expired';
  END IF;

  IF _reason IS NULL OR NOT EXISTS (SELECT 1 FROM public.return_reasons WHERE code = _reason AND is_active) THEN
    RAISE EXCEPTION 'invalid_reason';
  END IF;
  IF _description IS NULL OR length(trim(_description)) < 10 THEN RAISE EXCEPTION 'description_required'; END IF;
  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN RAISE EXCEPTION 'items_required'; END IF;
  IF _images IS NOT NULL AND jsonb_array_length(_images) > 5 THEN RAISE EXCEPTION 'too_many_images'; END IF;

  -- validate items, resolve vendor
  FOR _it IN SELECT * FROM jsonb_array_elements(_items) LOOP
    SELECT * INTO _oi FROM public.order_items
     WHERE id = (_it->>'order_item_id')::uuid AND order_id = _order_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'order_item_not_found'; END IF;

    IF EXISTS (SELECT 1 FROM public.products p WHERE p.id = _oi.product_id
                 AND COALESCE(p.return_policy,'') IN ('non_returnable','no_returns','none')) THEN
      RAISE EXCEPTION 'product_non_returnable';
    END IF;

    _qty := GREATEST(1, COALESCE((_it->>'quantity')::int, 1));
    IF _qty > _oi.quantity THEN RAISE EXCEPTION 'invalid_quantity'; END IF;

    IF _vendor IS NULL THEN _vendor := _oi.vendor_id;
    ELSIF _vendor <> _oi.vendor_id THEN RAISE EXCEPTION 'multiple_vendors_not_allowed'; END IF;

    IF EXISTS (SELECT 1 FROM public.return_items ri JOIN public.returns r ON r.id = ri.return_id
               WHERE ri.order_item_id = _oi.id AND r.status NOT IN ('completed','rejected','cancelled')) THEN
      RAISE EXCEPTION 'duplicate_return_request';
    END IF;

    _count := _count + 1;
    _amount := _amount + (_qty * _oi.price);
  END LOOP;

  IF _vendor IS NULL THEN RAISE EXCEPTION 'no_vendor_for_order'; END IF;

  PERFORM set_config('app.return_actor_role', 'customer', true);
  PERFORM set_config('app.return_note', 'تم إرسال طلب الإرجاع', true);

  INSERT INTO public.returns (order_id, order_item_id, customer_id, vendor_id, reason, notes, description,
                              images, status, return_window_days, refund_amount)
  VALUES (_order_id,
          CASE WHEN _count = 1 THEN ((_items->0)->>'order_item_id')::uuid ELSE NULL END,
          _uid, _vendor, _reason, _customer_note, _description,
          COALESCE((SELECT array_agg(x->>'url') FROM jsonb_array_elements(_images) x), '{}'::text[]),
          'pending_review', _window, _amount)
  RETURNING id INTO _rid;

  FOR _it IN SELECT * FROM jsonb_array_elements(_items) LOOP
    SELECT * INTO _oi FROM public.order_items WHERE id = (_it->>'order_item_id')::uuid;
    _qty := GREATEST(1, COALESCE((_it->>'quantity')::int, 1));
    INSERT INTO public.return_items (return_id, order_item_id, product_id, product_name, product_image,
                                     variant_label, quantity, unit_price, item_note)
    VALUES (_rid, _oi.id, _oi.product_id, _oi.product_name, _oi.product_image, _oi.variant_label,
            _qty, _oi.price, NULLIF(_it->>'note',''));
  END LOOP;

  FOR _img IN SELECT * FROM jsonb_array_elements(COALESCE(_images,'[]'::jsonb)) LOOP
    INSERT INTO public.return_images (return_id, url, kind, uploaded_by, uploader_role)
    VALUES (_rid, _img->>'url', COALESCE(NULLIF(_img->>'kind',''),'product'), _uid, 'customer');
  END LOOP;

  BEGIN
    INSERT INTO public.order_status_history (order_id, status, note, changed_by, changed_by_role)
    VALUES (_order_id, 'return_requested', _description, _uid, 'customer');
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN (SELECT to_jsonb(r) FROM (SELECT id, return_number, status FROM public.returns WHERE id = _rid) r);
END; $$;

-- =============== TRANSITION ===============
CREATE OR REPLACE FUNCTION public.return_transition(
  _return_id uuid, _to_status text, _note text DEFAULT NULL, _payload jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _r public.returns%ROWTYPE;
  _role text;
  _ok boolean := false;
  _img jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO _r FROM public.returns WHERE id = _return_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'return_not_found'; END IF;

  IF _r.customer_id = _uid THEN _role := 'customer';
  ELSIF _r.vendor_id = _uid THEN _role := 'vendor';
  ELSIF public.has_any_admin_role(_uid) THEN _role := 'admin';
  ELSE RAISE EXCEPTION 'not_authorized'; END IF;

  IF _to_status = _r.status THEN RAISE EXCEPTION 'duplicate_status'; END IF;
  IF _r.status IN ('completed','cancelled') AND _role <> 'admin' THEN RAISE EXCEPTION 'return_closed'; END IF;

  _ok := CASE _role
    WHEN 'admin' THEN true
    WHEN 'customer' THEN
      (_to_status = 'cancelled' AND _r.status IN ('pending_review','seller_reviewing','waiting_customer'))
      OR (_to_status = 'pending_review' AND _r.status = 'waiting_customer')
      OR (_to_status = 'customer_shipping' AND _r.status = 'approved')
    WHEN 'vendor' THEN
      (_to_status = 'seller_reviewing' AND _r.status = 'pending_review')
      OR (_to_status IN ('approved','rejected','waiting_customer') AND _r.status IN ('pending_review','seller_reviewing','waiting_customer'))
      OR (_to_status = 'seller_inspecting' AND _r.status = 'customer_shipping')
      OR (_to_status IN ('inspection_passed','inspection_failed') AND _r.status = 'seller_inspecting')
      OR (_to_status = 'completed' AND _r.status IN ('inspection_passed','inspection_failed'))
    ELSE false END;

  IF NOT _ok THEN RAISE EXCEPTION 'invalid_transition'; END IF;

  IF _to_status = 'rejected' AND (_note IS NULL OR length(trim(_note)) < 5) THEN RAISE EXCEPTION 'reason_required'; END IF;
  IF _to_status = 'approved' AND _role <> 'admin' THEN
    IF COALESCE(length(trim(_payload->>'instructions')),0) < 5 THEN RAISE EXCEPTION 'instructions_required'; END IF;
    IF COALESCE(length(trim(_payload->>'address')),0) < 5 THEN RAISE EXCEPTION 'address_required'; END IF;
  END IF;
  IF _to_status = 'waiting_customer' AND (_note IS NULL OR length(trim(_note)) < 5) THEN RAISE EXCEPTION 'reason_required'; END IF;

  PERFORM set_config('app.return_actor_role', _role, true);
  PERFORM set_config('app.return_note', COALESCE(_note, ''), true);

  UPDATE public.returns SET
    status = _to_status,
    last_actor_role = _role,
    review_note = COALESCE(_note, review_note),
    rejection_reason = CASE WHEN _to_status = 'rejected' THEN _note ELSE rejection_reason END,
    return_instructions = COALESCE(NULLIF(_payload->>'instructions',''), return_instructions),
    return_address = COALESCE(NULLIF(_payload->>'address',''), return_address),
    carrier = COALESCE(NULLIF(_payload->>'carrier',''), carrier),
    tracking_number = COALESCE(NULLIF(_payload->>'tracking_number',''), tracking_number),
    arrival_date = COALESCE(NULLIF(_payload->>'arrival_date','')::date, arrival_date),
    resolution_type = COALESCE(NULLIF(_payload->>'resolution_type',''), resolution_type),
    refund_amount = COALESCE(NULLIF(_payload->>'refund_amount','')::numeric, refund_amount),
    admin_note = CASE WHEN _role = 'admin' THEN COALESCE(_note, admin_note) ELSE admin_note END,
    shipped_at = CASE WHEN _to_status = 'customer_shipping' THEN now() ELSE shipped_at END,
    received_at = CASE WHEN _to_status = 'seller_inspecting' THEN now() ELSE received_at END,
    inspection_at = CASE WHEN _to_status IN ('inspection_passed','inspection_failed') THEN now() ELSE inspection_at END,
    inspection_result = CASE WHEN _to_status = 'inspection_passed' THEN COALESCE(NULLIF(_payload->>'inspection_result',''),'accepted')
                             WHEN _to_status = 'inspection_failed' THEN COALESCE(NULLIF(_payload->>'inspection_result',''),'rejected')
                             ELSE inspection_result END,
    inspection_note = CASE WHEN _to_status IN ('inspection_passed','inspection_failed') THEN COALESCE(_note, inspection_note) ELSE inspection_note END,
    resolved_at = CASE WHEN _to_status IN ('rejected','completed','cancelled') THEN now() ELSE resolved_at END,
    closed_at = CASE WHEN _to_status IN ('completed','cancelled','rejected') THEN now() ELSE closed_at END,
    updated_at = now()
  WHERE id = _return_id;

  FOR _img IN SELECT * FROM jsonb_array_elements(COALESCE(_payload->'images','[]'::jsonb)) LOOP
    INSERT INTO public.return_images (return_id, url, kind, uploaded_by, uploader_role)
    VALUES (_return_id, _img->>'url', COALESCE(NULLIF(_img->>'kind',''), CASE WHEN _role='vendor' THEN 'inspection' ELSE 'product' END), _uid, _role);
  END LOOP;
END; $$;

-- =============== CHAT ===============
CREATE OR REPLACE FUNCTION public.return_send_message(_return_id uuid, _body text, _attachments text[] DEFAULT '{}')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _role text := public.return_actor_role(_return_id); _r public.returns%ROWTYPE; _mid uuid; _target uuid;
BEGIN
  IF _role IS NULL THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF (_body IS NULL OR length(trim(_body)) = 0) AND COALESCE(array_length(_attachments,1),0) = 0 THEN
    RAISE EXCEPTION 'empty_message';
  END IF;
  IF length(COALESCE(_body,'')) > 2000 THEN RAISE EXCEPTION 'message_too_long'; END IF;
  IF COALESCE(array_length(_attachments,1),0) > 5 THEN RAISE EXCEPTION 'too_many_attachments'; END IF;

  SELECT * INTO _r FROM public.returns WHERE id = _return_id;

  INSERT INTO public.return_messages (return_id, sender_id, sender_role, body, attachments)
  VALUES (_return_id, auth.uid(), _role, NULLIF(trim(COALESCE(_body,'')),''), COALESCE(_attachments,'{}'))
  RETURNING id INTO _mid;

  FOR _target IN SELECT unnest(ARRAY[_r.customer_id, _r.vendor_id]) LOOP
    IF _target IS DISTINCT FROM auth.uid() THEN
      INSERT INTO public.notifications (user_id, title, message, type, related_id)
      VALUES (_target, 'رسالة جديدة في طلب الإرجاع',
              COALESCE(left(_body, 120), 'تم إرسال مرفقات'), 'return_message', _return_id);
    END IF;
  END LOOP;

  UPDATE public.returns SET updated_at = now() WHERE id = _return_id;
  RETURN _mid;
END; $$;

CREATE OR REPLACE FUNCTION public.return_mark_read(_return_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.return_actor_role(_return_id) IS NULL THEN RAISE EXCEPTION 'not_authorized'; END IF;
  UPDATE public.return_messages SET is_read = true, read_at = now()
   WHERE return_id = _return_id AND sender_id <> auth.uid() AND NOT is_read;
END; $$;

-- =============== IMAGES / NOTES / LOGISTICS ===============
CREATE OR REPLACE FUNCTION public.return_add_images(_return_id uuid, _images jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _role text := public.return_actor_role(_return_id); _img jsonb;
BEGIN
  IF _role IS NULL THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF jsonb_array_length(COALESCE(_images,'[]'::jsonb)) > 10 THEN RAISE EXCEPTION 'too_many_images'; END IF;
  FOR _img IN SELECT * FROM jsonb_array_elements(COALESCE(_images,'[]'::jsonb)) LOOP
    INSERT INTO public.return_images (return_id, url, kind, uploaded_by, uploader_role)
    VALUES (_return_id, _img->>'url',
            COALESCE(NULLIF(_img->>'kind',''), CASE WHEN _role = 'vendor' THEN 'inspection' ELSE 'product' END),
            auth.uid(), _role);
  END LOOP;
  UPDATE public.returns SET updated_at = now() WHERE id = _return_id;
END; $$;

CREATE OR REPLACE FUNCTION public.return_add_note(_return_id uuid, _note text, _is_internal boolean DEFAULT true)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _role text := public.return_actor_role(_return_id); _id uuid;
BEGIN
  IF _role IS NULL THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF _note IS NULL OR length(trim(_note)) < 2 THEN RAISE EXCEPTION 'note_required'; END IF;
  INSERT INTO public.return_notes (return_id, author_id, author_role, note, is_internal)
  VALUES (_return_id, auth.uid(), _role, trim(_note),
          CASE WHEN _role = 'customer' THEN false ELSE COALESCE(_is_internal, true) END)
  RETURNING id INTO _id;
  RETURN _id;
END; $$;

CREATE OR REPLACE FUNCTION public.return_set_logistics(
  _return_id uuid, _carrier text DEFAULT NULL, _tracking_number text DEFAULT NULL,
  _arrival_date date DEFAULT NULL, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _role text := public.return_actor_role(_return_id);
BEGIN
  IF _role IS NULL THEN RAISE EXCEPTION 'not_authorized'; END IF;
  UPDATE public.returns SET
    carrier = COALESCE(NULLIF(trim(COALESCE(_carrier,'')),''), carrier),
    tracking_number = COALESCE(NULLIF(trim(COALESCE(_tracking_number,'')),''), tracking_number),
    arrival_date = COALESCE(_arrival_date, arrival_date),
    updated_at = now()
  WHERE id = _return_id;

  INSERT INTO public.return_notes (return_id, author_id, author_role, note, is_internal)
  VALUES (_return_id, auth.uid(), _role,
          'تحديث بيانات الشحن: ' || COALESCE(_carrier,'-') || ' / ' || COALESCE(_tracking_number,'-')
          || COALESCE(' — ' || _note, ''), false);
END; $$;

-- =============== ADMIN ===============
CREATE OR REPLACE FUNCTION public.admin_assign_return_staff(_return_id uuid, _staff_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_any_admin_role(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF _staff_id IS NOT NULL AND NOT public.has_any_admin_role(_staff_id) THEN RAISE EXCEPTION 'invalid_staff'; END IF;
  UPDATE public.returns SET assigned_staff_id = _staff_id, updated_at = now() WHERE id = _return_id;
  INSERT INTO public.return_notes (return_id, author_id, author_role, note, is_internal)
  VALUES (_return_id, auth.uid(), 'admin',
          CASE WHEN _staff_id IS NULL THEN 'تم إلغاء إسناد الطلب' ELSE 'تم إسناد الطلب لموظف' END, true);
  INSERT INTO public.activity_logs (user_id, action_type, action_details)
  VALUES (auth.uid(), 'return_staff_assigned', jsonb_build_object('return_id', _return_id, 'staff_id', _staff_id));
END; $$;

CREATE OR REPLACE FUNCTION public.admin_resolve_return_dispute(
  _return_id uuid, _decision text, _note text, _ip_address text DEFAULT NULL, _user_agent text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _status text;
BEGIN
  IF NOT public.has_any_admin_role(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF _note IS NULL OR length(trim(_note)) < 5 THEN RAISE EXCEPTION 'reason_required'; END IF;
  _status := CASE _decision
    WHEN 'approve' THEN 'approved' WHEN 'reject' THEN 'rejected'
    WHEN 'complete' THEN 'completed' WHEN 'cancel' THEN 'cancelled'
    ELSE NULL END;
  IF _status IS NULL THEN RAISE EXCEPTION 'invalid_status'; END IF;
  PERFORM public.return_transition(_return_id, _status, 'قرار الإدارة: ' || _note, '{}'::jsonb);
  INSERT INTO public.activity_logs (user_id, action_type, action_details, ip_address, user_agent)
  VALUES (auth.uid(), 'return_dispute_resolved',
          jsonb_build_object('return_id', _return_id, 'decision', _decision, 'note', _note), _ip_address, _user_agent);
END; $$;

-- =============== READ MODELS ===============
CREATE OR REPLACE FUNCTION public.list_returns(
  _scope text DEFAULT 'customer', _status text DEFAULT NULL, _search text DEFAULT NULL,
  _limit int DEFAULT 20, _offset int DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _total int; _rows jsonb; _q text := NULLIF(trim(COALESCE(_search,'')),'');
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _scope = 'admin' AND NOT public.has_any_admin_role(_uid) THEN RAISE EXCEPTION 'not_authorized'; END IF;
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
END; $$;

CREATE OR REPLACE FUNCTION public.return_detail(_return_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _role text := public.return_actor_role(_return_id); _out jsonb;
BEGIN
  IF _role IS NULL THEN RAISE EXCEPTION 'not_authorized'; END IF;
  SELECT jsonb_build_object(
    'role', _role,
    'return', to_jsonb(r) || jsonb_build_object('order_number', o.order_number,
              'customer_name', cp.full_name, 'vendor_name', vp.full_name,
              'reason_label', COALESCE(rr.label_ar, r.reason)),
    'items', COALESCE((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.created_at) FROM public.return_items i WHERE i.return_id = r.id), '[]'::jsonb),
    'images', COALESCE((SELECT jsonb_agg(to_jsonb(im) ORDER BY im.created_at) FROM public.return_images im WHERE im.return_id = r.id), '[]'::jsonb),
    'messages', COALESCE((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.created_at) FROM public.return_messages m WHERE m.return_id = r.id), '[]'::jsonb),
    'notes', COALESCE((SELECT jsonb_agg(to_jsonb(n) ORDER BY n.created_at) FROM public.return_notes n
                        WHERE n.return_id = r.id AND (NOT n.is_internal OR _role IN ('vendor','admin'))), '[]'::jsonb),
    'timeline', COALESCE((SELECT jsonb_agg(to_jsonb(h) ORDER BY h.created_at) FROM public.return_status_history h WHERE h.return_id = r.id), '[]'::jsonb)
  ) INTO _out
  FROM public.returns r
  JOIN public.orders o ON o.id = r.order_id
  LEFT JOIN public.profiles cp ON cp.id = r.customer_id
  LEFT JOIN public.profiles vp ON vp.id = r.vendor_id
  LEFT JOIN public.return_reasons rr ON rr.code = r.reason
  WHERE r.id = _return_id;
  RETURN _out;
END; $$;

CREATE OR REPLACE FUNCTION public.return_reports(
  _from timestamptz DEFAULT (now() - interval '90 days'), _to timestamptz DEFAULT now(), _vendor_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _v uuid := _vendor_id; _orders int; _out jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF public.has_any_admin_role(_uid) THEN
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
    'top_vendors', CASE WHEN public.has_any_admin_role(_uid) THEN COALESCE((SELECT jsonb_agg(x) FROM (
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
END; $$;

-- =============== AUTOMATION (service role / cron) ===============
CREATE OR REPLACE FUNCTION public.returns_run_automation()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _r record; _reminders int := 0; _closed int := 0;
BEGIN
  FOR _r IN SELECT * FROM public.returns
             WHERE status = 'pending_review' AND updated_at < now() - interval '2 days' LOOP
    INSERT INTO public.notifications (user_id, title, message, type, related_id)
    VALUES (_r.vendor_id, 'تذكير: طلب إرجاع بانتظار مراجعتك',
            'طلب الإرجاع ' || _r.return_number || ' ما زال بانتظار قرارك', 'return_reminder', _r.id);
    PERFORM public.return_enqueue_email(_r.vendor_id, 'تذكير بطلب إرجاع', 'طلب إرجاع بانتظار المراجعة',
            'طلب الإرجاع ' || _r.return_number || ' ما زال بانتظار قرارك.', 'return_reminder');
    UPDATE public.returns SET updated_at = now() WHERE id = _r.id;
    _reminders := _reminders + 1;
  END LOOP;

  FOR _r IN SELECT * FROM public.returns
             WHERE status = 'approved' AND updated_at < now() - interval '3 days' LOOP
    INSERT INTO public.notifications (user_id, title, message, type, related_id)
    VALUES (_r.customer_id, 'تذكير: أرسل المنتج المرتجع',
            'تمت الموافقة على طلب الإرجاع ' || _r.return_number || ' — يرجى إرسال المنتج', 'return_reminder', _r.id);
    PERFORM public.return_enqueue_email(_r.customer_id, 'تذكير بإرسال المرتجع', 'أرسل المنتج المرتجع',
            'تمت الموافقة على طلب الإرجاع ' || _r.return_number || ' — يرجى إرسال المنتج.', 'return_reminder');
    UPDATE public.returns SET updated_at = now() WHERE id = _r.id;
    _reminders := _reminders + 1;
  END LOOP;

  FOR _r IN SELECT * FROM public.returns
             WHERE status IN ('inspection_passed','inspection_failed') AND inspection_at < now() - interval '7 days' LOOP
    PERFORM set_config('app.return_actor_role', 'system', true);
    PERFORM set_config('app.return_note', 'إغلاق تلقائي بعد انتهاء مهلة الفحص', true);
    UPDATE public.returns SET status = 'completed', closed_at = now(), resolved_at = now(), updated_at = now()
     WHERE id = _r.id;
    _closed := _closed + 1;
  END LOOP;

  RETURN jsonb_build_object('reminders', _reminders, 'auto_closed', _closed);
END; $$;

-- =============== GRANTS ===============
REVOKE ALL ON FUNCTION public.create_return_request(uuid, text, text, jsonb, jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.return_transition(uuid, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.return_send_message(uuid, text, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.return_mark_read(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.return_add_images(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.return_add_note(uuid, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.return_set_logistics(uuid, text, text, date, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_assign_return_staff(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_resolve_return_dispute(uuid, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_returns(text, text, text, int, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.return_detail(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.return_reports(timestamptz, timestamptz, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.returns_run_automation() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_return_request(uuid, text, text, jsonb, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.return_transition(uuid, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.return_send_message(uuid, text, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.return_mark_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.return_add_images(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.return_add_note(uuid, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.return_set_logistics(uuid, text, text, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_assign_return_staff(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_resolve_return_dispute(uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_returns(text, text, text, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.return_detail(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.return_reports(timestamptz, timestamptz, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.returns_run_automation() TO service_role;