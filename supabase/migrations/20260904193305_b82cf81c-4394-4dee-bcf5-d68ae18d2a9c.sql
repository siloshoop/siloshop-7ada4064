ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS stock_applied boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS stock_restored boolean NOT NULL DEFAULT false;

-- Never allow negative stock anywhere
CREATE OR REPLACE FUNCTION public.guard_non_negative_stock()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $fn$
BEGIN
  IF NEW.stock_quantity IS NOT NULL AND NEW.stock_quantity < 0 THEN
    RAISE EXCEPTION 'NEGATIVE_STOCK';
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_guard_non_negative_stock ON public.products;
CREATE TRIGGER trg_guard_non_negative_stock
BEFORE INSERT OR UPDATE OF stock_quantity ON public.products
FOR EACH ROW EXECUTE FUNCTION public.guard_non_negative_stock();

DROP TRIGGER IF EXISTS trg_guard_non_negative_stock_variants ON public.product_variants;
CREATE TRIGGER trg_guard_non_negative_stock_variants
BEFORE INSERT OR UPDATE OF stock_quantity ON public.product_variants
FOR EACH ROW EXECUTE FUNCTION public.guard_non_negative_stock();

-- Idempotent stock restoration (per order_items row, optionally scoped to one vendor)
CREATE OR REPLACE FUNCTION public.restore_order_stock(_order_id uuid, _vendor_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE _it record;
BEGIN
  PERFORM set_config('app.stock_reason', 'return', true);

  FOR _it IN
    SELECT oi.id, oi.product_id, oi.variant_id, oi.quantity
      FROM public.order_items oi
     WHERE oi.order_id = _order_id
       AND oi.stock_applied = true
       AND oi.stock_restored = false
       AND (_vendor_id IS NULL OR oi.vendor_id = _vendor_id)
     ORDER BY oi.id
     FOR UPDATE
  LOOP
    IF _it.variant_id IS NOT NULL THEN
      UPDATE public.product_variants
         SET stock_quantity = GREATEST(COALESCE(stock_quantity, 0), 0) + _it.quantity,
             updated_at = now()
       WHERE id = _it.variant_id;
    END IF;

    UPDATE public.products
       SET stock_quantity = GREATEST(COALESCE(stock_quantity, 0), 0) + _it.quantity,
           updated_at = now()
     WHERE id = _it.product_id;

    UPDATE public.order_items SET stock_restored = true WHERE id = _it.id;
  END LOOP;

  PERFORM set_config('app.stock_reason', '', true);
END;
$fn$;

REVOKE ALL ON FUNCTION public.restore_order_stock(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.restore_order_stock(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.restore_order_stock(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.restore_order_stock(uuid, uuid) TO service_role;

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
  _pay record;
  _vendor_ids uuid[];
  _v uuid;
  _items_order uuid;
  _vendor_scope uuid;
  _child record;
  _cancellable text[] := ARRAY['pending','confirmed','processing','preparing'];
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _reason IS NULL OR length(trim(_reason)) = 0 THEN
    RAISE EXCEPTION 'Cancellation reason is required';
  END IF;

  SELECT * INTO _order FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  _is_customer := (_order.customer_id = _uid);
  _is_vendor := public.is_order_vendor(_order_id, _uid);
  SELECT public.has_any_admin_role(_uid) INTO _is_admin;

  IF NOT (_is_customer OR _is_vendor OR _is_admin) THEN RAISE EXCEPTION 'Forbidden'; END IF;

  IF public.normalize_order_status(_order.status) = 'cancelled' THEN
    RAISE EXCEPTION 'Order already cancelled';
  END IF;

  IF NOT (lower(coalesce(_order.status,'pending')) = ANY (_cancellable))
     OR (_order.tracking_status IS NOT NULL
         AND NOT (lower(_order.tracking_status) = ANY (_cancellable))) THEN
    RAISE EXCEPTION 'Order can no longer be cancelled at this stage';
  END IF;

  _items_order := COALESCE(_order.parent_order_id, _order_id);
  -- a seller cancelling their own sub-order only restores their own items
  _vendor_scope := CASE WHEN _order.vendor_id IS NOT NULL THEN _order.vendor_id ELSE NULL END;

  -- idempotent: an item's stock is returned at most once
  PERFORM public.restore_order_stock(_items_order, _vendor_scope);

  _actor_role := CASE
    WHEN _is_admin THEN 'admin'
    WHEN _is_customer THEN 'buyer'
    ELSE 'seller'
  END;

  IF _order.parent_order_id IS NULL THEN
    FOR _pay IN
      SELECT id, payment_method, payment_status FROM public.payments WHERE order_id = _order_id
    LOOP
      IF _pay.payment_method = 'cash' THEN
        UPDATE public.payments SET payment_status = 'cancelled', updated_at = now() WHERE id = _pay.id;
      ELSIF _pay.payment_status = 'completed' THEN
        UPDATE public.payments SET payment_status = 'refund_pending', updated_at = now() WHERE id = _pay.id;
      ELSE
        UPDATE public.payments SET payment_status = 'cancelled', updated_at = now() WHERE id = _pay.id;
      END IF;
    END LOOP;
  END IF;

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

  -- cancelling the whole (parent) order cancels every seller sub-order
  IF _order.parent_order_id IS NULL THEN
    FOR _child IN
      SELECT id FROM public.orders
       WHERE parent_order_id = _order_id
         AND public.normalize_order_status(status) <> 'cancelled'
    LOOP
      UPDATE public.orders
         SET status = 'cancelled', cancellation_reason = _reason, cancelled_at = now(),
             cancelled_by = _uid, cancelled_by_role = _actor_role,
             payment_status = 'cancelled', updated_at = now()
       WHERE id = _child.id;
    END LOOP;
  END IF;

  BEGIN
    INSERT INTO public.order_status_history (order_id, status, notes)
    VALUES (_order_id, 'cancelled', _reason);
  EXCEPTION WHEN OTHERS THEN NULL;
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
    COALESCE(_order.parent_order_id, _order_id)
  );

  SELECT array_agg(DISTINCT vendor_id) INTO _vendor_ids
    FROM public.order_items
   WHERE order_id = _items_order
     AND (_vendor_scope IS NULL OR vendor_id = _vendor_scope);

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

CREATE OR REPLACE FUNCTION public.admin_cancel_order(_order_id uuid, _reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _o public.orders%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF _reason IS NULL OR length(trim(_reason)) = 0 THEN RAISE EXCEPTION 'reason_required'; END IF;

  SELECT * INTO _o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;
  IF _o.status IN ('delivered','cancelled') THEN RAISE EXCEPTION 'order_not_cancellable'; END IF;

  PERFORM public.restore_order_stock(COALESCE(_o.parent_order_id, _order_id), _o.vendor_id);

  UPDATE public.orders
     SET status = 'cancelled',
         cancellation_reason = _reason,
         cancelled_at = now(),
         cancelled_by = auth.uid(),
         cancelled_by_role = 'admin',
         updated_at = now()
   WHERE id = _order_id;

  INSERT INTO public.order_status_history (order_id, status, notes)
  VALUES (_order_id, 'cancelled', _reason);

  INSERT INTO public.notifications (user_id, title, message, type, related_id)
  VALUES (_o.customer_id, 'تم إلغاء طلبك من قبل الإدارة',
          'السبب: ' || _reason, 'order_cancelled', _order_id);
END;
$function$;

-- Backfill: items of already-cancelled orders had their stock returned before
UPDATE public.order_items oi
   SET stock_restored = true
  FROM public.orders o
 WHERE o.id = oi.order_id
   AND oi.stock_restored = false
   AND lower(COALESCE(o.status, '')) IN ('cancelled', 'canceled', 'refunded');