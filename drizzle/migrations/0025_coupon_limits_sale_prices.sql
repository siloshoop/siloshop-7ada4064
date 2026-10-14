ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS max_discounted_units integer,
  ADD COLUMN IF NOT EXISTS max_units_per_order integer,
  ADD COLUMN IF NOT EXISTS max_uses_per_customer integer,
  ADD COLUMN IF NOT EXISTS starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS combinable_with_sale boolean NOT NULL DEFAULT false;

ALTER TABLE public.daily_deals
  ADD COLUMN IF NOT EXISTS sale_price numeric,
  ADD COLUMN IF NOT EXISTS sale_quantity integer,
  ADD COLUMN IF NOT EXISTS sold_quantity integer NOT NULL DEFAULT 0;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS original_price numeric,
  ADD COLUMN IF NOT EXISTS sale_discount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coupon_discount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coupon_code text,
  ADD COLUMN IF NOT EXISTS coupon_units integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deal_id uuid,
  ADD COLUMN IF NOT EXISTS sale_units integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sale_released boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.validate_promo_limits()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'coupons' THEN
    IF (NEW.max_discounted_units IS NOT NULL AND NEW.max_discounted_units < 1)
       OR (NEW.max_units_per_order IS NOT NULL AND NEW.max_units_per_order < 1)
       OR (NEW.max_uses_per_customer IS NOT NULL AND NEW.max_uses_per_customer < 1) THEN
      RAISE EXCEPTION 'INVALID_COUPON_LIMIT';
    END IF;
    IF NEW.starts_at IS NOT NULL AND NEW.expires_at IS NOT NULL AND NEW.expires_at <= NEW.starts_at THEN
      RAISE EXCEPTION 'INVALID_COUPON_DATES';
    END IF;
  ELSE
    IF NEW.sale_price IS NOT NULL AND NEW.sale_price < 0 THEN RAISE EXCEPTION 'INVALID_SALE_PRICE'; END IF;
    IF NEW.sale_quantity IS NOT NULL AND NEW.sale_quantity < 1 THEN RAISE EXCEPTION 'INVALID_SALE_QUANTITY'; END IF;
    IF NEW.end_date <= NEW.start_date THEN RAISE EXCEPTION 'INVALID_SALE_DATES'; END IF;
    IF TG_OP = 'UPDATE' AND NEW.sold_quantity IS DISTINCT FROM OLD.sold_quantity
       AND COALESCE(current_setting('app.coupon_redeem', true), '') <> 'on' THEN
      RAISE EXCEPTION 'sold_quantity is managed by orders';
    END IF;
    IF TG_OP = 'INSERT' AND COALESCE(current_setting('app.coupon_redeem', true), '') <> 'on' THEN
      NEW.sold_quantity := 0;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_validate_coupon_limits ON public.coupons;
CREATE TRIGGER trg_validate_coupon_limits BEFORE INSERT OR UPDATE ON public.coupons
  FOR EACH ROW EXECUTE FUNCTION public.validate_promo_limits();
DROP TRIGGER IF EXISTS trg_validate_deal_limits ON public.daily_deals;
CREATE TRIGGER trg_validate_deal_limits BEFORE INSERT OR UPDATE ON public.daily_deals
  FOR EACH ROW EXECUTE FUNCTION public.validate_promo_limits();

CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL,
  vendor_id uuid NOT NULL,
  coupon_code text NOT NULL,
  units integer NOT NULL DEFAULT 0,
  discount_amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'SYP',
  status text NOT NULL DEFAULT 'reserved',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coupon_id, order_id)
);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_coupon ON public.coupon_redemptions(coupon_id, status);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_customer ON public.coupon_redemptions(customer_id, coupon_id);

GRANT SELECT ON public.coupon_redemptions TO authenticated;
GRANT ALL ON public.coupon_redemptions TO service_role;
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Redemptions visible to buyer, seller and admins" ON public.coupon_redemptions
  FOR SELECT TO authenticated
  USING (customer_id = auth.uid() OR vendor_id = auth.uid() OR public.has_any_admin_role(auth.uid()));

