CREATE OR REPLACE FUNCTION public.quote_cart_coupon(_code text, _items jsonb)
 RETURNS TABLE(id uuid, code text, vendor_id uuid, discount_type text, discount_value numeric, currency text, eligible_subtotal numeric, discount_amount numeric, error text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _c public.coupons%ROWTYPE; _a record; _n int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO _c FROM public.coupons c WHERE c.code = upper(btrim(_code));
  IF NOT FOUND THEN RETURN; END IF;
  id := _c.id; code := _c.code; vendor_id := _c.vendor_id;
  discount_type := _c.discount_type; discount_value := _c.discount_value;
  currency := _c.currency;
  -- Same rule as the app and create_order: coupons never apply to mixed-currency carts.
  SELECT count(DISTINCT upper(btrim(p.currency))) INTO _n
    FROM jsonb_array_elements(COALESCE(_items, '[]'::jsonb)) i
    JOIN public.products p ON p.id = NULLIF(i->>'product_id','')::uuid;
  IF _n > 1 THEN
    eligible_subtotal := 0; discount_amount := 0; error := 'MIXED_CURRENCY';
    RETURN NEXT; RETURN;
  END IF;
  SELECT * INTO _a FROM public.coupon_allocate(_c, auth.uid(), public.build_cart_lines(_items));
  eligible_subtotal := _a.eligible;
  discount_amount := CASE WHEN _a.error IS NULL THEN _a.discount ELSE 0 END;
  error := _a.error;
  RETURN NEXT;
END $function$;