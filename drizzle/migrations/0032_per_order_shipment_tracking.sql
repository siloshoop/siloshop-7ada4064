ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipment_tracking_enabled boolean NOT NULL DEFAULT false;
GRANT SELECT (shipment_tracking_enabled) ON public.orders TO authenticated;

CREATE OR REPLACE FUNCTION public.order_item_tracking_enabled(_item_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.order_items it JOIN public.orders o ON o.id = it.order_id
    WHERE it.id = _item_id AND (
      o.shipment_tracking_enabled
      OR EXISTS (SELECT 1 FROM public.orders c WHERE c.parent_order_id = o.id
                 AND c.vendor_id = it.vendor_id AND c.shipment_tracking_enabled)))
$$;
REVOKE ALL ON FUNCTION public.order_item_tracking_enabled(uuid) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.admin_set_order_shipment_tracking(_order_id uuid, _enabled boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_any_admin_role(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.orders WHERE id = _order_id) THEN RAISE EXCEPTION 'order_not_found'; END IF;
  -- Only the tracking visibility flag changes; order status stays untouched.
  UPDATE public.orders SET shipment_tracking_enabled = _enabled, updated_at = now()
   WHERE id = _order_id OR parent_order_id = _order_id;
  INSERT INTO public.activity_logs (user_id, action_type, action_details)
  VALUES (auth.uid(), 'order_shipment_tracking', jsonb_build_object('order_id', _order_id, 'enabled', _enabled));
END $$;
REVOKE ALL ON FUNCTION public.admin_set_order_shipment_tracking(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_order_shipment_tracking(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_order_items_tracking(_order_id uuid)
RETURNS TABLE(id uuid, product_name text, vendor_id uuid, tracking_status text, tracking_number text, shipping_carrier text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_any_admin_role(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  RETURN QUERY SELECT it.id, it.product_name, it.vendor_id, it.tracking_status, it.tracking_number, it.shipping_carrier
    FROM public.order_items it
   WHERE it.order_id = _order_id
      OR it.order_id = (SELECT parent_order_id FROM public.orders WHERE id = _order_id)
         AND it.vendor_id = (SELECT vendor_id FROM public.orders WHERE id = _order_id)
   ORDER BY it.created_at;
END $$;
REVOKE ALL ON FUNCTION public.admin_order_items_tracking(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_order_items_tracking(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_order_item_tracking(_item_id uuid, _status text, _tracking_number text DEFAULT NULL::text, _carrier text DEFAULT NULL::text, _note text DEFAULT NULL::text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE it public.order_items%ROWTYPE; uid uuid := auth.uid(); t text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF NOT public.has_any_admin_role(uid) THEN RAISE EXCEPTION 'NOT_ALLOWED'; END IF;
  SELECT * INTO it FROM public.order_items WHERE id = _item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ITEM_NOT_FOUND'; END IF;
  IF NOT public.order_item_tracking_enabled(_item_id) THEN RAISE EXCEPTION 'SHIPPING_DISABLED'; END IF;
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