CREATE OR REPLACE FUNCTION public.line_pricing(_product_id uuid, _base numeric, _qty integer,
  OUT deal_id uuid, OUT sale_units integer, OUT sale_unit numeric, OUT regular_unit numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _tier numeric; _list numeric; _d record;
BEGIN
  SELECT COALESCE((SELECT q.discount_percentage FROM public.quantity_discounts q
     WHERE q.product_id = _product_id AND q.min_quantity <= COALESCE(_qty, 1)
     ORDER BY q.min_quantity DESC LIMIT 1), 0) INTO _tier;
  regular_unit := round(COALESCE(_base, 0) * (1 - _tier / 100.0), 2);
  sale_unit := regular_unit; sale_units := 0; deal_id := NULL;
  SELECT price INTO _list FROM public.products WHERE id = _product_id;
  SELECT d.id, d.sale_quantity, d.sold_quantity,
         round(COALESCE(_base, 0) * (1 - LEAST(100, GREATEST(0,
           CASE WHEN d.sale_price IS NOT NULL AND COALESCE(_list, 0) > 0
                THEN (1 - d.sale_price / _list) * 100
                ELSE COALESCE(d.discount_percentage, 0) END)) / 100.0)
               * (1 - _tier / 100.0), 2) AS unit
    INTO _d
    FROM public.daily_deals d
   WHERE d.product_id = _product_id AND d.is_active
     AND d.start_date <= now() AND d.end_date > now()
     AND (d.sale_quantity IS NULL OR d.sold_quantity < d.sale_quantity)
   ORDER BY 4 ASC LIMIT 1;
  IF FOUND AND _d.unit < regular_unit THEN
    deal_id := _d.id;
    sale_unit := _d.unit;
    sale_units := CASE WHEN _d.sale_quantity IS NULL THEN COALESCE(_qty, 0)
                       ELSE LEAST(COALESCE(_qty, 0), _d.sale_quantity - _d.sold_quantity) END;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.effective_unit_price(_product_id uuid, _price numeric, _qty integer)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN lp.sale_units > 0 THEN lp.sale_unit ELSE lp.regular_unit END
    FROM public.line_pricing(_product_id, _price, _qty) lp
$$;

CREATE OR REPLACE FUNCTION public.coupon_allocate(_c public.coupons, _uid uuid, _lines jsonb,
  OUT discount numeric, OUT eligible numeric, OUT units integer, OUT alloc jsonb, OUT error text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _cap integer; _taken integer; _left integer; _cust integer; _curs text[];
  _b record; _base numeric := 0; _amt numeric; _acc numeric := 0;
  _per jsonb := '{}'::jsonb; _k text; _n integer; _i integer := 0; _share numeric;
BEGIN
  discount := 0; eligible := 0; units := 0; alloc := '[]'::jsonb; error := NULL;
  IF NOT _c.is_active OR (_c.expires_at IS NOT NULL AND _c.expires_at <= now()) THEN error := 'EXPIRED'; RETURN; END IF;
  IF _c.starts_at IS NOT NULL AND _c.starts_at > now() THEN error := 'NOT_STARTED'; RETURN; END IF;
  IF _c.max_uses IS NOT NULL AND _c.used_count >= _c.max_uses THEN error := 'USES_EXHAUSTED'; RETURN; END IF;
  IF _c.max_uses_per_customer IS NOT NULL AND _uid IS NOT NULL THEN
    SELECT count(*) INTO _cust FROM public.coupon_redemptions r
     WHERE r.coupon_id = _c.id AND r.customer_id = _uid AND r.status <> 'released';
    IF _cust >= _c.max_uses_per_customer THEN error := 'CUSTOMER_LIMIT'; RETURN; END IF;
  END IF;

  SELECT COALESCE(sum((l->>'subtotal')::numeric), 0), array_agg(DISTINCT l->>'currency')
    INTO eligible, _curs
    FROM jsonb_array_elements(_lines) l
   WHERE (l->>'vendor_id')::uuid = _c.vendor_id
     AND cardinality(_c.product_ids) > 0
     AND (l->>'product_id')::uuid = ANY(_c.product_ids);
  IF eligible <= 0 THEN error := 'NOT_ELIGIBLE'; RETURN; END IF;
  IF cardinality(_curs) > 1 OR (_c.discount_type = 'fixed' AND _curs[1] <> COALESCE(_c.currency, 'SYP')) THEN
    error := 'CURRENCY_MISMATCH'; RETURN;
  END IF;
  IF _c.min_purchase IS NOT NULL AND eligible < _c.min_purchase THEN error := 'MIN_PURCHASE'; RETURN; END IF;

  _cap := _c.max_units_per_order;
  IF _c.max_discounted_units IS NOT NULL THEN
    SELECT COALESCE(sum(r.units), 0) INTO _taken FROM public.coupon_redemptions r
     WHERE r.coupon_id = _c.id AND r.status IN ('reserved', 'used');
    _left := _c.max_discounted_units - _taken;
    IF _left <= 0 THEN error := 'UNITS_EXHAUSTED'; RETURN; END IF;
    _cap := LEAST(COALESCE(_cap, _left), _left);
  END IF;

  FOR _b IN
    SELECT x.idx, x.price, x.n FROM (
      SELECT (l->>'idx')::int AS idx, (l->>'regular_unit')::numeric AS price,
             (l->>'qty')::int - (l->>'sale_units')::int AS n
        FROM jsonb_array_elements(_lines) l
       WHERE (l->>'vendor_id')::uuid = _c.vendor_id AND (l->>'product_id')::uuid = ANY(_c.product_ids)
      UNION ALL
      SELECT (l->>'idx')::int, (l->>'sale_unit')::numeric, (l->>'sale_units')::int
        FROM jsonb_array_elements(_lines) l
       WHERE _c.combinable_with_sale
         AND (l->>'vendor_id')::uuid = _c.vendor_id AND (l->>'product_id')::uuid = ANY(_c.product_ids)
    ) x WHERE x.n > 0 ORDER BY x.price DESC, x.idx
  LOOP
    EXIT WHEN _cap IS NOT NULL AND units >= _cap;
    _n := CASE WHEN _cap IS NULL THEN _b.n ELSE LEAST(_b.n, _cap - units) END;
    units := units + _n;
    _base := _base + _n * _b.price;
    _k := _b.idx::text;
    _per := jsonb_set(_per, ARRAY[_k], jsonb_build_object(
      'units', COALESCE((_per->_k->>'units')::int, 0) + _n,
      'base', COALESCE((_per->_k->>'base')::numeric, 0) + _n * _b.price));
  END LOOP;
  IF units = 0 THEN error := 'SALE_NOT_COMBINABLE'; RETURN; END IF;

  _amt := round(CASE WHEN _c.discount_type = 'percentage'
                     THEN _base * LEAST(_c.discount_value, 100) / 100.0
                     ELSE LEAST(_c.discount_value, _base) END, 2);
  _n := (SELECT count(*) FROM jsonb_object_keys(_per));
  FOR _k IN SELECT k FROM jsonb_object_keys(_per) k ORDER BY k::int LOOP
    _i := _i + 1;
    _share := CASE WHEN _i = _n THEN _amt - _acc
                   ELSE round(_amt * (_per->_k->>'base')::numeric / NULLIF(_base, 0), 2) END;
    _acc := _acc + _share;
    alloc := alloc || jsonb_build_object('idx', _k::int, 'units', (_per->_k->>'units')::int, 'discount', _share);
  END LOOP;
  discount := _amt;
END $$;

CREATE OR REPLACE FUNCTION public.build_cart_lines(_items jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _out jsonb := '[]'::jsonb; _r record; _lp record; _i int := 0;
BEGIN
  FOR _r IN
    SELECT p.id, p.vendor_id, COALESCE(NULLIF(upper(btrim(p.currency)), ''), 'SYP') AS currency,
           GREATEST((i->>'quantity')::int, 0) AS qty,
           COALESCE(v.discount_price, v.price, p.price) AS base
      FROM jsonb_array_elements(COALESCE(_items, '[]'::jsonb)) i
      JOIN public.products p ON p.id = (i->>'product_id')::uuid
      LEFT JOIN public.product_variants v ON v.id = NULLIF(i->>'variant_id','')::uuid AND v.product_id = p.id
  LOOP
    _i := _i + 1;
    SELECT * INTO _lp FROM public.line_pricing(_r.id, _r.base, _r.qty);
    _out := _out || jsonb_build_object('idx', _i, 'product_id', _r.id, 'vendor_id', _r.vendor_id,
      'currency', CASE WHEN _r.currency = 'USD' THEN 'USD' ELSE 'SYP' END, 'qty', _r.qty,
      'sale_units', _lp.sale_units, 'sale_unit', _lp.sale_unit, 'regular_unit', _lp.regular_unit,
      'subtotal', _lp.sale_units * _lp.sale_unit + (_r.qty - _lp.sale_units) * _lp.regular_unit);
  END LOOP;
  RETURN _out;
END $$;

CREATE OR REPLACE FUNCTION public.quote_cart_coupon(_code text, _items jsonb)
 RETURNS TABLE(id uuid, code text, vendor_id uuid, discount_type text, discount_value numeric, currency text, eligible_subtotal numeric, discount_amount numeric, error text)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _c public.coupons%ROWTYPE; _a record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO _c FROM public.coupons c WHERE c.code = upper(btrim(_code));
  IF NOT FOUND THEN RETURN; END IF;
  SELECT * INTO _a FROM public.coupon_allocate(_c, auth.uid(), public.build_cart_lines(_items));
  id := _c.id; code := _c.code; vendor_id := _c.vendor_id;
  discount_type := _c.discount_type; discount_value := _c.discount_value;
  currency := COALESCE(_c.currency, 'SYP'); eligible_subtotal := _a.eligible;
  discount_amount := CASE WHEN _a.error IS NULL THEN _a.discount ELSE 0 END;
  error := _a.error;
  RETURN NEXT;
END $function$;

CREATE OR REPLACE FUNCTION public.create_order(_items jsonb, _phone text, _shipping_address text, _notes text DEFAULT NULL::text, _coupon_code text DEFAULT NULL::text, _payment_method text DEFAULT NULL::text, _pickup_center_id uuid DEFAULT NULL::uuid)
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
  _coupon public.coupons%ROWTYPE;
  _alloc record;
  _coupon_code_final text := NULL;
  _item jsonb;
  _line jsonb;
  _lines jsonb := '[]'::jsonb;
  _lp record;
  _idx int := 0;
  _line_sub numeric;
  _line_coupon numeric;
  _line_coupon_units int;
  _product record;
  _variant record;
  _variant_id uuid;
  _variant_image text;
  _unit_price numeric;
  _variant_label text;
  _qty int;
  _kind text := NULL;
  _row_kind text;
  _currency text := NULL;
  _row_currency text;
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

  IF _pickup_center_id IS NOT NULL THEN
    SELECT pc.id, pc.name, pc.address, pc.phone, pc.governorate, pc.city
      INTO _center
      FROM public.pickup_centers pc
     WHERE pc.id = _pickup_center_id AND pc.is_active = true;
    IF NOT FOUND THEN RAISE EXCEPTION 'PICKUP_CENTER_UNAVAILABLE'; END IF;
  ELSE
    SELECT NULL::uuid AS id, NULL::text AS name, NULL::text AS address, NULL::text AS phone,
           NULL::text AS governorate, NULL::text AS city
      INTO _center;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('create_order:' || _uid::text));

  FOR _item IN SELECT jsonb_build_object('product_id', i->>'product_id', 'variant_id', NULLIF(i->>'variant_id',''), 'quantity', sum((i->>'quantity')::integer)) FROM jsonb_array_elements(_items) i GROUP BY i->>'product_id', NULLIF(i->>'variant_id','') ORDER BY i->>'product_id', NULLIF(i->>'variant_id','')
  LOOP
    SELECT p.* INTO _product FROM public.products p WHERE p.id=(_item->>'product_id')::uuid FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_UNAVAILABLE'; END IF;
    _qty := (_item->>'quantity')::integer;
    _variant_id := NULLIF(_item->>'variant_id','')::uuid;
    IF _variant_id IS NULL THEN
      IF EXISTS (SELECT 1 FROM public.product_variants WHERE product_id=_product.id) THEN RAISE EXCEPTION 'VARIANT_REQUIRED:%',_product.name; END IF;
      IF _product.stock_quantity<_qty THEN RAISE EXCEPTION 'OUT_OF_STOCK:%',_product.name; END IF;
    ELSE
      SELECT v.* INTO _variant FROM public.product_variants v WHERE v.id=_variant_id FOR UPDATE;
      IF NOT FOUND OR _variant.product_id<>_product.id OR _variant.is_active IS NOT TRUE THEN RAISE EXCEPTION 'VARIANT_UNAVAILABLE:%',_product.name; END IF;
      IF _variant.stock_quantity<_qty THEN RAISE EXCEPTION 'OUT_OF_STOCK:%',_product.name; END IF;
    END IF;
  END LOOP;

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

  PERFORM set_config('app.coupon_redeem', 'on', true);

  FOR _item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    _qty := COALESCE((_item->>'quantity')::int, 0);
    IF _qty <= 0 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;

    SELECT p.id, p.price, p.vendor_id, COALESCE(p.shipping_cost, 0) AS shipping_cost,
           COALESCE(p.is_active, false) AS is_active, p.moderation_status, p.product_type,
           COALESCE(p.stock_quantity, 0) AS stock_quantity, p.name,
           COALESCE(p.min_order_quantity, 1) AS min_qty, p.max_order_quantity,
           COALESCE(NULLIF(upper(btrim(p.currency)), ''), 'SYP') AS currency,
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

    _row_currency := _product.currency;
    IF _row_currency NOT IN ('SYP','USD') THEN _row_currency := 'SYP'; END IF;
    IF _currency IS NULL THEN _currency := _row_currency;
    ELSIF _currency <> _row_currency THEN RAISE EXCEPTION 'MIXED_CURRENCY'; END IF;

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
      _p_cod  := _p_cod  AND COALESCE(_product.platform_cod_enabled, _cod_ok);
      _p_sham := _p_sham AND COALESCE(_product.platform_sham_cash_enabled, _sham_ok);
      _p_elec := _p_elec AND COALESCE(_product.platform_electronic_payment_enabled, _elec_ok);
      IF COALESCE(_product.platform_free_shipping, _free_ship) THEN
        NULL;
      ELSE
        _p_free := false;
        _p_fee := GREATEST(_p_fee,
          CASE WHEN _product.platform_free_shipping IS NULL
               THEN _ship_fee ELSE _product.platform_shipping_fee END);
      END IF;
    END IF;

    SELECT * INTO _lp FROM public.line_pricing(_product.id, _unit_price, _qty);
    IF _lp.deal_id IS NOT NULL AND _lp.sale_units > 0 THEN
      UPDATE public.daily_deals SET sold_quantity = sold_quantity + _lp.sale_units WHERE id = _lp.deal_id;
    END IF;
    _line_sub := _lp.sale_units * _lp.sale_unit + (_qty - _lp.sale_units) * _lp.regular_unit;
    _idx := _idx + 1;
    _lines := _lines || jsonb_build_object('idx', _idx, 'product_id', _product.id, 'variant_id', _variant_id,
      'vendor_id', _product.vendor_id, 'currency', _row_currency, 'qty', _qty, 'base', _unit_price,
      'sale_units', _lp.sale_units, 'sale_unit', _lp.sale_unit, 'regular_unit', _lp.regular_unit,
      'deal_id', _lp.deal_id, 'subtotal', _line_sub);

    _subtotal := _subtotal + _line_sub;
    IF _row_kind = 'seller' AND NOT _apply_all THEN
      _shipping := _shipping + _product.shipping_cost;
    END IF;
  END LOOP;

  _currency := COALESCE(_currency, 'SYP');

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
    SELECT * INTO _coupon FROM public.coupons c WHERE c.code = upper(btrim(_coupon_code)) FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Invalid or expired coupon: NOT_FOUND'; END IF;
    SELECT * INTO _alloc FROM public.coupon_allocate(_coupon, _uid, _lines);
    IF _alloc.error IS NOT NULL THEN RAISE EXCEPTION 'Invalid or expired coupon: %', _alloc.error; END IF;
    UPDATE public.coupons c SET used_count = c.used_count + 1 WHERE c.id = _coupon.id;
    _discount := LEAST(_alloc.discount, _subtotal);
    _coupon_code_final := _coupon.code;
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
    currency,
    pickup_center_id, pickup_center_name, pickup_center_address, pickup_center_phone,
    pickup_center_governorate, pickup_center_city
  ) VALUES (
    _uid, _total, _subtotal, _shipping, 0,
    _shipping_address, _phone, _notes, 'pending', 'pending',
    _coupon_code_final, _discount, _kind, _pay_method, _order_duration,
    _currency,
    _center.id, _center.name, _center.address, _center.phone,
    _center.governorate, _center.city
  ) RETURNING id INTO _order_id;

  IF _coupon_code_final IS NOT NULL THEN
    INSERT INTO public.coupon_redemptions (coupon_id, order_id, customer_id, vendor_id, coupon_code,
      units, discount_amount, currency, status)
    VALUES (_coupon.id, _order_id, _uid, _coupon.vendor_id, _coupon.code,
      _alloc.units, _discount, _currency, 'reserved');
  END IF;

  INSERT INTO public.order_status_history (
    order_id, status, from_status, changed_by, changed_by_role, notes, is_override
  ) VALUES (_order_id, 'pending', NULL, _uid, 'buyer', 'تم إنشاء الطلب', false);

  PERFORM set_config('app.stock_reason', 'sale', true);

  FOR _line IN SELECT * FROM jsonb_array_elements(_lines)
  LOOP
    _qty := (_line->>'qty')::int;
    SELECT p.id, p.price, p.vendor_id, p.name, p.image_url, p.shipping_duration_text
      INTO _product FROM public.products p WHERE p.id = (_line->>'product_id')::uuid;

    _variant_id := NULLIF(_line->>'variant_id','')::uuid;
    _variant_label := NULL;
    _variant_image := NULL;

    IF _variant_id IS NOT NULL THEN
      SELECT v.attributes, v.image_url INTO _variant FROM public.product_variants v WHERE v.id = _variant_id;
      _variant_image := _variant.image_url;
      SELECT string_agg(kv.key || ': ' || kv.value, ' / ')
        INTO _variant_label
        FROM jsonb_each_text(COALESCE(_variant.attributes, '{}'::jsonb)) AS kv;

      UPDATE public.product_variants
         SET stock_quantity = GREATEST(COALESCE(stock_quantity,0) - _qty, 0), updated_at = now()
       WHERE id = _variant_id;
    END IF;

    _line_sub := (_line->>'subtotal')::numeric;
    _line_coupon := 0; _line_coupon_units := 0;
    IF _coupon_code_final IS NOT NULL THEN
      SELECT COALESCE((a->>'discount')::numeric, 0), COALESCE((a->>'units')::int, 0)
        INTO _line_coupon, _line_coupon_units
        FROM jsonb_array_elements(_alloc.alloc) a WHERE (a->>'idx')::int = (_line->>'idx')::int;
      _line_coupon := COALESCE(_line_coupon, 0); _line_coupon_units := COALESCE(_line_coupon_units, 0);
    END IF;

    INSERT INTO public.order_items (
      order_id, product_id, vendor_id, quantity, price, variant_id, variant_label,
      discount_amount, subtotal, product_name, product_image, shipping_duration_text, currency,
      original_price, sale_discount, coupon_discount, coupon_code, coupon_units, deal_id, sale_units
    ) VALUES (
      _order_id, _product.id, _product.vendor_id, _qty, round(_line_sub / _qty, 2), _variant_id, _variant_label,
      _line_coupon, _line_sub, _product.name,
      COALESCE(_variant_image, _product.image_url), _product.shipping_duration_text, _currency,
      (_line->>'base')::numeric, GREATEST((_line->>'base')::numeric * _qty - _line_sub, 0), _line_coupon,
      CASE WHEN _line_coupon > 0 THEN _coupon_code_final END, _line_coupon_units,
      NULLIF(_line->>'deal_id','')::uuid, (_line->>'sale_units')::int
    );

    UPDATE public.products
       SET stock_quantity = GREATEST(COALESCE(stock_quantity, 0) - _qty, 0), updated_at = now()
     WHERE id = _product.id;
  END LOOP;

  PERFORM set_config('app.stock_reason', '', true);
  PERFORM set_config('app.coupon_redeem', 'off', true);

  SELECT count(DISTINCT oi.vendor_id) INTO _vendor_count
    FROM public.order_items oi WHERE oi.order_id = _order_id AND oi.vendor_id IS NOT NULL;

  IF _vendor_count > 0 THEN
    FOR _vendor IN
      SELECT oi.vendor_id,
             SUM(COALESCE(oi.subtotal, oi.price * oi.quantity)) AS vsub,
             SUM(COALESCE(oi.coupon_discount, 0)) AS vdisc,
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
        coupon_code, discount_amount, order_kind, payment_method, shipping_duration_text, currency,
        pickup_center_id, pickup_center_name, pickup_center_address, pickup_center_phone,
        pickup_center_governorate, pickup_center_city
      ) VALUES (
        _uid, _order_id, _vendor.vendor_id,
        GREATEST(_vendor.vsub + _vendor.vship - _vendor.vdisc, 0), _vendor.vsub, _vendor.vship, 0,
        _shipping_address, _phone, _notes, 'pending', 'pending',
        CASE WHEN _vendor.vdisc > 0 THEN _coupon_code_final END, _vendor.vdisc,
        _kind, _pay_method, _order_duration, _currency,
        _center.id, _center.name, _center.address, _center.phone,
        _center.governorate, _center.city
      );
    END LOOP;
  END IF;

  INSERT INTO public.payments (
    order_id, payment_method, amount, payment_status, transaction_id, payment_details, currency
  ) VALUES (
    _order_id, _pay_method, _total, 'pending',
    _txn_prefix || extract(epoch from now())::bigint::text,
    jsonb_build_object('method', _pay_method), _currency
  );

  DELETE FROM public.cart_items
   WHERE user_id = _uid
     AND product_id IN (SELECT (i->>'product_id')::uuid FROM jsonb_array_elements(_items) AS i);

  RETURN _order_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.order_promo_reservations()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _root uuid := COALESCE(NEW.parent_order_id, NEW.id); _st text := lower(COALESCE(NEW.status, '')); _r record;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  IF _st IN ('cancelled', 'canceled', 'rejected', 'failed') THEN
    PERFORM set_config('app.coupon_redeem', 'on', true);
    FOR _r IN
      UPDATE public.coupon_redemptions r SET status = 'released', updated_at = now()
       WHERE r.order_id = _root AND r.status = 'reserved'
         AND (NEW.parent_order_id IS NULL OR r.vendor_id = NEW.vendor_id)
      RETURNING r.coupon_id
    LOOP
      UPDATE public.coupons SET used_count = GREATEST(used_count - 1, 0) WHERE id = _r.coupon_id;
    END LOOP;
    FOR _r IN
      UPDATE public.order_items oi SET sale_released = true
       WHERE oi.order_id = _root AND NOT oi.sale_released AND oi.sale_units > 0 AND oi.deal_id IS NOT NULL
         AND (NEW.parent_order_id IS NULL OR oi.vendor_id = NEW.vendor_id)
      RETURNING oi.deal_id, oi.sale_units
    LOOP
      UPDATE public.daily_deals SET sold_quantity = GREATEST(sold_quantity - _r.sale_units, 0) WHERE id = _r.deal_id;
    END LOOP;
    PERFORM set_config('app.coupon_redeem', 'off', true);
  ELSIF _st IN ('delivered', 'completed') THEN
    UPDATE public.coupon_redemptions r SET status = 'used', updated_at = now()
     WHERE r.order_id = _root AND r.status = 'reserved'
       AND (NEW.parent_order_id IS NULL OR r.vendor_id = NEW.vendor_id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_order_promo_reservations ON public.orders;
CREATE TRIGGER trg_order_promo_reservations AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.order_promo_reservations();

CREATE OR REPLACE FUNCTION public.seller_coupon_stats()
RETURNS TABLE(coupon_id uuid, reserved_units bigint, used_units bigint, redemptions bigint, customers bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id,
         COALESCE(sum(r.units) FILTER (WHERE r.status = 'reserved'), 0),
         COALESCE(sum(r.units) FILTER (WHERE r.status = 'used'), 0),
         count(r.id) FILTER (WHERE r.status <> 'released'),
         count(DISTINCT r.customer_id) FILTER (WHERE r.status <> 'released')
    FROM public.coupons c
    LEFT JOIN public.coupon_redemptions r ON r.coupon_id = c.id
   WHERE c.vendor_id = auth.uid() OR public.has_any_admin_role(auth.uid())
   GROUP BY c.id
$$;

REVOKE EXECUTE ON FUNCTION public.coupon_allocate(public.coupons, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.build_cart_lines(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.seller_coupon_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seller_coupon_stats() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.redeem_coupon(text, numeric) FROM authenticated;