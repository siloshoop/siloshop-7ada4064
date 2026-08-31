-- 1. Platform product shipping duration (free text, platform products only)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS shipping_duration_text text;

CREATE OR REPLACE FUNCTION public.enforce_platform_shipping_duration()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.shipping_duration_text IS NOT NULL THEN
    NEW.shipping_duration_text := NULLIF(btrim(NEW.shipping_duration_text), '');
  END IF;
  IF NEW.shipping_duration_text IS NOT NULL AND length(NEW.shipping_duration_text) > 80 THEN
    RAISE EXCEPTION 'SHIPPING_DURATION_TOO_LONG';
  END IF;
  IF NEW.product_type <> 'platform' THEN
    NEW.shipping_duration_text := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_platform_shipping_duration ON public.products;
CREATE TRIGGER trg_enforce_platform_shipping_duration
BEFORE INSERT OR UPDATE OF shipping_duration_text, product_type ON public.products
FOR EACH ROW EXECUTE FUNCTION public.enforce_platform_shipping_duration();

-- 2. Platform payment method switches
ALTER TABLE public.platform_payment_settings
  ADD COLUMN IF NOT EXISTS sham_cash_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS cod_enabled boolean NOT NULL DEFAULT false;

-- 3. Order-time snapshots
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_duration_text text;
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS shipping_duration_text text;

