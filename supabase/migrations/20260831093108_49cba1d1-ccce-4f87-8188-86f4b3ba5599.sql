-- 1. Multi-vendor columns
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS parent_order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS vendor_id uuid;

CREATE INDEX IF NOT EXISTS idx_orders_parent_order_id ON public.orders(parent_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_vendor_id ON public.orders(vendor_id);

-- 2. Vendor authorization helper.
--    Parent orders are never seller-managed: the seller acts on their own sub-order.
CREATE OR REPLACE FUNCTION public.is_order_vendor(_order_id uuid, _uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN _uid IS NULL THEN false
    WHEN EXISTS (SELECT 1 FROM public.orders c WHERE c.parent_order_id = _order_id) THEN false
    WHEN (SELECT o.vendor_id FROM public.orders o WHERE o.id = _order_id) IS NOT NULL
      THEN (SELECT o.vendor_id FROM public.orders o WHERE o.id = _order_id) = _uid
    ELSE EXISTS (
      SELECT 1 FROM public.order_items oi
       WHERE oi.order_id = _order_id AND oi.vendor_id = _uid
    )
  END;
$$;

-- 3. Sellers can read their own sub-orders directly
DROP POLICY IF EXISTS "Vendors can view their sub orders" ON public.orders;
CREATE POLICY "Vendors can view their sub orders"
ON public.orders FOR SELECT TO authenticated
USING (vendor_id = auth.uid());

-- 4. Keep the parent order status in sync with its sub-orders
CREATE OR REPLACE FUNCTION public.sync_parent_order_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _parent uuid := NEW.parent_order_id;
  _new_status text;
  _all_cancelled boolean;
BEGIN
  IF _parent IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;

  SELECT bool_and(public.normalize_order_status(c.status) = 'cancelled')
    INTO _all_cancelled
    FROM public.orders c WHERE c.parent_order_id = _parent;

  IF _all_cancelled THEN
    _new_status := 'cancelled';
  ELSE
    SELECT public.normalize_order_status(c.status) INTO _new_status
      FROM public.orders c
     WHERE c.parent_order_id = _parent
       AND public.normalize_order_status(c.status) <> 'cancelled'
     ORDER BY CASE public.normalize_order_status(c.status)
       WHEN 'pending' THEN 1 WHEN 'confirmed' THEN 2 WHEN 'processing' THEN 3
       WHEN 'preparing' THEN 4 WHEN 'ready_for_shipping' THEN 5 WHEN 'shipped' THEN 6
       WHEN 'out_for_delivery' THEN 7 WHEN 'delivered' THEN 8 WHEN 'completed' THEN 9
       ELSE 10 END ASC
     LIMIT 1;
  END IF;

  IF _new_status IS NOT NULL THEN
    UPDATE public.orders
       SET status = _new_status, updated_at = now()
     WHERE id = _parent AND status IS DISTINCT FROM _new_status;
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_sync_parent_order_status ON public.orders;
CREATE TRIGGER trg_sync_parent_order_status
AFTER INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.sync_parent_order_status();

-- 5. create_order: parent order + one sub-order per seller, duplicate protection
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
  _fingerprint text;
  _existing uuid;
  _vendor record;
  _vendor_count int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN RAISE EXCEPTION 'Cart is empty'; END IF;
  IF _phone IS NULL OR length(trim(_phone)) < 6 THEN RAISE EXCEPTION 'INVALID_PHONE'; END IF;
  IF _shipping_address IS NULL OR length(trim(_shipping_address)) < 5 THEN RAISE EXCEPTION 'INVALID_ADDRESS'; END IF;

  -- serialize concurrent checkouts for the same buyer (double-submit protection)
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
    RETURN _existing; -- idempotent: same cart submitted twice
  END IF;

  SELECT count(*) INTO _recent FROM public.orders
   WHERE customer_id = _uid AND parent_order_id IS NULL AND created_at > now() - interval '1 hour';
  IF _recent >= 5 THEN RAISE EXCEPTION 'ORDER_RATE_LIMIT'; END IF;

  SELECT count(*) INTO _open FROM public.orders
   WHERE customer_id = _uid AND parent_order_id IS NULL
     AND status IN ('pending','confirmed','processing','preparing');
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

  -- One sub-order per seller (always, so sellers manage only their own scope)
  SELECT count(DISTINCT oi.vendor_id) INTO _vendor_count
    FROM public.order_items oi WHERE oi.order_id = _order_id AND oi.vendor_id IS NOT NULL;

  IF _vendor_count > 0 THEN
    FOR _vendor IN
      SELECT oi.vendor_id,
             SUM(COALESCE(oi.subtotal, oi.price * oi.quantity)) AS vsub,
             COALESCE(SUM(COALESCE(p.shipping_cost, 0)), 0) AS vship
        FROM public.order_items oi
        LEFT JOIN public.products p ON p.id = oi.product_id
       WHERE oi.order_id = _order_id AND oi.vendor_id IS NOT NULL
       GROUP BY oi.vendor_id
    LOOP
      INSERT INTO public.orders (
        customer_id, parent_order_id, vendor_id,
        total_amount, subtotal_amount, shipping_amount, tax_amount,
        shipping_address, phone, notes, status, payment_status,
        discount_amount, order_kind, payment_method, shipping_duration_text
      ) VALUES (
        _uid, _order_id, _vendor.vendor_id,
        _vendor.vsub + _vendor.vship, _vendor.vsub, _vendor.vship, 0,
        _shipping_address, _phone, _notes, 'pending', 'pending',
        0, _kind, _pay_method, _order_duration
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

  -- clear the cart only after everything above succeeded
  DELETE FROM public.cart_items
   WHERE user_id = _uid
     AND product_id IN (SELECT (i->>'product_id')::uuid FROM jsonb_array_elements(_items) AS i);

  RETURN _order_id;
END;
$function$;

-- 6. Seller order list: sub-orders only, items scoped to the seller
CREATE OR REPLACE FUNCTION public.seller_list_orders(_search text DEFAULT NULL::text, _status text DEFAULT NULL::text, _from timestamp with time zone DEFAULT NULL::timestamp with time zone, _to timestamp with time zone DEFAULT NULL::timestamp with time zone, _limit integer DEFAULT 25, _offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, order_number text, invoice_number text, created_at timestamp with time zone, updated_at timestamp with time zone, status text, payment_status text, payment_method text, total_amount numeric, vendor_subtotal numeric, items_count bigint, customer_name text, customer_phone text, city text, tracking_number text, courier_name text, estimated_delivery timestamp with time zone, is_frozen boolean, total_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  RETURN QUERY
  WITH src AS (
    SELECT o.*, COALESCE(o.parent_order_id, o.id) AS items_order_id
      FROM public.orders o
     WHERE (
        o.vendor_id = _uid
        OR (
          o.vendor_id IS NULL AND o.parent_order_id IS NULL
          AND NOT EXISTS (SELECT 1 FROM public.orders c WHERE c.parent_order_id = o.id)
          AND EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = o.id AND oi.vendor_id = _uid)
        )
     )
  ), base AS (
    SELECT s.id, s.order_number, s.invoice_number, s.created_at, s.updated_at, s.status,
           s.payment_status, s.payment_method, s.total_amount, s.phone, s.shipping_address,
           s.tracking_number, s.courier_name, s.estimated_delivery, s.is_frozen, s.customer_id,
           SUM(COALESCE(oi.subtotal, oi.price * oi.quantity)) AS vendor_subtotal,
           count(*) AS items_count
      FROM src s
      JOIN public.order_items oi ON oi.order_id = s.items_order_id AND oi.vendor_id = _uid
     WHERE (_status IS NULL OR public.normalize_order_status(s.status) = public.normalize_order_status(_status))
       AND (_from IS NULL OR s.created_at >= _from)
       AND (_to IS NULL OR s.created_at <= _to)
       AND (
         _search IS NULL OR length(trim(_search)) = 0
         OR COALESCE(s.order_number,'') ILIKE '%' || _search || '%'
         OR s.id::text ILIKE '%' || _search || '%'
         OR COALESCE(s.phone,'') ILIKE '%' || _search || '%'
         OR COALESCE(s.tracking_number,'') ILIKE '%' || _search || '%'
         OR EXISTS (SELECT 1 FROM public.order_items x
                     WHERE x.order_id = s.items_order_id AND x.vendor_id = _uid
                       AND COALESCE(x.product_name,'') ILIKE '%' || _search || '%')
       )
     GROUP BY s.id, s.order_number, s.invoice_number, s.created_at, s.updated_at, s.status,
              s.payment_status, s.payment_method, s.total_amount, s.phone, s.shipping_address,
              s.tracking_number, s.courier_name, s.estimated_delivery, s.is_frozen, s.customer_id
  ), counted AS (SELECT count(*) AS c FROM base)
  SELECT b.id, b.order_number, b.invoice_number, b.created_at, b.updated_at,
         public.normalize_order_status(b.status), b.payment_status, b.payment_method,
         b.total_amount, b.vendor_subtotal, b.items_count,
         p.full_name, b.phone,
         NULLIF(split_part(COALESCE(b.shipping_address,''), ',', 1), ''),
         b.tracking_number, b.courier_name, b.estimated_delivery, COALESCE(b.is_frozen,false),
         (SELECT c FROM counted)
    FROM base b
    LEFT JOIN public.profiles p ON p.id = b.customer_id
   ORDER BY b.created_at DESC
   LIMIT GREATEST(LEAST(COALESCE(_limit,25), 100), 1)
  OFFSET GREATEST(COALESCE(_offset,0), 0);
END;
$function$;

-- 7. Items of an order for the current seller (or admin)
CREATE OR REPLACE FUNCTION public.seller_order_items(_order_id uuid)
RETURNS TABLE(id uuid, product_name text, product_image text, variant_label text, quantity integer, price numeric, subtotal numeric)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _is_admin boolean;
  _items_order uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  _is_admin := public.has_any_admin_role(_uid);
  IF NOT _is_admin AND NOT public.is_order_vendor(_order_id, _uid) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT COALESCE(o.parent_order_id, o.id) INTO _items_order
    FROM public.orders o WHERE o.id = _order_id;
  IF _items_order IS NULL THEN RAISE EXCEPTION 'order_not_found'; END IF;

  RETURN QUERY
  SELECT oi.id, oi.product_name, oi.product_image, oi.variant_label,
         oi.quantity, oi.price, oi.subtotal
    FROM public.order_items oi
   WHERE oi.order_id = _items_order
     AND (_is_admin OR oi.vendor_id = _uid);
END;
$function$;

-- 8. Vendor authorization in the order RPCs now understands sub-orders
CREATE OR REPLACE FUNCTION public.update_order_status(_order_id uuid, _status text, _note text DEFAULT NULL::text, _ip_address text DEFAULT NULL::text, _user_agent text DEFAULT NULL::text, _override boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _o public.orders%ROWTYPE;
  _role text;
  _new text := public.normalize_order_status(_status);
  _is_admin boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.is_valid_order_status(_new) THEN RAISE EXCEPTION 'invalid_status'; END IF;

  SELECT * INTO _o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;

  _is_admin := public.has_any_admin_role(_uid);
  IF _is_admin THEN _role := 'admin';
  ELSIF public.is_order_vendor(_order_id, _uid) THEN _role := 'seller';
  ELSIF _o.customer_id = _uid THEN _role := 'buyer';
  ELSE RAISE EXCEPTION 'not_authorized'; END IF;

  IF _o.is_frozen AND NOT _is_admin THEN RAISE EXCEPTION 'order_frozen'; END IF;
  IF public.normalize_order_status(_o.status) = _new THEN RAISE EXCEPTION 'duplicate_status'; END IF;

  IF NOT public.order_status_can_transition(_o.status, _new, _role) THEN
    IF NOT (_is_admin AND _override) THEN RAISE EXCEPTION 'invalid_transition'; END IF;
  END IF;

  UPDATE public.orders
     SET status = _new,
         delivered_at = CASE WHEN _new = 'delivered' AND delivered_at IS NULL THEN now() ELSE delivered_at END,
         completed_at = CASE WHEN _new = 'completed' AND completed_at IS NULL THEN now() ELSE completed_at END,
         updated_at = now()
   WHERE id = _order_id;

  INSERT INTO public.order_status_history
    (order_id, status, from_status, notes, changed_by, changed_by_role, ip_address, user_agent, is_override)
  VALUES (_order_id, _new, _o.status, _note, _uid, _role, _ip_address, _user_agent,
          COALESCE(_override,false) AND NOT public.order_status_can_transition(_o.status, _new, _role));

  INSERT INTO public.activity_logs (user_id, action_type, action_details, ip_address, user_agent)
  VALUES (_uid, 'order_status_update',
          jsonb_build_object('order_id', _order_id, 'from', _o.status, 'to', _new,
                             'role', _role, 'override', COALESCE(_override,false), 'note', _note),
          _ip_address, _user_agent);
END; $function$;

CREATE OR REPLACE FUNCTION public.update_order_shipping(_order_id uuid, _shipping_company text DEFAULT NULL::text, _tracking_number text DEFAULT NULL::text, _estimated_delivery timestamp with time zone DEFAULT NULL::timestamp with time zone, _shipping_notes text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _o public.orders%ROWTYPE;
  _is_admin boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO _o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;

  _is_admin := public.has_any_admin_role(_uid);
  IF NOT _is_admin AND NOT public.is_order_vendor(_order_id, _uid) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  IF _o.is_frozen AND NOT _is_admin THEN RAISE EXCEPTION 'order_frozen'; END IF;

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
          COALESCE(' - ' || NULLIF(trim(COALESCE(_tracking_number,'')),''), ''),
          CASE WHEN _is_admin THEN 'admin' ELSE 'seller' END);

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

CREATE OR REPLACE FUNCTION public.get_order_timeline(_order_id uuid)
 RETURNS TABLE(id uuid, status text, from_status text, notes text, changed_by_role text, actor_name text, ip_address text, user_agent text, is_override boolean, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _is_admin boolean; _is_customer boolean; _is_vendor boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  _is_admin := public.has_any_admin_role(_uid);
  SELECT EXISTS (SELECT 1 FROM public.orders WHERE id = _order_id AND customer_id = _uid) INTO _is_customer;
  _is_vendor := public.is_order_vendor(_order_id, _uid);
  IF NOT (_is_admin OR _is_customer OR _is_vendor) THEN RAISE EXCEPTION 'not_authorized'; END IF;

  RETURN QUERY
  SELECT h.id, h.status, h.from_status, h.notes,
         COALESCE(h.changed_by_role,'system') AS changed_by_role,
         CASE WHEN _is_admin THEN p.full_name ELSE NULL END AS actor_name,
         CASE WHEN _is_admin THEN h.ip_address ELSE NULL END AS ip_address,
         CASE WHEN _is_admin THEN h.user_agent ELSE NULL END AS user_agent,
         h.is_override, h.created_at
  FROM public.order_status_history h
  LEFT JOIN public.profiles p ON p.id = h.changed_by
  WHERE h.order_id = _order_id
     OR h.order_id IN (SELECT c.id FROM public.orders c WHERE c.parent_order_id = _order_id)
  ORDER BY h.created_at ASC;
END; $function$;

-- 9. cancel_order understands sub-orders (stock/notifications use the item-bearing order)
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

  FOR _item IN
    SELECT product_id, quantity FROM public.order_items
     WHERE order_id = _items_order
       AND (_vendor_scope IS NULL OR vendor_id = _vendor_scope)
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

-- 10. Admin listing shows one row per complete order (sub-orders are nested detail)
CREATE OR REPLACE FUNCTION public.admin_list_orders(_search text DEFAULT NULL::text, _status text DEFAULT NULL::text, _payment_status text DEFAULT NULL::text, _from timestamp with time zone DEFAULT NULL::timestamp with time zone, _to timestamp with time zone DEFAULT NULL::timestamp with time zone, _limit integer DEFAULT 50, _offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, created_at timestamp with time zone, updated_at timestamp with time zone, status text, payment_status text, total_amount numeric, discount_amount numeric, coupon_code text, phone text, shipping_address text, tracking_number text, courier_name text, delivered_at timestamp with time zone, cancelled_at timestamp with time zone, cancellation_reason text, customer_id uuid, customer_name text, customer_email text, items_count bigint, vendors_count bigint, order_number text, invoice_number text, payment_method text, estimated_delivery timestamp with time zone, is_frozen boolean, total_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT o.*
      FROM public.orders o
     WHERE public.has_any_admin_role(auth.uid())
       AND o.parent_order_id IS NULL
       AND (_status IS NULL OR public.normalize_order_status(o.status) = public.normalize_order_status(_status))
       AND (_payment_status IS NULL OR o.payment_status = _payment_status)
       AND (_from IS NULL OR o.created_at >= _from)
       AND (_to IS NULL OR o.created_at <= _to)
       AND (
         _search IS NULL OR length(trim(_search)) = 0
         OR COALESCE(o.order_number,'') ILIKE '%' || _search || '%'
         OR COALESCE(o.invoice_number,'') ILIKE '%' || _search || '%'
         OR o.id::text ILIKE '%' || _search || '%'
         OR COALESCE(o.phone,'') ILIKE '%' || _search || '%'
         OR COALESCE(o.tracking_number,'') ILIKE '%' || _search || '%'
         OR COALESCE(o.coupon_code,'') ILIKE '%' || _search || '%'
         OR EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = o.customer_id
                      AND COALESCE(pr.full_name,'') ILIKE '%' || _search || '%')
         OR EXISTS (SELECT 1 FROM auth.users u WHERE u.id = o.customer_id
                      AND COALESCE(u.email,'') ILIKE '%' || _search || '%')
         OR EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = o.id
                      AND COALESCE(oi.product_name,'') ILIKE '%' || _search || '%')
       )
  ), counted AS (SELECT count(*) AS c FROM base)
  SELECT b.id, b.created_at, b.updated_at, public.normalize_order_status(b.status), b.payment_status,
         b.total_amount, b.discount_amount, b.coupon_code, b.phone, b.shipping_address,
         b.tracking_number, b.courier_name, b.delivered_at, b.cancelled_at, b.cancellation_reason,
         b.customer_id, pr.full_name,
         (SELECT u.email::text FROM auth.users u WHERE u.id = b.customer_id),
         (SELECT count(*) FROM public.order_items oi WHERE oi.order_id = b.id),
         (SELECT count(DISTINCT oi.vendor_id) FROM public.order_items oi WHERE oi.order_id = b.id),
         b.order_number, b.invoice_number, b.payment_method, b.estimated_delivery,
         COALESCE(b.is_frozen,false), (SELECT c FROM counted)
    FROM base b
    LEFT JOIN public.profiles pr ON pr.id = b.customer_id
   ORDER BY b.created_at DESC
   LIMIT GREATEST(LEAST(COALESCE(_limit,50), 200), 1)
  OFFSET GREATEST(COALESCE(_offset,0), 0);
$function$;

-- 11. Admin sub-order breakdown for a complete order
CREATE OR REPLACE FUNCTION public.admin_order_sub_orders(_order_id uuid)
RETURNS TABLE(id uuid, vendor_id uuid, vendor_name text, order_number text, status text, total_amount numeric, items_count bigint, created_at timestamp with time zone)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_any_admin_role(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  RETURN QUERY
  SELECT c.id, c.vendor_id, p.full_name, c.order_number,
         public.normalize_order_status(c.status), c.total_amount,
         (SELECT count(*) FROM public.order_items oi
           WHERE oi.order_id = _order_id AND oi.vendor_id = c.vendor_id),
         c.created_at
    FROM public.orders c
    LEFT JOIN public.profiles p ON p.id = c.vendor_id
   WHERE c.parent_order_id = _order_id
   ORDER BY c.created_at ASC;
END; $function$;

GRANT EXECUTE ON FUNCTION public.seller_order_items(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_order_sub_orders(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_order_vendor(uuid, uuid) TO authenticated;