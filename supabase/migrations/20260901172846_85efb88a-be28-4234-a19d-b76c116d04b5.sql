-- 1) Per-product platform shipping & payment settings (NULL = inherit global platform settings)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS platform_free_shipping boolean,
  ADD COLUMN IF NOT EXISTS platform_shipping_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform_cod_enabled boolean,
  ADD COLUMN IF NOT EXISTS platform_sham_cash_enabled boolean,
  ADD COLUMN IF NOT EXISTS platform_electronic_payment_enabled boolean;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_platform_shipping_fee_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_platform_shipping_fee_check CHECK (platform_shipping_fee >= 0);

-- 2) Guard: only super admins may change these fields, and only on platform products
CREATE OR REPLACE FUNCTION public.guard_platform_product_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _changed boolean;
BEGIN
  _changed :=
    NEW.platform_free_shipping IS DISTINCT FROM OLD.platform_free_shipping
    OR NEW.platform_shipping_fee IS DISTINCT FROM OLD.platform_shipping_fee
    OR NEW.platform_cod_enabled IS DISTINCT FROM OLD.platform_cod_enabled
    OR NEW.platform_sham_cash_enabled IS DISTINCT FROM OLD.platform_sham_cash_enabled
    OR NEW.platform_electronic_payment_enabled IS DISTINCT FROM OLD.platform_electronic_payment_enabled;

  IF _changed THEN
    IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'super_admin') THEN
      RAISE EXCEPTION 'PLATFORM_SETTINGS_FORBIDDEN';
    END IF;
    IF NEW.product_type <> 'platform' THEN
      RAISE EXCEPTION 'PLATFORM_SETTINGS_ONLY_FOR_PLATFORM_PRODUCTS';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_platform_product_settings ON public.products;
CREATE TRIGGER trg_guard_platform_product_settings
BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.guard_platform_product_settings();

