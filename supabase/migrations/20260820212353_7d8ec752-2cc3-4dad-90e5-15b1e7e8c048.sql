-- ============ STATUS VOCABULARY ============
CREATE OR REPLACE FUNCTION public.is_valid_order_status(_status text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT public.normalize_order_status(_status) IN (
    'pending','confirmed','preparing','ready_for_shipping','shipped',
    'out_for_delivery','delivered','completed','cancelled',
    'return_requested','returning','returned','refunded'
  );
$$;

CREATE OR REPLACE FUNCTION public.order_status_can_transition(_from text, _to text, _role text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE f text := public.normalize_order_status(_from);
        t text := public.normalize_order_status(_to);
        allowed text[];
BEGIN
  IF NOT public.is_valid_order_status(t) THEN RETURN false; END IF;
  IF f = t THEN RETURN false; END IF;

  allowed := CASE f
    WHEN 'pending'            THEN ARRAY['confirmed','cancelled']
    WHEN 'confirmed'          THEN ARRAY['preparing','cancelled']
    WHEN 'preparing'          THEN ARRAY['ready_for_shipping','cancelled']
    WHEN 'ready_for_shipping' THEN ARRAY['shipped','cancelled']
    WHEN 'shipped'            THEN ARRAY['out_for_delivery','delivered','return_requested']
    WHEN 'out_for_delivery'   THEN ARRAY['delivered','return_requested']
    WHEN 'delivered'          THEN ARRAY['completed','return_requested']
    WHEN 'completed'          THEN ARRAY['return_requested']
    WHEN 'return_requested'   THEN ARRAY['returning','delivered','completed']
    WHEN 'returning'          THEN ARRAY['returned']
    WHEN 'returned'           THEN ARRAY['refunded']
    ELSE ARRAY[]::text[]
  END;

  IF NOT (t = ANY(allowed)) THEN RETURN false; END IF;

  -- Buyers may only cancel; sellers may not close, refund or force return outcomes
  IF _role = 'buyer' AND t <> 'cancelled' THEN RETURN false; END IF;
  IF _role = 'seller' AND t IN ('completed','returned','refunded') THEN RETURN false; END IF;

  RETURN true;
END;
$$;

-- ============ CREATE ORDER (variant aware, itemised totals) ============
CREATE OR REPLACE FUNCTION public.create_order(_items jsonb, _phone text, _shipping_address text, _notes text DEFAULT NULL::text, _coupon_code text DEFAULT NULL::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
    IF NOT public.is_feature_enabled('sham_cash_payments') THEN RAISE EXCEPTION 'SHAM_CASH_DISABLED'; END IF;
    _pay_method := 'sham_cash'; _txn_prefix := 'SHAM-';
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

  INSERT INTO public.orders (
    customer_id, total_amount, subtotal_amount, shipping_amount, tax_amount,
    shipping_address, phone, notes, status, payment_status,
    coupon_code, discount_amount, order_kind, payment_method
  ) VALUES (
    _uid, _total, _subtotal, _shipping, 0,
    _shipping_address, _phone, _notes, 'pending', 'pending',
    _coupon_code_final, _discount, _kind, _pay_method
  ) RETURNING id INTO _order_id;

  INSERT INTO public.order_status_history (
    order_id, status, from_status, changed_by, changed_by_role, notes, is_override
  ) VALUES (_order_id, 'pending', NULL, _uid, 'buyer', 'تم إنشاء الطلب', false);

  PERFORM set_config('app.stock_reason', 'sale', true);

  FOR _item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    _qty := COALESCE((_item->>'quantity')::int, 0);
    SELECT p.id, p.price, p.vendor_id, p.name, p.image_url
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
      discount_amount, subtotal, product_name, product_image
    ) VALUES (
      _order_id, _product.id, _product.vendor_id, _qty, _unit_price, _variant_id, _variant_label,
      0, _unit_price * _qty, _product.name,
      COALESCE(_variant.image_url, _product.image_url)
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
$$;

-- ============ SHIPPING UPDATE ============
CREATE OR REPLACE FUNCTION public.update_order_shipping(
  _order_id uuid,
  _shipping_company text DEFAULT NULL,
  _tracking_number text DEFAULT NULL,
  _estimated_delivery timestamptz DEFAULT NULL,
  _shipping_notes text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _o public.orders%ROWTYPE;
  _is_admin boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO _o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;

  _is_admin := public.has_any_admin_role(_uid);
  IF NOT _is_admin AND NOT EXISTS (
    SELECT 1 FROM public.order_items WHERE order_id = _order_id AND vendor_id = _uid
  ) THEN RAISE EXCEPTION 'not_authorized'; END IF;
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
          'order_status', _order_id);

  INSERT INTO public.activity_logs (user_id, action_type, action_details)
  VALUES (_uid, 'order_shipping_update',
          jsonb_build_object('order_id', _order_id, 'company', _shipping_company,
                             'tracking', _tracking_number, 'eta', _estimated_delivery));
END;
$$;

-- ============ ORDER NOTES ============
CREATE OR REPLACE FUNCTION public.add_order_note(_order_id uuid, _note text, _is_internal boolean DEFAULT false)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _role text;
  _id uuid;
  _o public.orders%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _note IS NULL OR length(trim(_note)) = 0 THEN RAISE EXCEPTION 'note_required'; END IF;
  IF length(_note) > 2000 THEN RAISE EXCEPTION 'note_too_long'; END IF;

  SELECT * INTO _o FROM public.orders WHERE id = _order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;

  IF public.has_any_admin_role(_uid) THEN _role := 'admin';
  ELSIF EXISTS (SELECT 1 FROM public.order_items WHERE order_id = _order_id AND vendor_id = _uid) THEN _role := 'seller';
  ELSIF _o.customer_id = _uid THEN _role := 'buyer';
  ELSE RAISE EXCEPTION 'not_authorized'; END IF;

  INSERT INTO public.order_notes (order_id, author_id, author_role, note, is_internal)
  VALUES (_order_id, _uid, _role, trim(_note), CASE WHEN _role = 'buyer' THEN false ELSE COALESCE(_is_internal,false) END)
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_order_notes(_order_id uuid)
RETURNS TABLE(id uuid, note text, author_role text, author_name text, is_internal boolean, created_at timestamptz)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _uid uuid := auth.uid(); _is_admin boolean; _is_vendor boolean; _is_customer boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  _is_admin := public.has_any_admin_role(_uid);
  SELECT EXISTS (SELECT 1 FROM public.orders o WHERE o.id = _order_id AND o.customer_id = _uid) INTO _is_customer;
  SELECT EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = _order_id AND oi.vendor_id = _uid) INTO _is_vendor;
  IF NOT (_is_admin OR _is_customer OR _is_vendor) THEN RAISE EXCEPTION 'not_authorized'; END IF;

  RETURN QUERY
  SELECT n.id, n.note, n.author_role,
         CASE WHEN _is_admin THEN p.full_name ELSE NULL END,
         n.is_internal, n.created_at
    FROM public.order_notes n
    LEFT JOIN public.profiles p ON p.id = n.author_id
   WHERE n.order_id = _order_id
     AND (_is_admin OR _is_vendor OR NOT n.is_internal)
   ORDER BY n.created_at ASC;
END;
$$;

-- ============ REPORTS ============
CREATE OR REPLACE FUNCTION public.order_reports(_from timestamptz DEFAULT (now() - interval '30 days'), _to timestamptz DEFAULT now())
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _is_admin boolean;
  _is_vendor boolean;
  _res jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  _is_admin := public.has_any_admin_role(_uid);
  _is_vendor := public.has_role(_uid, 'vendor'::public.app_role);
  IF NOT (_is_admin OR _is_vendor) THEN RAISE EXCEPTION 'not_authorized'; END IF;

  WITH scoped AS (
    SELECT DISTINCT o.*
      FROM public.orders o
      LEFT JOIN public.order_items oi ON oi.order_id = o.id
     WHERE o.created_at BETWEEN _from AND _to
       AND (_is_admin OR oi.vendor_id = _uid)
  ),
  scoped_items AS (
    SELECT oi.*, o.created_at AS order_created, o.status AS order_status
      FROM public.order_items oi
      JOIN scoped o ON o.id = oi.order_id
     WHERE (_is_admin OR oi.vendor_id = _uid)
  )
  SELECT jsonb_build_object(
    'totals', jsonb_build_object(
      'orders', (SELECT count(*) FROM scoped),
      'revenue', (SELECT COALESCE(SUM(CASE WHEN public.normalize_order_status(status) NOT IN ('cancelled','returned','refunded')
                                           THEN COALESCE(subtotal,0) ELSE 0 END), 0) FROM scoped_items),
      'avg_order_value', (SELECT COALESCE(AVG(total_amount), 0) FROM scoped
                           WHERE public.normalize_order_status(status) NOT IN ('cancelled','returned','refunded')),
      'cancelled', (SELECT count(*) FROM scoped WHERE public.normalize_order_status(status) = 'cancelled'),
      'completed', (SELECT count(*) FROM scoped WHERE public.normalize_order_status(status) IN ('completed','delivered')),
      'returned', (SELECT count(*) FROM scoped WHERE public.normalize_order_status(status) IN ('returned','refunded'))
    ),
    'by_status', (SELECT COALESCE(jsonb_object_agg(s, c), '{}'::jsonb) FROM (
        SELECT public.normalize_order_status(status) AS s, count(*) AS c FROM scoped GROUP BY 1) x),
    'daily', (SELECT COALESCE(jsonb_agg(jsonb_build_object('day', d, 'orders', c, 'revenue', r) ORDER BY d), '[]'::jsonb) FROM (
        SELECT date_trunc('day', order_created)::date AS d, count(DISTINCT order_id) AS c, SUM(COALESCE(subtotal,0)) AS r
          FROM scoped_items GROUP BY 1) y),
    'monthly', (SELECT COALESCE(jsonb_agg(jsonb_build_object('month', m, 'orders', c, 'revenue', r) ORDER BY m), '[]'::jsonb) FROM (
        SELECT to_char(date_trunc('month', order_created), 'YYYY-MM') AS m, count(DISTINCT order_id) AS c, SUM(COALESCE(subtotal,0)) AS r
          FROM scoped_items GROUP BY 1) z),
    'top_products', (SELECT COALESCE(jsonb_agg(jsonb_build_object('product_id', pid, 'name', nm, 'quantity', q, 'revenue', r) ORDER BY r DESC), '[]'::jsonb) FROM (
        SELECT si.product_id AS pid, COALESCE(MAX(si.product_name), MAX(p.name)) AS nm, SUM(si.quantity) AS q, SUM(COALESCE(si.subtotal,0)) AS r
          FROM scoped_items si LEFT JOIN public.products p ON p.id = si.product_id
         WHERE public.normalize_order_status(si.order_status) NOT IN ('cancelled','returned','refunded')
         GROUP BY si.product_id ORDER BY r DESC LIMIT 10) tp),
    'top_sellers', (SELECT CASE WHEN _is_admin THEN COALESCE(jsonb_agg(jsonb_build_object('vendor_id', vid, 'name', nm, 'orders', o, 'revenue', r) ORDER BY r DESC), '[]'::jsonb) ELSE '[]'::jsonb END FROM (
        SELECT si.vendor_id AS vid, MAX(pr.full_name) AS nm, count(DISTINCT si.order_id) AS o, SUM(COALESCE(si.subtotal,0)) AS r
          FROM scoped_items si LEFT JOIN public.profiles pr ON pr.id = si.vendor_id
         WHERE public.normalize_order_status(si.order_status) NOT IN ('cancelled','returned','refunded')
         GROUP BY si.vendor_id ORDER BY r DESC LIMIT 10) ts)
  ) INTO _res;

  RETURN _res;
END;
$$;

-- ============ SELLER ORDER LIST (filters + pagination) ============
CREATE OR REPLACE FUNCTION public.seller_list_orders(
  _search text DEFAULT NULL,
  _status text DEFAULT NULL,
  _from timestamptz DEFAULT NULL,
  _to timestamptz DEFAULT NULL,
  _limit int DEFAULT 25,
  _offset int DEFAULT 0
) RETURNS TABLE(
  id uuid, order_number text, invoice_number text, created_at timestamptz, updated_at timestamptz,
  status text, payment_status text, payment_method text, total_amount numeric,
  vendor_subtotal numeric, items_count bigint, customer_name text, customer_phone text,
  city text, tracking_number text, courier_name text, estimated_delivery timestamptz,
  is_frozen boolean, total_count bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  RETURN QUERY
  WITH base AS (
    SELECT o.id, o.order_number, o.invoice_number, o.created_at, o.updated_at, o.status,
           o.payment_status, o.payment_method, o.total_amount, o.phone, o.shipping_address,
           o.tracking_number, o.courier_name, o.estimated_delivery, o.is_frozen, o.customer_id,
           SUM(COALESCE(oi.subtotal, oi.price * oi.quantity)) AS vendor_subtotal,
           count(*) AS items_count
      FROM public.orders o
      JOIN public.order_items oi ON oi.order_id = o.id AND oi.vendor_id = _uid
     WHERE (_status IS NULL OR public.normalize_order_status(o.status) = public.normalize_order_status(_status))
       AND (_from IS NULL OR o.created_at >= _from)
       AND (_to IS NULL OR o.created_at <= _to)
       AND (
         _search IS NULL OR length(trim(_search)) = 0
         OR COALESCE(o.order_number,'') ILIKE '%' || _search || '%'
         OR o.id::text ILIKE '%' || _search || '%'
         OR COALESCE(o.phone,'') ILIKE '%' || _search || '%'
         OR COALESCE(o.tracking_number,'') ILIKE '%' || _search || '%'
         OR EXISTS (SELECT 1 FROM public.order_items x WHERE x.order_id = o.id AND x.vendor_id = _uid
                      AND COALESCE(x.product_name,'') ILIKE '%' || _search || '%')
       )
     GROUP BY o.id
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
$$;

-- ============ SEALED HELPERS ============
REVOKE EXECUTE ON FUNCTION public.next_order_number() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.orders_set_numbers() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_order_shipping_details() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_tracking_history() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.order_reports(timestamptz, timestamptz) FROM anon;
REVOKE EXECUTE ON FUNCTION public.seller_list_orders(text, text, timestamptz, timestamptz, int, int) FROM anon;
REVOKE EXECUTE ON FUNCTION public.add_order_note(uuid, text, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.list_order_notes(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_order_shipping(uuid, text, text, timestamptz, text) FROM anon;