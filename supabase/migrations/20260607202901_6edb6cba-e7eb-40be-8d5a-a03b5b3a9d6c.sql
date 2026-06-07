
-- 1) ORDERS: drop the permissive customer UPDATE policy.
DROP POLICY IF EXISTS "Customers can update their own orders" ON public.orders;

-- 2) PAYMENTS: drop the customer-controlled INSERT policy and replace with SECURITY DEFINER RPC.
DROP POLICY IF EXISTS "Users can create payments for their orders" ON public.payments;

CREATE OR REPLACE FUNCTION public.record_payment(
  _order_id uuid,
  _payment_method text,
  _payment_details jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _order public.orders%ROWTYPE;
  _payment_id uuid;
  _status text;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO _order FROM public.orders WHERE id = _order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF _order.customer_id <> _uid THEN
    RAISE EXCEPTION 'Forbidden';
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
$$;

REVOKE EXECUTE ON FUNCTION public.record_payment(uuid, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_payment(uuid, text, jsonb) TO authenticated;

-- 3) COUPONS: split ALL policy and block tampering with used_count.
DROP POLICY IF EXISTS "Vendors can manage their own coupons" ON public.coupons;

CREATE POLICY "Vendors can view their own coupons"
  ON public.coupons FOR SELECT TO authenticated
  USING (auth.uid() = vendor_id);

CREATE POLICY "Vendors can insert their own coupons"
  ON public.coupons FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = vendor_id AND COALESCE(used_count, 0) = 0);

CREATE POLICY "Vendors can update their own coupons"
  ON public.coupons FOR UPDATE TO authenticated
  USING (auth.uid() = vendor_id)
  WITH CHECK (auth.uid() = vendor_id);

CREATE POLICY "Vendors can delete their own coupons"
  ON public.coupons FOR DELETE TO authenticated
  USING (auth.uid() = vendor_id);

CREATE OR REPLACE FUNCTION public.prevent_coupon_used_count_tamper()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.used_count IS DISTINCT FROM OLD.used_count
     AND COALESCE(current_setting('app.coupon_redeem', true), '') <> 'on' THEN
    RAISE EXCEPTION 'used_count can only be modified by redeem_coupon()';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_coupon_used_count_tamper ON public.coupons;
CREATE TRIGGER trg_prevent_coupon_used_count_tamper
  BEFORE UPDATE ON public.coupons
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_coupon_used_count_tamper();

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
  PERFORM set_config('app.coupon_redeem', 'on', true);

  UPDATE public.coupons c
     SET used_count = c.used_count + 1
   WHERE c.code = upper(_code)
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

-- 4) STORAGE: drop the broad SELECT policy that lets clients list every file
--    in the review-images public bucket. Direct CDN URLs still work.
DROP POLICY IF EXISTS "Public can view review images" ON storage.objects;
