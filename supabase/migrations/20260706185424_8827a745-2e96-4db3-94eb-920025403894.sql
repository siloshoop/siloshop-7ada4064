CREATE OR REPLACE FUNCTION public.create_order(_items jsonb, _phone text, _shipping_address text, _notes text DEFAULT NULL::text, _coupon_code text DEFAULT NULL::text)
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
    _coupon_id := NULL;
    _coupon_amount := 0;
    SELECT rc.id, rc.discount_amount
      INTO _coupon_id, _coupon_amount
      FROM public.redeem_coupon(_coupon_code, _subtotal) AS rc
      LIMIT 1;
    IF _coupon_id IS NULL THEN
      RAISE EXCEPTION 'Invalid or expired coupon';
    END IF;
    _discount := COALESCE(_coupon_amount, 0);
  END IF;

  _total := GREATEST(_subtotal + _shipping - _discount, 0);

  INSERT INTO public.orders (
    customer_id, total_amount, shipping_address, phone, notes, status, payment_status
  ) VALUES (
    _uid, _total, _shipping_address, _phone, _notes, 'pending', 'pending'
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

  RETURN _order_id;
END;
$function$;