CREATE OR REPLACE FUNCTION public.cancel_order(_order_id uuid, _reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _order public.orders%ROWTYPE;
  _is_customer boolean;
  _is_vendor boolean;
  _is_admin boolean;
  _actor_role text;
  _item record;
  _pay record;
  _vendor_ids uuid[];
  _v uuid;
  _cancellable text[] := ARRAY['pending','confirmed','processing','preparing'];
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _reason IS NULL OR length(trim(_reason)) = 0 THEN
    RAISE EXCEPTION 'Cancellation reason is required';
  END IF;

  SELECT * INTO _order FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  _is_customer := (_order.customer_id = _uid);
  SELECT EXISTS (
    SELECT 1 FROM public.order_items WHERE order_id = _order_id AND vendor_id = _uid
  ) INTO _is_vendor;
  SELECT public.has_role(_uid, 'admin') INTO _is_admin;

  IF NOT (_is_customer OR _is_vendor OR _is_admin) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF _order.status = 'cancelled' THEN
    RAISE EXCEPTION 'Order already cancelled';
  END IF;

  -- Cancellation window: pending / confirmed / preparing only.
  -- Both the order status and the tracking status must still be inside the window.
  IF NOT (lower(coalesce(_order.status,'pending')) = ANY (_cancellable))
     OR (_order.tracking_status IS NOT NULL
         AND NOT (lower(_order.tracking_status) = ANY (_cancellable))) THEN
    RAISE EXCEPTION 'Order can no longer be cancelled at this stage';
  END IF;

  -- Restore stock
  FOR _item IN
    SELECT product_id, quantity FROM public.order_items WHERE order_id = _order_id
  LOOP
    UPDATE public.products
       SET stock_quantity = COALESCE(stock_quantity, 0) + _item.quantity,
           updated_at = now()
     WHERE id = _item.product_id;
  END LOOP;

  _actor_role := CASE
    WHEN _is_admin THEN 'admin'
    WHEN _is_customer THEN 'buyer'
    ELSE 'seller'
  END;

  -- Update payments: cash -> cancelled; anything else -> refund_pending
  FOR _pay IN
    SELECT id, payment_method, payment_status FROM public.payments WHERE order_id = _order_id
  LOOP
    IF _pay.payment_method = 'cash' THEN
      UPDATE public.payments
         SET payment_status = 'cancelled', updated_at = now()
       WHERE id = _pay.id;
    ELSIF _pay.payment_status = 'completed' THEN
      UPDATE public.payments
         SET payment_status = 'refund_pending', updated_at = now()
       WHERE id = _pay.id;
    ELSE
      UPDATE public.payments
         SET payment_status = 'cancelled', updated_at = now()
       WHERE id = _pay.id;
    END IF;
  END LOOP;

  UPDATE public.orders
     SET status = 'cancelled',
         cancellation_reason = _reason,
         cancelled_at = now(),
         cancelled_by = _uid,
         cancelled_by_role = _actor_role,
         payment_status = CASE
           WHEN EXISTS (
             SELECT 1 FROM public.payments
              WHERE order_id = _order_id AND payment_status = 'refund_pending'
           ) THEN 'refund_pending'
           ELSE 'cancelled'
         END,
         updated_at = now()
   WHERE id = _order_id;

  BEGIN
    INSERT INTO public.order_status_history (order_id, status, notes)
    VALUES (_order_id, 'cancelled', _reason);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  INSERT INTO public.notifications (user_id, title, message, type, related_id)
  VALUES (
    _order.customer_id,
    'تم إلغاء الطلب',
    CASE WHEN _actor_role = 'buyer'
      THEN 'تم إلغاء طلبك بنجاح. السبب: ' || _reason
      ELSE 'تم إلغاء طلبك من قبل ' || _actor_role || '. السبب: ' || _reason
    END,
    'order_cancelled',
    _order_id
  );

  SELECT array_agg(DISTINCT vendor_id) INTO _vendor_ids
    FROM public.order_items WHERE order_id = _order_id;

  IF _vendor_ids IS NOT NULL THEN
    FOREACH _v IN ARRAY _vendor_ids LOOP
      IF _v IS NOT NULL AND _v <> _uid THEN
        INSERT INTO public.notifications (user_id, title, message, type, related_id)
        VALUES (
          _v,
          'إلغاء طلب',
          'تم إلغاء الطلب #' || substr(_order_id::text, 1, 8) || '. السبب: ' || _reason,
          'order_cancelled',
          _order_id
        );
      END IF;
    END LOOP;
  END IF;
END;
$function$;