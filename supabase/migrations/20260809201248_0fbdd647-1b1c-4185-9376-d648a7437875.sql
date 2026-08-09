-- 1. FEATURE FLAGS -------------------------------------------------------
CREATE TABLE public.feature_flags (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  label_ar text NOT NULL,
  description text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.feature_flags TO anon;
GRANT SELECT, UPDATE ON public.feature_flags TO authenticated;
GRANT ALL ON public.feature_flags TO service_role;

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read feature flags"
  ON public.feature_flags FOR SELECT USING (true);

CREATE POLICY "Super admins can update feature flags"
  ON public.feature_flags FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_feature_flags_updated_at
  BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.feature_flags (key, enabled, label_ar, description) VALUES
  ('platform_marketplace', false, 'سوق المنصة (منتجات مستوردة من تركيا)', 'Phase 2: enables visibility and purchase of platform (imported) products.'),
  ('sham_cash_payments', false, 'مدفوعات شام كاش', 'Phase 2: enables Sham Cash as the payment method for platform orders.');

CREATE OR REPLACE FUNCTION public.is_feature_enabled(_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT enabled FROM public.feature_flags WHERE key = _key), false)
$$;

GRANT EXECUTE ON FUNCTION public.is_feature_enabled(text) TO anon, authenticated, service_role;

-- 2. HIDE PLATFORM PRODUCTS WHILE PHASE 2 IS OFF -------------------------
DROP POLICY "Anyone can view approved active products" ON public.products;

CREATE POLICY "Anyone can view approved active products"
  ON public.products FOR SELECT
  USING (
    is_active = true
    AND moderation_status = 'approved'
    AND (product_type <> 'platform' OR public.is_feature_enabled('platform_marketplace'))
  );

-- 3. GATE PLATFORM ORDERS / SHAM CASH IN create_order --------------------
CREATE OR REPLACE FUNCTION public.create_order(
  _items jsonb,
  _phone text,
  _shipping_address text,
  _notes text DEFAULT NULL,
  _coupon_code text DEFAULT NULL
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
  _qty int;
  _kind text := NULL;
  _row_kind text;
  _pay_method text;
  _txn_prefix text;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'Cart is empty';
  END IF;
  FOR _item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    _qty := COALESCE((_item->>'quantity')::int, 0);
    IF _qty <= 0 THEN
      RAISE EXCEPTION 'Invalid quantity';
    END IF;
    SELECT p.id, p.price, p.vendor_id, COALESCE(p.shipping_cost, 0) AS shipping_cost,
           COALESCE(p.is_active, false) AS is_active, p.moderation_status, p.product_type
      INTO _product
      FROM public.products p
     WHERE p.id = (_item->>'product_id')::uuid;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product not found';
    END IF;
    IF _product.is_active IS NOT TRUE OR _product.moderation_status <> 'approved' THEN
      RAISE EXCEPTION 'Product unavailable';
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
  FOR _item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    _qty := COALESCE((_item->>'quantity')::int, 0);
    SELECT p.id, p.price, p.vendor_id
      INTO _product
      FROM public.products p
     WHERE p.id = (_item->>'product_id')::uuid;
    INSERT INTO public.order_items (order_id, product_id, vendor_id, quantity, price)
    VALUES (_order_id, _product.id, _product.vendor_id, _qty, _product.price);
  END LOOP;
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

-- 4. SHAM CASH MERCHANT CONFIG (non-secret fields only) -------------------
CREATE TABLE public.sham_cash_merchant_config (
  id integer PRIMARY KEY DEFAULT 1,
  merchant_id text,
  environment text NOT NULL DEFAULT 'sandbox',
  api_base_url text,
  callback_url text,
  is_active boolean NOT NULL DEFAULT false,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sham_cash_single_row CHECK (id = 1),
  CONSTRAINT sham_cash_env_valid CHECK (environment IN ('sandbox', 'live'))
);

GRANT SELECT, INSERT, UPDATE ON public.sham_cash_merchant_config TO authenticated;
GRANT ALL ON public.sham_cash_merchant_config TO service_role;

ALTER TABLE public.sham_cash_merchant_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage sham cash merchant config"
  ON public.sham_cash_merchant_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_sham_cash_config_updated_at
  BEFORE UPDATE ON public.sham_cash_merchant_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.sham_cash_merchant_config (id, environment, is_active)
VALUES (1, 'sandbox', false);

-- 5. PAYMENT TRANSACTIONS -------------------------------------------------
CREATE TABLE public.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'sham_cash',
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'SYP',
  status text NOT NULL DEFAULT 'pending',
  provider_reference text,
  idempotency_key text UNIQUE,
  provider_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_txn_status_valid CHECK (status IN ('pending','processing','succeeded','failed','refunded','cancelled'))
);

CREATE INDEX idx_payment_transactions_order ON public.payment_transactions(order_id);
CREATE INDEX idx_payment_transactions_reference ON public.payment_transactions(provider_reference);

GRANT SELECT ON public.payment_transactions TO authenticated;
GRANT ALL ON public.payment_transactions TO service_role;

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can view their own payment transactions"
  ON public.payment_transactions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o
     WHERE o.id = payment_transactions.order_id
       AND o.customer_id = auth.uid()
  ));

CREATE POLICY "Admins can view all payment transactions"
  ON public.payment_transactions FOR SELECT TO authenticated
  USING (public.has_any_admin_role(auth.uid()));

CREATE TRIGGER trg_payment_transactions_updated_at
  BEFORE UPDATE ON public.payment_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. PAYMENT WEBHOOK EVENT LOG -------------------------------------------
CREATE TABLE public.payment_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'sham_cash',
  event_id text,
  event_type text,
  signature_valid boolean NOT NULL DEFAULT false,
  processed boolean NOT NULL DEFAULT false,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_webhook_event_unique UNIQUE (provider, event_id)
);

GRANT SELECT ON public.payment_webhook_events TO authenticated;
GRANT ALL ON public.payment_webhook_events TO service_role;

ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view payment webhook events"
  ON public.payment_webhook_events FOR SELECT TO authenticated
  USING (public.has_any_admin_role(auth.uid()));