
-- 1) Vendor SELECT on orders (so vendors can read orders they have items in)
DROP POLICY IF EXISTS "Vendors can view orders with their items" ON public.orders;
CREATE POLICY "Vendors can view orders with their items"
ON public.orders
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.order_items oi
    WHERE oi.order_id = orders.id AND oi.vendor_id = auth.uid()
  )
);

-- 2) Restrict "anonymous" push_subscriptions insert to the anon role only
DROP POLICY IF EXISTS "Anyone can insert anonymous push subscription" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Anonymous can insert push subscription" ON public.push_subscriptions;
DROP POLICY IF EXISTS "anon_insert_push_subscription" ON public.push_subscriptions;
CREATE POLICY "Anon role can insert anonymous push subscription"
ON public.push_subscriptions
FOR INSERT
TO anon
WITH CHECK (user_id IS NULL);

-- 3) Harden record_payment: block double payment / re-confirmation
CREATE OR REPLACE FUNCTION public.record_payment(_order_id uuid, _payment_method text, _payment_details jsonb DEFAULT '{}'::jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _order public.orders%ROWTYPE;
  _payment_id uuid;
  _status text;
  _existing_completed int;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO _order FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF _order.customer_id <> _uid THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  -- Block re-paying an already-paid/cancelled/shipped order
  IF _order.status NOT IN ('pending') THEN
    RAISE EXCEPTION 'Order is not payable in its current state';
  END IF;

  SELECT count(*) INTO _existing_completed
    FROM public.payments
    WHERE order_id = _order_id
      AND payment_status = 'completed';
  IF _existing_completed > 0 THEN
    RAISE EXCEPTION 'Order already paid';
  END IF;

  IF _payment_method NOT IN ('cash','syriatel','mtn','card','bank_transfer') THEN
    RAISE EXCEPTION 'Invalid payment method';
  END IF;

  _status := CASE WHEN _payment_method = 'cash' THEN 'pending' ELSE 'completed' END;

  INSERT INTO public.payments (
    order_id, payment_method, amount, payment_status, transaction_id, payment_details
  ) VALUES (
    _order_id,
    _payment_method,
    _order.total_amount,
    _status,
    'TXN-' || extract(epoch from now())::bigint::text,
    COALESCE(_payment_details, '{}'::jsonb)
  )
  RETURNING id INTO _payment_id;

  UPDATE public.orders
     SET status = 'confirmed', updated_at = now()
   WHERE id = _order_id;

  RETURN _payment_id;
END;
$function$;

-- 4) Defense-in-depth: revoke direct UPDATE on coupons.used_count from vendors
-- The trigger already blocks tampering, but column-level GRANT removes the privilege entirely.
DROP POLICY IF EXISTS "Vendors can update their coupons" ON public.coupons;
CREATE POLICY "Vendors can update their coupons"
ON public.coupons
FOR UPDATE
TO authenticated
USING (auth.uid() = vendor_id)
WITH CHECK (auth.uid() = vendor_id);

REVOKE UPDATE (used_count) ON public.coupons FROM authenticated;
-- service_role and the SECURITY DEFINER redeem_coupon (owned by postgres) retain write access.

-- 5) Harden redeem_coupon: add per-call sanity (subtotal non-negative)
CREATE OR REPLACE FUNCTION public.redeem_coupon(_code text, _subtotal numeric)
RETURNS TABLE(id uuid, code text, discount_type text, discount_value numeric, discount_amount numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _row public.coupons%ROWTYPE;
  _amount numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _subtotal IS NULL OR _subtotal < 0 THEN
    RAISE EXCEPTION 'Invalid subtotal';
  END IF;

  PERFORM set_config('app.coupon_redeem', 'on', true);

  UPDATE public.coupons c
     SET used_count = c.used_count + 1
   WHERE c.code = upper(_code)
     AND c.is_active = true
     AND (c.expires_at IS NULL OR c.expires_at > now())
     AND (c.max_uses IS NULL OR c.used_count < c.max_uses)
     AND (c.min_purchase IS NULL OR _subtotal >= c.min_purchase)
  RETURNING * INTO _row;

  PERFORM set_config('app.coupon_redeem', 'off', true);

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
$function$;
