ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS product_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'SYP';
ALTER TABLE public.coupons ADD CONSTRAINT coupons_currency_check CHECK (currency IN ('SYP','USD'));

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sold_count integer NOT NULL DEFAULT 0;
UPDATE public.products p SET sold_count = s.q
  FROM (SELECT oi.product_id, SUM(oi.quantity)::int q
          FROM public.order_items oi JOIN public.orders o ON o.id = oi.order_id
         WHERE o.status NOT IN ('cancelled','refunded') GROUP BY oi.product_id) s
 WHERE s.product_id = p.id;
CREATE INDEX IF NOT EXISTS idx_products_sold_count ON public.products (sold_count DESC);

CREATE OR REPLACE FUNCTION public.bump_product_sold_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.product_id IS NOT NULL THEN
    UPDATE public.products SET sold_count = sold_count + COALESCE(NEW.quantity,0) WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_bump_product_sold_count ON public.order_items;
CREATE TRIGGER trg_bump_product_sold_count AFTER INSERT ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.bump_product_sold_count();

CREATE OR REPLACE FUNCTION public.quote_cart_coupon(_code text, _items jsonb)
RETURNS TABLE(id uuid, code text, vendor_id uuid, discount_type text, discount_value numeric,
              currency text, eligible_subtotal numeric, discount_amount numeric, error text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _c public.coupons%ROWTYPE;
  _elig numeric := 0;
  _cur text := NULL;
  _amt numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO _c FROM public.coupons c
   WHERE c.code = upper(btrim(_code)) AND c.is_active
     AND (c.expires_at IS NULL OR c.expires_at > now())
     AND (c.max_uses IS NULL OR c.used_count < c.max_uses);
  IF NOT FOUND THEN RETURN; END IF;

  SELECT COALESCE(SUM(COALESCE(v.discount_price, v.price, p.price) * GREATEST((i->>'quantity')::int, 0)), 0),
         MIN(COALESCE(NULLIF(upper(btrim(p.currency)), ''), 'SYP'))
    INTO _elig, _cur
    FROM jsonb_array_elements(COALESCE(_items,'[]'::jsonb)) i
    JOIN public.products p ON p.id = (i->>'product_id')::uuid
    LEFT JOIN public.product_variants v
      ON v.id = NULLIF(i->>'variant_id','')::uuid AND v.product_id = p.id
   WHERE p.vendor_id = _c.vendor_id
     AND cardinality(_c.product_ids) > 0
     AND p.id = ANY(_c.product_ids);

  id := _c.id; code := _c.code; vendor_id := _c.vendor_id;
  discount_type := _c.discount_type; discount_value := _c.discount_value;
  currency := COALESCE(_cur, _c.currency); eligible_subtotal := _elig;

  IF _elig <= 0 THEN error := 'NOT_ELIGIBLE'; discount_amount := 0; RETURN NEXT; RETURN; END IF;
  IF _c.discount_type = 'fixed' AND _cur <> _c.currency THEN
    error := 'CURRENCY_MISMATCH'; discount_amount := 0; RETURN NEXT; RETURN;
  END IF;
  IF _c.min_purchase IS NOT NULL AND _elig < _c.min_purchase THEN
    error := 'MIN_PURCHASE'; discount_amount := 0; RETURN NEXT; RETURN;
  END IF;
  _amt := CASE WHEN _c.discount_type = 'percentage' THEN _elig * _c.discount_value / 100.0
               ELSE _c.discount_value END;
  discount_amount := round(LEAST(_amt, _elig), 2);
  error := NULL;
  RETURN NEXT;
END $$;
REVOKE ALL ON FUNCTION public.quote_cart_coupon(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quote_cart_coupon(text, jsonb) TO authenticated;

DO $do$
DECLARE _def text; _a int; _b int;
BEGIN
  _def := pg_get_functiondef('public.create_order(jsonb,text,text,text,text,text,uuid)'::regprocedure);
  _a := strpos(_def, '  IF _coupon_code IS NOT NULL');
  _b := strpos(_def, '  _total := GREATEST(_subtotal + _shipping - _discount, 0);');
  IF _a = 0 OR _b = 0 OR _b < _a THEN RAISE EXCEPTION 'create_order markers not found'; END IF;
  _def := substr(_def, 1, _a - 1) || $blk$  IF _coupon_code IS NOT NULL AND length(trim(_coupon_code)) > 0 THEN
    -- Seller-scoped coupons: discount only the coupon owner's selected products.
    SELECT q.id, q.discount_amount, q.code
      INTO _coupon_id, _coupon_amount, _coupon_code_final
      FROM public.quote_cart_coupon(_coupon_code, _items) AS q WHERE q.error IS NULL LIMIT 1;
    IF _coupon_id IS NULL THEN RAISE EXCEPTION 'Invalid or expired coupon'; END IF;
    PERFORM set_config('app.coupon_redeem', 'on', true);
    UPDATE public.coupons c SET used_count = c.used_count + 1
     WHERE c.id = _coupon_id AND (c.max_uses IS NULL OR c.used_count < c.max_uses);
    IF NOT FOUND THEN
      PERFORM set_config('app.coupon_redeem', 'off', true);
      RAISE EXCEPTION 'Invalid or expired coupon';
    END IF;
    PERFORM set_config('app.coupon_redeem', 'off', true);
    _discount := LEAST(COALESCE(_coupon_amount, 0), _subtotal);
  END IF;

$blk$ || substr(_def, _b);
  EXECUTE _def;
END
$do$;