-- 3) create_order: resolve platform shipping/payment per product
CREATE OR REPLACE FUNCTION public.create_order(
  _items jsonb,
  _phone text,
  _shipping_address text,
  _notes text DEFAULT NULL,
  _coupon_code text DEFAULT NULL,
  _payment_method text DEFAULT NULL,
  _pickup_center_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  _variant_image text;
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
  _elec_ok boolean := false;
  _free_ship boolean := true;
  _ship_fee numeric := 0;
  _apply_all boolean := false;
  -- per-product platform resolution
  _p_sham boolean := true;
  _p_cod boolean := true;
  _p_elec boolean := true;
  _p_free boolean := true;
  _p_fee numeric := 0;
  _order_duration text := NULL;
  _fingerprint text;
  _existing uuid;
  _vendor record;
  _vendor_count int;
  _center record;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN RAISE EXCEPTION 'Cart is empty'; END IF;
  IF _phone IS NULL OR length(trim(_phone)) < 6 THEN RAISE EXCEPTION 'INVALID_PHONE'; END IF;
  IF _shipping_address IS NULL OR length(trim(_shipping_address)) < 5 THEN RAISE EXCEPTION 'INVALID_ADDRESS'; END IF;

  IF _pickup_center_id IS NULL THEN RAISE EXCEPTION 'PICKUP_CENTER_REQUIRED'; END IF;
  SELECT pc.id, pc.name, pc.address, pc.phone, pc.governorate, pc.city
    INTO _center
    FROM public.pickup_centers pc
   WHERE pc.id = _pickup_center_id AND pc.is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'PICKUP_CENTER_UNAVAILABLE'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('create_order:' || _uid::text));

  _fingerprint := md5(
    _uid::text || '|' ||
    (SELECT string_agg(x.pid || ':' || x.q, ',' ORDER BY x.pid, x.q)
       FROM (SELECT (i->>'product_id') AS pid, (i->>'quantity') AS q
               FROM jsonb_array_elements(_items) AS i) x)
  );

  SELECT o.id INTO _existing
    FROM public.orders o
   WHERE o.customer_id = _uid
     AND o.parent_order_id IS NULL
     AND o.created_at > now() - interval '60 seconds'
     AND o.notes IS NOT DISTINCT FROM _notes
     AND md5(
       _uid::text || '|' ||
       (SELECT string_agg(y.pid || ':' || y.q, ',' ORDER BY y.pid, y.q)
          FROM (SELECT oi.product_id::text AS pid, oi.quantity::text AS q
                  FROM public.order_items oi WHERE oi.order_id = o.id) y)
     ) = _fingerprint
   ORDER BY o.created_at DESC
   LIMIT 1;
  IF _existing IS NOT NULL THEN
    RETURN _existing;
  END IF;

  SELECT count(*) INTO _recent FROM public.orders
   WHERE customer_id = _uid AND parent_order_id IS NULL AND created_at > now() - interval '1 hour';
  IF _recent >= 5 THEN RAISE EXCEPTION 'ORDER_RATE_LIMIT'; END IF;

  SELECT count(*) INTO _open FROM public.orders
   WHERE customer_id = _uid AND parent_order_id IS NULL
     AND status IN ('pending','confirmed','processing','preparing');
  IF _open >= 10 THEN RAISE EXCEPTION 'TOO_MANY_OPEN_ORDERS'; END IF;

  SELECT o.sham_cash_enabled, o.cod_enabled, o.electronic_payment_enabled,
         o.free_shipping, o.shipping_fee, o.apply_to_all_products
    INTO _sham_ok, _cod_ok, _elec_ok, _free_ship, _ship_fee, _apply_all
    FROM public.get_platform_payment_options() AS o;
  _sham_ok := COALESCE(_sham_ok, false);
  _cod_ok := COALESCE(_cod_ok, false);
  _elec_ok := COALESCE(_elec_ok, false);
  _free_ship := COALESCE(_free_ship, true);
  _ship_fee := COALESCE(_ship_fee, 0);
  _apply_all := COALESCE(_apply_all, false);

  FOR _item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    _qty := COALESCE((_item->>'quantity')::int, 0);
    IF _qty <= 0 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;

    SELECT p.id, p.price, p.vendor_id, COALESCE(p.shipping_cost, 0) AS shipping_cost,
           COALESCE(p.is_active, false) AS is_active, p.moderation_status, p.product_type,
           COALESCE(p.stock_quantity, 0) AS stock_quantity, p.name,
           COALESCE(p.min_order_quantity, 1) AS min_qty, p.max_order_quantity,
           p.platform_free_shipping, COALESCE(p.platform_shipping_fee, 0) AS platform_shipping_fee,
           p.platform_cod_enabled, p.platform_sham_cash_enabled, p.platform_electronic_payment_enabled
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

    IF _row_kind = 'platform' THEN
      -- a method is available only when enabled for every platform product in the cart
      _p_cod  := _p_cod  AND COALESCE(_product.platform_cod_enabled, _cod_ok);
      _p_sham := _p_sham AND COALESCE(_product.platform_sham_cash_enabled, _sham_ok);
      _p_elec := _p_elec AND COALESCE(_product.platform_electronic_payment_enabled, _elec_ok);
      -- shipping: free only when every product is free; otherwise take the highest fee
      IF COALESCE(_product.platform_free_shipping, _free_ship) THEN
        NULL;
      ELSE
        _p_free := false;
        _p_fee := GREATEST(_p_fee,
          CASE WHEN _product.platform_free_shipping IS NULL
               THEN _ship_fee ELSE _product.platform_shipping_fee END);
      END IF;
    END IF;

    _subtotal := _subtotal + (_unit_price * _qty);
    IF _row_kind = 'seller' AND NOT _apply_all THEN
      _shipping := _shipping + _product.shipping_cost;
    END IF;
  END LOOP;

  IF _kind = 'platform' THEN
    _shipping := CASE WHEN _p_free THEN 0 ELSE _p_fee END;
    _cod_ok := _p_cod;
    _sham_ok := _p_sham;
    _elec_ok := _p_elec;
  ELSIF _apply_all THEN
    _shipping := CASE WHEN _free_ship THEN 0 ELSE _ship_fee END;
  END IF;

  IF _kind = 'platform' OR _apply_all THEN
    IF _requested IS NULL THEN
      _requested := CASE WHEN _cod_ok THEN 'cod'
                         WHEN _sham_ok THEN 'sham_cash'
                         WHEN _elec_ok THEN 'electronic' ELSE NULL END;
    END IF;
    IF _requested = 'sham_cash' AND _sham_ok THEN
      _pay_method := 'sham_cash'; _txn_prefix := 'SHAM-';
    ELSIF _requested = 'cod' AND _cod_ok THEN
      _pay_method := 'cod'; _txn_prefix := 'COD-';
    ELSIF _requested = 'electronic' AND _elec_ok THEN
      _pay_method := 'electronic'; _txn_prefix := 'EPAY-';
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
    coupon_code, discount_amount, order_kind, payment_method, shipping_duration_text,
    pickup_center_id, pickup_center_name, pickup_center_address, pickup_center_phone,
    pickup_center_governorate, pickup_center_city
  ) VALUES (
    _uid, _total, _subtotal, _shipping, 0,
    _shipping_address, _phone, _notes, 'pending', 'pending',
    _coupon_code_final, _discount, _kind, _pay_method, _order_duration,
    _center.id, _center.name, _center.address, _center.phone,
    _center.governorate, _center.city
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
    _variant_image := NULL;
    _unit_price := _product.price;

    IF _variant_id IS NOT NULL THEN
      SELECT COALESCE(v.discount_price, v.price) AS price, v.attributes, v.sku, v.image_url
        INTO _variant FROM public.product_variants v WHERE v.id = _variant_id;
      _unit_price := COALESCE(_variant.price, _product.price);
      _variant_image := _variant.image_url;
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
      COALESCE(_variant_image, _product.image_url), _product.shipping_duration_text
    );

    UPDATE public.products
       SET stock_quantity = GREATEST(COALESCE(stock_quantity, 0) - _qty, 0), updated_at = now()
     WHERE id = _product.id;
  END LOOP;

  PERFORM set_config('app.stock_reason', '', true);

  SELECT count(DISTINCT oi.vendor_id) INTO _vendor_count
    FROM public.order_items oi WHERE oi.order_id = _order_id AND oi.vendor_id IS NOT NULL;

  IF _vendor_count > 0 THEN
    FOR _vendor IN
      SELECT oi.vendor_id,
             SUM(COALESCE(oi.subtotal, oi.price * oi.quantity)) AS vsub,
             CASE WHEN _apply_all OR _kind = 'platform' THEN 0
                  ELSE COALESCE(SUM(COALESCE(p.shipping_cost, 0)), 0) END AS vship
        FROM public.order_items oi
        LEFT JOIN public.products p ON p.id = oi.product_id
       WHERE oi.order_id = _order_id AND oi.vendor_id IS NOT NULL
       GROUP BY oi.vendor_id
    LOOP
      INSERT INTO public.orders (
        customer_id, parent_order_id, vendor_id,
        total_amount, subtotal_amount, shipping_amount, tax_amount,
        shipping_address, phone, notes, status, payment_status,
        discount_amount, order_kind, payment_method, shipping_duration_text,
        pickup_center_id, pickup_center_name, pickup_center_address, pickup_center_phone,
        pickup_center_governorate, pickup_center_city
      ) VALUES (
        _uid, _order_id, _vendor.vendor_id,
        _vendor.vsub + _vendor.vship, _vendor.vsub, _vendor.vship, 0,
        _shipping_address, _phone, _notes, 'pending', 'pending',
        0, _kind, _pay_method, _order_duration,
        _center.id, _center.name, _center.address, _center.phone,
        _center.governorate, _center.city
      );
    END LOOP;
  END IF;

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