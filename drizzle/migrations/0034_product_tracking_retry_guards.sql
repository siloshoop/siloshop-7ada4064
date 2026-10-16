CREATE OR REPLACE FUNCTION public.update_order_item_tracking(_item_id uuid, _status text, _tracking_number text DEFAULT NULL::text, _carrier text DEFAULT NULL::text, _note text DEFAULT NULL::text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE it public.order_items%ROWTYPE; uid uuid := auth.uid(); t text; is_admin boolean;
  cust uuid; frozen boolean; closed boolean; tn text := NULLIF(trim(_tracking_number),''); cr text := NULLIF(trim(_carrier),''); changed boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  is_admin := public.has_any_admin_role(uid);
  SELECT * INTO it FROM public.order_items WHERE id = _item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ITEM_NOT_FOUND'; END IF;
  IF NOT is_admin AND it.vendor_id IS DISTINCT FROM uid THEN RAISE EXCEPTION 'NOT_ALLOWED'; END IF;
  SELECT o.customer_id, o.is_frozen OR EXISTS (SELECT 1 FROM public.orders c WHERE c.parent_order_id = o.id AND c.vendor_id = it.vendor_id AND c.is_frozen),
    o.status IN ('cancelled','returned','refunded') OR EXISTS (SELECT 1 FROM public.orders c WHERE c.parent_order_id = o.id AND c.vendor_id = it.vendor_id AND c.status IN ('cancelled','returned','refunded'))
    INTO cust, frozen, closed FROM public.orders o WHERE o.id = it.order_id;
  IF frozen AND NOT is_admin THEN RAISE EXCEPTION 'order_frozen'; END IF;
  IF closed THEN RAISE EXCEPTION 'TRACKING_ORDER_CLOSED'; END IF;
  IF length(coalesce(tn,'')) > 100 OR length(coalesce(cr,'')) > 100 OR length(coalesce(_note,'')) > 500 THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
  t := public.normalize_order_status(_status);
  IF t NOT IN ('pending','confirmed','preparing','ready_for_shipping','out_for_delivery','shipped','delivered','completed','cancelled','return_requested','returning','returned','refunded') THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
  changed := t <> public.normalize_order_status(it.tracking_status);
  IF changed AND NOT public.order_item_tracking_can_transition(it.tracking_status, t) THEN RAISE EXCEPTION 'INVALID_STATUS_TRANSITION'; END IF;
  IF NOT changed AND COALESCE(tn,it.tracking_number) IS NOT DISTINCT FROM it.tracking_number AND COALESCE(cr,it.shipping_carrier) IS NOT DISTINCT FROM it.shipping_carrier THEN RETURN; END IF;
  UPDATE public.order_items SET tracking_status = t, tracking_number = COALESCE(tn, tracking_number), shipping_carrier = COALESCE(cr, shipping_carrier), tracking_updated_at = clock_timestamp() WHERE id = _item_id;
  INSERT INTO public.order_item_status_history(order_item_id, status, note, tracking_number, changed_by)
  VALUES (_item_id, t, NULLIF(trim(_note),''), COALESCE(tn,it.tracking_number), uid);
  IF changed AND cust IS NOT NULL AND public.order_item_tracking_enabled(_item_id) THEN
    INSERT INTO public.notifications(user_id, title, message, type, related_id)
    VALUES (cust, 'تحديث تتبع المنتج', 'حالة المنتج: ' || CASE t
      WHEN 'confirmed' THEN 'تم تأكيد الطلب' WHEN 'preparing' THEN 'بدء التحضير'
      WHEN 'ready_for_shipping' THEN 'جاهز للشحن' WHEN 'out_for_delivery' THEN 'تم تسليم الطلب إلى مركز الشحن'
      WHEN 'shipped' THEN 'تم الشحن' WHEN 'delivered' THEN 'تم الاستلام' ELSE 'تم تحديث التتبع' END,
      'order_status', it.order_id);
  END IF;
END $function$;
REVOKE ALL ON FUNCTION public.order_item_tracking_can_transition(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.order_item_tracking_can_transition(text,text) TO authenticated, service_role;