-- 4. Safe read of enabled platform payment methods (no credentials exposed)
CREATE OR REPLACE FUNCTION public.get_platform_payment_options()
RETURNS TABLE (sham_cash_enabled boolean, cod_enabled boolean, instructions text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.sham_cash_enabled AND s.is_active AND public.is_feature_enabled('sham_cash_payments'),
    s.cod_enabled AND s.is_active,
    s.instructions
  FROM public.platform_payment_settings s
  WHERE s.id = 1;
$$;

REVOKE ALL ON FUNCTION public.get_platform_payment_options() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_platform_payment_options() TO authenticated;

-- 5. create_order: customer-selected payment method for platform orders + duration snapshot
CREATE OR REPLACE FUNCTION public.create_order(_items jsonb, _phone text, _shipping_address text, _notes text DEFAULT NULL::text, _coupon_code text DEFAULT NULL::text, _payment_method text DEFAULT NULL::text)
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
  _variant record;
  _variant_id uuid;
  _unit_price numeric;
  _variant_label text;
  _qty int;
  _kind text := NULL;
  _row_kind text;
  _pay_method text;
  _txn_prefix text;
  _recent int;
  _open int;
  _requested text := lower(NULLIF(btrim(COALESCE(_payment_method, '')), ''));
  _sham_ok boolean := false;
  _cod_ok boolean := false;
  _order_duration text := NULL;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN RAISE EXCEPTION 'Cart is empty'; END IF;
  IF _phone IS NULL OR length(trim(_phone)) < 6 THEN RAISE EXCEPTION 'INVALID_PHONE'; END IF;
  IF _shipping_address IS NULL OR length(trim(_shipping_address)) < 5 THEN RAISE EXCEPTION 'INVALID_ADDRESS'; END IF;

  SELECT count(*) INTO _recent FROM public.orders
   WHERE customer_id = _uid AND created_at > now() - interval '1 hour';
  IF _recent >= 5 THEN RAISE EXCEPTION 'ORDER_RATE_LIMIT'; END IF;

  SELECT count(*) INTO _open FROM public.orders
   WHERE customer_id = _uid AND status IN ('pending','confirmed','processing','preparing');
  IF _open >= 10 THEN RAISE EXCEPTION 'TOO_MANY_OPEN_ORDERS'; END IF;

  -- validate + lock
  FOR _item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    _qty := COALESCE((_item->>'quantity')::int, 0);
    IF _qty <= 0 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;

    SELECT p.id, p.price, p.vendor_id, COALESCE(p.shipping_cost, 0) AS shipping_cost,
           COALESCE(p.is_active, false) AS is_active, p.moderation_status, p.product_type,
           COALESCE(p.stock_quantity, 0) AS stock_quantity, p.name,
           COALESCE(p.min_order_quantity, 1) AS min_qty, p.max_order_quantity
      INTO _product
      FROM public.products p
     WHERE p.id = (_item->>'product_id')::uuid
     FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Product not found'; END IF;
    IF _product.is_active IS NOT TRUE OR _product.moderation_status <> 'approved' THEN
      RAISE EXCEPTION 'Product unavailable';
    END IF;
    IF _qty < _product.min_qty THEN RAISE EXCEPTION 'MIN_QUANTITY:%', _product.name; END IF;
    IF _product.max_order_quantity IS NOT NULL AND _qty > _product.max_order_quantity THEN
      RAISE EXCEPTION 'MAX_QUANTITY:%', _product.name;
    END IF;

    _variant_id := NULLIF(_item->>'variant_id','')::uuid;
    IF _variant_id IS NOT NULL THEN
      SELECT v.id, v.product_id, COALESCE(v.stock_quantity,0) AS stock_quantity,
             COALESCE(v.discount_price, v.price) AS price, v.is_active
        INTO _variant
        FROM public.product_variants v
       WHERE v.id = _variant_id
       FOR UPDATE;
      IF NOT FOUND OR _variant.product_id <> _product.id OR _variant.is_active IS NOT TRUE THEN
        RAISE EXCEPTION 'VARIANT_UNAVAILABLE:%', _product.name;
      END IF;
      IF _variant.stock_quantity < _qty THEN RAISE EXCEPTION 'OUT_OF_STOCK:%', _product.name; END IF;
      _unit_price := COALESCE(_variant.price, _product.price);
    ELSE
      IF _product.stock_quantity < _qty THEN RAISE EXCEPTION 'OUT_OF_STOCK:%', _product.name; END IF;
      _unit_price := _product.price;
    END IF;

    _row_kind := CASE WHEN _product.product_type = 'platform' THEN 'platform' ELSE 'seller' END;
    IF _row_kind = 'platform' AND NOT public.is_feature_enabled('platform_marketplace') THEN
      RAISE EXCEPTION 'PLATFORM_MARKETPLACE_DISABLED';
    END IF;
    IF _kind IS NULL THEN _kind := _row_kind;
    ELSIF _kind <> _row_kind THEN RAISE EXCEPTION 'MIXED_CART'; END IF;

    _subtotal := _subtotal + (_unit_price * _qty);
    _shipping := _shipping + _product.shipping_cost;
  END LOOP;

  IF _kind = 'platform' THEN
    SELECT o.sham_cash_enabled, o.cod_enabled
      INTO _sham_ok, _cod_ok
      FROM public.get_platform_payment_options() AS o;
    _sham_ok := COALESCE(_sham_ok, false);
    _cod_ok := COALESCE(_cod_ok, false);

    IF _requested IS NULL THEN
      _requested := CASE WHEN _sham_ok THEN 'sham_cash' WHEN _cod_ok THEN 'cod' ELSE NULL END;
    END IF;
    IF _requested = 'sham_cash' AND _sham_ok THEN
      _pay_method := 'sham_cash'; _txn_prefix := 'SHAM-';
    ELSIF _requested = 'cod' AND _cod_ok THEN
      _pay_method := 'cod'; _txn_prefix := 'COD-';
    ELSE
      RAISE EXCEPTION 'PAYMENT_METHOD_UNAVAILABLE';
    END IF;
  ELSE
    _pay_method := 'cod'; _txn_prefix := 'COD-';
  END IF;

  IF _coupon_code IS NOT NULL AND length(trim(_coupon_code)) > 0 THEN
    SELECT rc.id, rc.discount_amount, rc.code
      INTO _coupon_id, _coupon_amount, _coupon_code_final
      FROM public.redeem_coupon(_coupon_code, _subtotal) AS rc LIMIT 1;
    IF _coupon_id IS NULL THEN RAISE EXCEPTION 'Invalid or expired coupon'; END IF;
    _discount := COALESCE(_coupon_amount, 0);
  END IF;

  _total := GREATEST(_subtotal + _shipping - _discount, 0);

  IF _kind = 'platform' THEN
    SELECT string_agg(DISTINCT p.shipping_duration_text, ' / ')
      INTO _order_duration
      FROM public.products p
     WHERE p.id IN (SELECT (i->>'product_id')::uuid FROM jsonb_array_elements(_items) AS i)
       AND p.shipping_duration_text IS NOT NULL;
  END IF;

  INSERT INTO public.orders (
    customer_id, total_amount, subtotal_amount, shipping_amount, tax_amount,
    shipping_address, phone, notes, status, payment_status,
    coupon_code, discount_amount, order_kind, payment_method, shipping_duration_text
  ) VALUES (
    _uid, _total, _subtotal, _shipping, 0,
    _shipping_address, _phone, _notes, 'pending', 'pending',
    _coupon_code_final, _discount, _kind, _pay_method, _order_duration
  ) RETURNING id INTO _order_id;

  INSERT INTO public.order_status_history (
    order_id, status, from_status, changed_by, changed_by_role, notes, is_override
  ) VALUES (_order_id, 'pending', NULL, _uid, 'buyer', 'تم إنشاء الطلب', false);

  PERFORM set_config('app.stock_reason', 'sale', true);

  FOR _item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    _qty := COALESCE((_item->>'quantity')::int, 0);
    SELECT p.id, p.price, p.vendor_id, p.name, p.image_url, p.shipping_duration_text
      INTO _product FROM public.products p WHERE p.id = (_item->>'product_id')::uuid;

    _variant_id := NULLIF(_item->>'variant_id','')::uuid;
    _variant_label := NULL;
    _unit_price := _product.price;

    IF _variant_id IS NOT NULL THEN
      SELECT COALESCE(v.discount_price, v.price) AS price, v.attributes, v.sku, v.image_url
        INTO _variant FROM public.product_variants v WHERE v.id = _variant_id;
      _unit_price := COALESCE(_variant.price, _product.price);
      SELECT string_agg(kv.key || ': ' || kv.value, ' / ')
        INTO _variant_label
        FROM jsonb_each_text(COALESCE(_variant.attributes, '{}'::jsonb)) AS kv;

      UPDATE public.product_variants
         SET stock_quantity = GREATEST(COALESCE(stock_quantity,0) - _qty, 0), updated_at = now()
       WHERE id = _variant_id;
    END IF;

    INSERT INTO public.order_items (
      order_id, product_id, vendor_id, quantity, price, variant_id, variant_label,
      discount_amount, subtotal, product_name, product_image, shipping_duration_text
    ) VALUES (
      _order_id, _product.id, _product.vendor_id, _qty, _unit_price, _variant_id, _variant_label,
      0, _unit_price * _qty, _product.name,
      COALESCE(_variant.image_url, _product.image_url), _product.shipping_duration_text
    );

    UPDATE public.products
       SET stock_quantity = GREATEST(COALESCE(stock_quantity, 0) - _qty, 0), updated_at = now()
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

  RETURN _order_id;
END;
$function$;