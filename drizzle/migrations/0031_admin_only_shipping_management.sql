CREATE OR REPLACE FUNCTION public.update_order_item_tracking(_item_id uuid, _status text, _tracking_number text DEFAULT NULL::text, _carrier text DEFAULT NULL::text, _note text DEFAULT NULL::text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE it public.order_items%ROWTYPE; uid uuid := auth.uid(); t text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF NOT public.has_any_admin_role(uid) THEN RAISE EXCEPTION 'NOT_ALLOWED'; END IF;
  IF NOT public.is_feature_enabled('shipping_management') THEN RAISE EXCEPTION 'SHIPPING_DISABLED'; END IF;
  SELECT * INTO it FROM public.order_items WHERE id = _item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ITEM_NOT_FOUND'; END IF;
  IF length(coalesce(_tracking_number,'')) > 100 OR length(coalesce(_carrier,'')) > 100 OR length(coalesce(_note,'')) > 500 THEN
    RAISE EXCEPTION 'INVALID_INPUT'; END IF;
  t := public.normalize_order_status(_status);
  IF t <> public.normalize_order_status(it.tracking_status) THEN
    IF NOT public.order_status_can_transition(it.tracking_status, t, 'admin') THEN
      RAISE EXCEPTION 'INVALID_STATUS_TRANSITION'; END IF;
  END IF;
  UPDATE public.order_items SET
    tracking_status = t,
    tracking_number = COALESCE(NULLIF(trim(_tracking_number),''), tracking_number),
    shipping_carrier = COALESCE(NULLIF(trim(_carrier),''), shipping_carrier),
    tracking_updated_at = now()
  WHERE id = _item_id;
  INSERT INTO public.order_item_status_history(order_item_id, status, note, tracking_number, changed_by)
  VALUES (_item_id, t, NULLIF(trim(_note),''), NULLIF(trim(_tracking_number),''), uid);
END $function$;

CREATE OR REPLACE FUNCTION public.update_order_shipping(_order_id uuid, _shipping_company text DEFAULT NULL::text, _tracking_number text DEFAULT NULL::text, _estimated_delivery timestamp with time zone DEFAULT NULL::timestamp with time zone, _shipping_notes text DEFAULT NULL::text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _o public.orders%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.has_any_admin_role(_uid) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF NOT public.is_feature_enabled('shipping_management') THEN RAISE EXCEPTION 'shipping_disabled'; END IF;
  SELECT * INTO _o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;
  UPDATE public.orders
     SET courier_name = COALESCE(NULLIF(trim(COALESCE(_shipping_company,'')),''), courier_name),
         tracking_number = COALESCE(NULLIF(trim(COALESCE(_tracking_number,'')),''), tracking_number),
         estimated_delivery = COALESCE(_estimated_delivery, estimated_delivery),
         shipping_notes = COALESCE(NULLIF(trim(COALESCE(_shipping_notes,'')),''), shipping_notes),
         updated_at = now()
   WHERE id = _order_id;
  INSERT INTO public.tracking_history (order_id, status, description, actor_role)
  VALUES (_order_id, public.normalize_order_status(_o.status),
          'تحديث معلومات الشحن' ||
          COALESCE(': ' || NULLIF(trim(COALESCE(_shipping_company,'')),''), '') ||
          COALESCE(' - ' || NULLIF(trim(COALESCE(_tracking_number,'')),''), ''), 'admin');
  INSERT INTO public.notifications (user_id, title, message, type, related_id)
  VALUES (_o.customer_id, 'تحديث معلومات الشحن',
          'تم تحديث معلومات شحن طلبك ' || COALESCE(_o.order_number, substr(_order_id::text,1,8)),
          'order_status', COALESCE(_o.parent_order_id, _order_id));
  INSERT INTO public.activity_logs (user_id, action_type, action_details)
  VALUES (_uid, 'order_shipping_update',
          jsonb_build_object('order_id', _order_id, 'company', _shipping_company,
                             'tracking', _tracking_number, 'eta', _estimated_delivery));
END;
$function$;

DROP POLICY IF EXISTS tracking_history_participants_read ON public.tracking_history;
CREATE POLICY tracking_history_participants_read ON public.tracking_history FOR SELECT TO authenticated
USING (public.has_any_admin_role(auth.uid()) OR (public.is_feature_enabled('shipping_management') AND (
  EXISTS (SELECT 1 FROM public.orders o WHERE o.id = tracking_history.order_id AND o.customer_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = tracking_history.order_id AND oi.vendor_id = auth.uid()))));

DROP POLICY IF EXISTS "Item history visible to buyer, seller, admin" ON public.order_item_status_history;
CREATE POLICY "Item history visible to buyer, seller, admin" ON public.order_item_status_history FOR SELECT TO authenticated
USING (public.has_any_admin_role(auth.uid()) OR (public.is_feature_enabled('shipping_management') AND EXISTS (
  SELECT 1 FROM public.order_items oi JOIN public.orders o ON o.id = oi.order_id
  WHERE oi.id = order_item_status_history.order_item_id AND (o.customer_id = auth.uid() OR oi.vendor_id = auth.uid()))));