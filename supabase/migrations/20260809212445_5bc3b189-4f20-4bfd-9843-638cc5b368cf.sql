-- 1. Precise reason detection for stock movements via session setting
CREATE OR REPLACE FUNCTION public.log_stock_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason text;
  v_delta integer;
BEGIN
  IF COALESCE(NEW.stock_quantity, 0) = COALESCE(OLD.stock_quantity, 0) THEN
    RETURN NEW;
  END IF;

  v_delta := COALESCE(NEW.stock_quantity, 0) - COALESCE(OLD.stock_quantity, 0);
  v_reason := NULLIF(current_setting('app.stock_reason', true), '');

  IF v_reason IS NULL THEN
    IF auth.uid() IS NULL THEN
      v_reason := 'system';
    ELSIF auth.uid() <> NEW.vendor_id THEN
      v_reason := 'admin_adjustment';
    ELSE
      v_reason := 'manual';
    END IF;
  END IF;

  INSERT INTO public.stock_movements (product_id, vendor_id, quantity_before, quantity_after, delta, reason, performed_by)
  VALUES (NEW.id, NEW.vendor_id, OLD.stock_quantity, NEW.stock_quantity, v_delta, v_reason, auth.uid());

  RETURN NEW;
END;
$$;

-- 2. create_order: stock validation + decrement + anti-abuse rate limits
CREATE OR REPLACE FUNCTION public.create_order(_items jsonb, _phone text, _shipping_address text, _notes text DEFAULT NULL::text, _coupon_code text DEFAULT NULL::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _subtotal numeric := 0;
  _shipping numeric := 0;
  _discount numeric := 0;
  _total numeric := 0;
  _order_id uuid;
  _coupon_id uuid;
  _coupon_amount numeric := 0;
  _coupon_code_final text := NULL;
  _item jsonb;
  _product record;
  _qty int;
  _kind text := NULL;
  _row_kind text;
  _pay_method text;
  _txn_prefix text;
  _recent int;
  _open int;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'Cart is empty';
  END IF;

  -- Anti-abuse: fake / spam order protection
  SELECT count(*) INTO _recent
    FROM public.orders
   WHERE customer_id = _uid AND created_at > now() - interval '1 hour';
  IF _recent >= 5 THEN
    RAISE EXCEPTION 'ORDER_RATE_LIMIT';
  END IF;

  SELECT count(*) INTO _open
    FROM public.orders
   WHERE customer_id = _uid AND status IN ('pending','confirmed','processing');
  IF _open >= 10 THEN
    RAISE EXCEPTION 'TOO_MANY_OPEN_ORDERS';
  END IF;

  -- Validate items and lock product rows to prevent overselling
  FOR _item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    _qty := COALESCE((_item->>'quantity')::int, 0);
    IF _qty <= 0 THEN
      RAISE EXCEPTION 'Invalid quantity';
    END IF;
    SELECT p.id, p.price, p.vendor_id, COALESCE(p.shipping_cost, 0) AS shipping_cost,
           COALESCE(p.is_active, false) AS is_active, p.moderation_status, p.product_type,
           COALESCE(p.stock_quantity, 0) AS stock_quantity, p.name
      INTO _product
      FROM public.products p
     WHERE p.id = (_item->>'product_id')::uuid
     FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product not found';
    END IF;
    IF _product.is_active IS NOT TRUE OR _product.moderation_status <> 'approved' THEN
      RAISE EXCEPTION 'Product unavailable';
    END IF;
    IF _product.stock_quantity < _qty THEN
      RAISE EXCEPTION 'OUT_OF_STOCK:%', _product.name;
    END IF;
    _row_kind := CASE WHEN _product.product_type = 'platform' THEN 'platform' ELSE 'seller' END;
    IF _row_kind = 'platform' AND NOT public.is_feature_enabled('platform_marketplace') THEN
      RAISE EXCEPTION 'PLATFORM_MARKETPLACE_DISABLED';
    END IF;
    IF _kind IS NULL THEN
      _kind := _row_kind;
    ELSIF _kind <> _row_kind THEN
      RAISE EXCEPTION 'MIXED_CART';
    END IF;
    _subtotal := _subtotal + (_product.price * _qty);
    _shipping := _shipping + _product.shipping_cost;
  END LOOP;

  IF _kind = 'platform' THEN
    IF NOT public.is_feature_enabled('sham_cash_payments') THEN
      RAISE EXCEPTION 'SHAM_CASH_DISABLED';
    END IF;
    _pay_method := 'sham_cash';
    _txn_prefix := 'SHAM-';
  ELSE
    _pay_method := 'cod';
    _txn_prefix := 'COD-';
  END IF;

  IF _coupon_code IS NOT NULL AND length(trim(_coupon_code)) > 0 THEN
    _coupon_id := NULL;
    _coupon_amount := 0;
    SELECT rc.id, rc.discount_amount, rc.code
      INTO _coupon_id, _coupon_amount, _coupon_code_final
      FROM public.redeem_coupon(_coupon_code, _subtotal) AS rc
      LIMIT 1;
    IF _coupon_id IS NULL THEN
      RAISE EXCEPTION 'Invalid or expired coupon';
    END IF;
    _discount := COALESCE(_coupon_amount, 0);
  END IF;

  _total := GREATEST(_subtotal + _shipping - _discount, 0);

  INSERT INTO public.orders (
    customer_id, total_amount, shipping_address, phone, notes,
    status, payment_status, coupon_code, discount_amount, order_kind, payment_method
  ) VALUES (
    _uid, _total, _shipping_address, _phone, _notes,
    'pending', 'pending', _coupon_code_final, _discount, _kind, _pay_method
  ) RETURNING id INTO _order_id;

  PERFORM set_config('app.stock_reason', 'sale', true);

  FOR _item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    _qty := COALESCE((_item->>'quantity')::int, 0);
    SELECT p.id, p.price, p.vendor_id
      INTO _product
      FROM public.products p
     WHERE p.id = (_item->>'product_id')::uuid;

    INSERT INTO public.order_items (order_id, product_id, vendor_id, quantity, price)
    VALUES (_order_id, _product.id, _product.vendor_id, _qty, _product.price);

    UPDATE public.products
       SET stock_quantity = GREATEST(COALESCE(stock_quantity, 0) - _qty, 0),
           updated_at = now()
     WHERE id = _product.id;
  END LOOP;

  PERFORM set_config('app.stock_reason', '', true);

  INSERT INTO public.payments (
    order_id, payment_method, amount, payment_status, transaction_id, payment_details
  ) VALUES (
    _order_id, _pay_method, _total, 'pending',
    _txn_prefix || extract(epoch from now())::bigint::text,
    jsonb_build_object('method', _pay_method)
  );

  DELETE FROM public.cart_items
   WHERE user_id = _uid
     AND product_id IN (SELECT (i->>'product_id')::uuid FROM jsonb_array_elements(_items) AS i);
  DELETE FROM public.favorites
   WHERE user_id = _uid
     AND product_id IN (SELECT (i->>'product_id')::uuid FROM jsonb_array_elements(_items) AS i);

  RETURN _order_id;
END;
$function$;

-- 3. admin_cancel_order: restore stock too
CREATE OR REPLACE FUNCTION public.admin_cancel_order(_order_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _o public.orders%ROWTYPE;
  _item record;
BEGIN
  IF NOT public.has_any_admin_role(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF _reason IS NULL OR length(trim(_reason)) = 0 THEN RAISE EXCEPTION 'reason_required'; END IF;

  SELECT * INTO _o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;
  IF _o.status IN ('delivered','cancelled') THEN RAISE EXCEPTION 'order_not_cancellable'; END IF;

  PERFORM set_config('app.stock_reason', 'return', true);
  FOR _item IN SELECT product_id, quantity FROM public.order_items WHERE order_id = _order_id
  LOOP
    UPDATE public.products
       SET stock_quantity = COALESCE(stock_quantity, 0) + _item.quantity,
           updated_at = now()
     WHERE id = _item.product_id;
  END LOOP;
  PERFORM set_config('app.stock_reason', '', true);

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

-- 4. cancel_order: label restored stock as a return
CREATE OR REPLACE FUNCTION public.cancel_order_stock_reason()
RETURNS void LANGUAGE sql AS $$ SELECT 1 $$;
DROP FUNCTION IF EXISTS public.cancel_order_stock_reason();