
-- 1) Coupons: drop public SELECT, add validation RPC
DROP POLICY IF EXISTS "Anyone can view active coupons" ON public.coupons;

CREATE OR REPLACE FUNCTION public.validate_coupon(_code text, _subtotal numeric)
RETURNS TABLE (
  id uuid,
  vendor_id uuid,
  discount_type text,
  discount_value numeric,
  min_purchase numeric,
  max_uses integer,
  used_count integer,
  expires_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.vendor_id, c.discount_type, c.discount_value,
         c.min_purchase, c.max_uses, c.used_count, c.expires_at
  FROM public.coupons c
  WHERE c.code = upper(_code)
    AND c.is_active = true
    AND (c.expires_at IS NULL OR c.expires_at > now())
    AND (c.max_uses IS NULL OR c.used_count < c.max_uses)
    AND (c.min_purchase IS NULL OR c.min_purchase <= _subtotal)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.validate_coupon(text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_coupon(text, numeric) TO authenticated;

-- 2) Orders: drop vendor SELECT row policy, expose only fulfillment fields via RPC
DROP POLICY IF EXISTS "Vendors can view orders with their products" ON public.orders;

CREATE OR REPLACE FUNCTION public.get_vendor_orders()
RETURNS TABLE (
  id uuid,
  created_at timestamptz,
  status text,
  total_amount numeric,
  customer_name text,
  city text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT
    o.id,
    o.created_at,
    o.status,
    o.total_amount,
    p.full_name AS customer_name,
    -- Expose only the city portion (text before first comma) of shipping_address
    NULLIF(split_part(COALESCE(o.shipping_address, ''), ',', 1), '') AS city
  FROM public.orders o
  JOIN public.order_items oi ON oi.order_id = o.id
  LEFT JOIN public.profiles p ON p.id = o.customer_id
  WHERE oi.vendor_id = auth.uid()
  ORDER BY o.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_vendor_orders() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_vendor_orders() TO authenticated;

-- 3) Realtime channel authorization
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can subscribe to own user channel" ON realtime.messages;
CREATE POLICY "Users can subscribe to own user channel"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() = 'user:' || auth.uid()::text
  OR realtime.topic() LIKE 'public:%'
);

DROP POLICY IF EXISTS "Users can broadcast to own user channel" ON realtime.messages;
CREATE POLICY "Users can broadcast to own user channel"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() = 'user:' || auth.uid()::text
);

-- 4) Product images: scope UPDATE/DELETE to owning vendor's folder
DROP POLICY IF EXISTS "Vendors can update their product images" ON storage.objects;
DROP POLICY IF EXISTS "Vendors can delete their product images" ON storage.objects;

CREATE POLICY "Vendors can update their own product images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND public.has_role(auth.uid(), 'vendor')
)
WITH CHECK (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Vendors can delete their own product images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND public.has_role(auth.uid(), 'vendor')
);
