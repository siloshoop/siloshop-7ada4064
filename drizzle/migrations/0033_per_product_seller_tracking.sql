CREATE OR REPLACE FUNCTION public.order_item_tracking_can_transition(_from text, _to text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT CASE public.normalize_order_status(_from)
    WHEN 'pending' THEN _to = 'confirmed'
    WHEN 'confirmed' THEN _to = 'preparing'
    WHEN 'preparing' THEN _to = 'ready_for_shipping'
    WHEN 'ready_for_shipping' THEN _to = 'out_for_delivery'
    WHEN 'out_for_delivery' THEN _to = 'shipped'
    WHEN 'shipped' THEN _to = 'delivered'
    ELSE false END
$$;

CREATE OR REPLACE FUNCTION public.update_order_item_tracking(_item_id uuid, _status text, _tracking_number text DEFAULT NULL::text, _carrier text DEFAULT NULL::text, _note text DEFAULT NULL::text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE it public.order_items%ROWTYPE; uid uuid := auth.uid(); t text; is_admin boolean;
  cust uuid; frozen boolean; tn text := NULLIF(trim(_tracking_number),''); cr text := NULLIF(trim(_carrier),'');
  changed boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  is_admin := public.has_any_admin_role(uid);
  SELECT * INTO it FROM public.order_items WHERE id = _item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ITEM_NOT_FOUND'; END IF;
  -- Sellers may update only their own products.
  IF NOT is_admin AND it.vendor_id IS DISTINCT FROM uid THEN RAISE EXCEPTION 'NOT_ALLOWED'; END IF;
  SELECT o.customer_id, o.is_frozen OR EXISTS (SELECT 1 FROM public.orders c WHERE c.parent_order_id = o.id AND c.vendor_id = it.vendor_id AND c.is_frozen)
    INTO cust, frozen FROM public.orders o WHERE o.id = it.order_id;
  IF frozen AND NOT is_admin THEN RAISE EXCEPTION 'order_frozen'; END IF;
  IF length(coalesce(tn,'')) > 100 OR length(coalesce(cr,'')) > 100 OR length(coalesce(_note,'')) > 500 THEN
    RAISE EXCEPTION 'INVALID_INPUT'; END IF;
  t := public.normalize_order_status(_status);
  changed := t <> public.normalize_order_status(it.tracking_status);
  IF changed AND NOT public.order_item_tracking_can_transition(it.tracking_status, t) THEN
    RAISE EXCEPTION 'INVALID_STATUS_TRANSITION'; END IF;
  IF NOT changed AND tn IS NOT DISTINCT FROM it.tracking_number AND (cr IS NULL OR cr = it.shipping_carrier) THEN
    RETURN; -- Repeated/simultaneous identical request: nothing to save or notify.
  END IF;
  IF NOT changed AND tn IS NULL AND cr IS NULL THEN RETURN; END IF;
  UPDATE public.order_items SET tracking_status = t,
    tracking_number = COALESCE(tn, tracking_number), shipping_carrier = COALESCE(cr, shipping_carrier),
    tracking_updated_at = now()
  WHERE id = _item_id;
  INSERT INTO public.order_item_status_history(order_item_id, status, note, tracking_number, changed_by)
  VALUES (_item_id, t, NULLIF(trim(_note),''), tn, uid);
  -- One notification per actual stage change, only when tracking is visible to the buyer.
  IF changed AND cust IS NOT NULL AND public.order_item_tracking_enabled(_item_id) THEN
    INSERT INTO public.notifications(user_id, title, message, type, related_id)
    VALUES (cust, 'تحديث تتبع المنتج',
      coalesce(it.product_name, 'منتج') || ': ' || CASE t
        WHEN 'confirmed' THEN 'تم تأكيد الطلب' WHEN 'preparing' THEN 'بدء التحضير'
        WHEN 'ready_for_shipping' THEN 'جاهز للشحن' WHEN 'out_for_delivery' THEN 'تم تسليم الطلب إلى مركز الشحن'
        WHEN 'shipped' THEN 'تم الشحن' WHEN 'delivered' THEN 'تم الاستلام' ELSE t END,
      'order_status', it.order_id);
  END IF;
END $function$;

DROP POLICY IF EXISTS "Item history visible to buyer, seller, admin" ON public.order_item_status_history;
CREATE POLICY "Item history visible to buyer, seller, admin" ON public.order_item_status_history
FOR SELECT TO authenticated USING (
  public.has_any_admin_role(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.order_items oi JOIN public.orders o ON o.id = oi.order_id
    WHERE oi.id = order_item_status_history.order_item_id AND (
      oi.vendor_id = auth.uid()
      OR (o.customer_id = auth.uid() AND public.order_item_tracking_enabled(oi.id)))));

ALTER PUBLICATION supabase_realtime ADD TABLE public.order_item_status_history;