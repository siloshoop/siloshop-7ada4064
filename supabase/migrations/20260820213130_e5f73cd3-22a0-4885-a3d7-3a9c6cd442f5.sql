CREATE OR REPLACE FUNCTION public.track_order_public(_order_id uuid, _phone text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_hash text;
  v_attempts int;
  v_order public.orders%ROWTYPE;
  v_history jsonb;
  v_events jsonb;
  v_ship record;
  v_phone text;
BEGIN
  v_phone := regexp_replace(coalesce(_phone, ''), '[^0-9]', '', 'g');
  IF _order_id IS NULL OR length(v_phone) < 6 THEN
    RETURN jsonb_build_object('error', 'invalid_input');
  END IF;

  v_hash := encode(extensions.digest(v_phone || '|' || _order_id::text, 'sha256'), 'hex');

  DELETE FROM public.order_track_rate_limits WHERE created_at < now() - interval '1 day';

  SELECT count(*) INTO v_attempts
  FROM public.order_track_rate_limits
  WHERE client_hash = v_hash AND created_at > now() - interval '1 hour';

  IF v_attempts >= 10 THEN
    RETURN jsonb_build_object('error', 'rate_limited');
  END IF;

  INSERT INTO public.order_track_rate_limits (client_hash) VALUES (v_hash);

  SELECT * INTO v_order FROM public.orders WHERE id = _order_id;

  IF NOT FOUND OR regexp_replace(coalesce(v_order.phone, ''), '[^0-9]', '', 'g') <> v_phone THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'status', h.status,
           'notes', h.notes,
           'created_at', h.created_at
         ) ORDER BY h.created_at), '[]'::jsonb)
  INTO v_history
  FROM public.order_status_history h
  WHERE h.order_id = v_order.id;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'status', t.status,
           'description', t.description,
           'actor_role', t.actor_role,
           'created_at', t.created_at
         ) ORDER BY t.created_at), '[]'::jsonb)
  INTO v_events
  FROM public.tracking_history t
  WHERE t.order_id = v_order.id;

  SELECT shipping_company, tracking_number, estimated_delivery, shipped_at, delivered_at, shipping_notes
    INTO v_ship
  FROM public.shipping_details WHERE order_id = v_order.id;

  RETURN jsonb_build_object(
    'id', v_order.id,
    'order_number', v_order.order_number,
    'invoice_number', v_order.invoice_number,
    'created_at', v_order.created_at,
    'updated_at', v_order.updated_at,
    'status', public.normalize_order_status(v_order.status),
    'tracking_status', v_order.tracking_status,
    'payment_method', v_order.payment_method,
    'payment_status', v_order.payment_status,
    'courier_name', coalesce(v_ship.shipping_company, v_order.courier_name),
    'tracking_number', coalesce(v_ship.tracking_number, v_order.tracking_number),
    'estimated_delivery', coalesce(v_ship.estimated_delivery, v_order.estimated_delivery),
    'shipped_at', coalesce(v_ship.shipped_at, v_order.shipped_at),
    'shipping_notes', coalesce(v_ship.shipping_notes, v_order.shipping_notes),
    'delivered_at', coalesce(v_ship.delivered_at, v_order.delivered_at),
    'cancelled_at', v_order.cancelled_at,
    'cancellation_reason', v_order.cancellation_reason,
    'subtotal_amount', v_order.subtotal_amount,
    'shipping_amount', v_order.shipping_amount,
    'tax_amount', v_order.tax_amount,
    'discount_amount', v_order.discount_amount,
    'total_amount', v_order.total_amount,
    'governorate', v_order.shipping_address,
    'items', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
               'product_name', oi.product_name,
               'product_image', oi.product_image,
               'variant_label', oi.variant_label,
               'quantity', oi.quantity
             )), '[]'::jsonb)
      FROM public.order_items oi WHERE oi.order_id = v_order.id
    ),
    'events', v_events,
    'history', v_history
  );
END;
$function$;