
-- 2) Atomic coupon redemption
CREATE OR REPLACE FUNCTION public.redeem_coupon(_code text, _subtotal numeric)
RETURNS TABLE (
  id uuid,
  code text,
  discount_type text,
  discount_value numeric,
  discount_amount numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.coupons%ROWTYPE;
  _amount numeric;
BEGIN
  UPDATE public.coupons c
     SET used_count = c.used_count + 1
   WHERE c.code = upper(_code)
     AND (c.expires_at IS NULL OR c.expires_at > now())
     AND (c.max_uses IS NULL OR c.used_count < c.max_uses)
     AND (c.min_purchase IS NULL OR _subtotal >= c.min_purchase)
  RETURNING * INTO _row;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF _row.discount_type = 'percentage' THEN
    _amount := (_subtotal * _row.discount_value) / 100.0;
  ELSE
    _amount := _row.discount_value;
  END IF;

  id := _row.id;
  code := _row.code;
  discount_type := _row.discount_type;
  discount_value := _row.discount_value;
  discount_amount := _amount;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_coupon(text, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.redeem_coupon(text, numeric) FROM anon;
GRANT EXECUTE ON FUNCTION public.redeem_coupon(text, numeric) TO authenticated;

-- 1) Server-side order creation
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
AS $$
DECLARE
  _uid uuid := auth.uid();
  _subtotal numeric := 0;
  _shipping numeric := 0;
  _discount numeric := 0;
  _total numeric := 0;
  _order_id uuid;
  _coupon record;
  _item jsonb;
  _product record;
  _qty int;
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

    SELECT p.id, p.price, p.vendor_id, COALESCE(p.shipping_cost, 0) AS shipping_cost
      INTO _product
      FROM public.products p
     WHERE p.id = (_item->>'product_id')::uuid;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product not found';
    END IF;

    _subtotal := _subtotal + (_product.price * _qty);
    _shipping := _shipping + _product.shipping_cost;
  END LOOP;

  IF _coupon_code IS NOT NULL AND length(trim(_coupon_code)) > 0 THEN
    SELECT * INTO _coupon FROM public.redeem_coupon(_coupon_code, _subtotal);
    IF _coupon.id IS NULL THEN
      RAISE EXCEPTION 'Invalid or expired coupon';
    END IF;
    _discount := _coupon.discount_amount;
  END IF;

  _total := GREATEST(_subtotal + _shipping - _discount, 0);

  INSERT INTO public.orders (
    customer_id, total_amount, phone, shipping_address, notes,
    status, coupon_code, discount_amount
  )
  VALUES (
    _uid, _total, _phone, _shipping_address, _notes,
    'pending', _coupon.code, _discount
  )
  RETURNING id INTO _order_id;

  INSERT INTO public.order_items (order_id, product_id, vendor_id, quantity, price)
  SELECT
    _order_id,
    p.id,
    p.vendor_id,
    (i->>'quantity')::int,
    p.price
  FROM jsonb_array_elements(_items) AS i
  JOIN public.products p ON p.id = (i->>'product_id')::uuid;

  DELETE FROM public.cart_items WHERE user_id = _uid;

  RETURN _order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_order(jsonb, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_order(jsonb, text, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_order(jsonb, text, text, text, text) TO authenticated;

-- 3) Vendor order status update RPC + remove broad UPDATE policy
DROP POLICY IF EXISTS "Vendors can update orders with their products" ON public.orders;

CREATE OR REPLACE FUNCTION public.vendor_update_order_status(
  _order_id uuid,
  _status text,
  _tracking_number text DEFAULT NULL,
  _courier_name text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _is_vendor boolean;
  _is_admin boolean;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.order_items
     WHERE order_id = _order_id AND vendor_id = _uid
  ) INTO _is_vendor;

  SELECT public.has_role(_uid, 'admin') INTO _is_admin;

  IF NOT (_is_vendor OR _is_admin) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF _status NOT IN ('pending','confirmed','processing','shipped','out_for_delivery','delivered','cancelled') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  UPDATE public.orders
     SET status = _status,
         tracking_number = COALESCE(_tracking_number, tracking_number),
         courier_name = COALESCE(_courier_name, courier_name),
         updated_at = now()
   WHERE id = _order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.vendor_update_order_status(uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vendor_update_order_status(uuid, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.vendor_update_order_status(uuid, text, text, text) TO authenticated;

-- 4) Storage product-images INSERT must enforce folder ownership
DROP POLICY IF EXISTS "Vendors can upload product images" ON storage.objects;
CREATE POLICY "Vendors can upload product images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = (auth.uid())::text
  AND public.has_role(auth.uid(), 'vendor')
);

-- 5) Allow anonymous push subscriptions to be deleted (by their owner via endpoint match in app code)
DROP POLICY IF EXISTS "Anonymous subscriptions can be deleted" ON public.push_subscriptions;
CREATE POLICY "Anonymous subscriptions can be deleted"
ON public.push_subscriptions
FOR DELETE
TO anon, authenticated
USING (user_id IS NULL);

-- 6) Contact messages DB-level rate limit (trigger)
CREATE OR REPLACE FUNCTION public.enforce_contact_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _recent_count int;
  _email_hash text;
BEGIN
  _email_hash := encode(extensions.digest(lower(coalesce(NEW.email, '')), 'sha256'), 'hex');

  SELECT count(*) INTO _recent_count
    FROM public.contact_rate_limits
   WHERE email_hash = _email_hash
     AND created_at > now() - interval '1 hour';

  IF _recent_count >= 3 THEN
    RAISE EXCEPTION 'Rate limit exceeded: too many submissions in the last hour';
  END IF;

  INSERT INTO public.contact_rate_limits (email_hash, ip_hash)
  VALUES (_email_hash, _email_hash);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contact_messages_rate_limit ON public.contact_messages;
CREATE TRIGGER contact_messages_rate_limit
BEFORE INSERT ON public.contact_messages
FOR EACH ROW EXECUTE FUNCTION public.enforce_contact_rate_limit();

-- 7) Realtime: exclude GPS columns from order_status_history broadcasts
ALTER PUBLICATION supabase_realtime DROP TABLE public.order_status_history;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_status_history (id, order_id, status, notes, created_at);
