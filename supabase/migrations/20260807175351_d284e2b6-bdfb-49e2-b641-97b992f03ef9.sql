-- 1) allow 'archived' status
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_moderation_status_check;
ALTER TABLE public.products ADD CONSTRAINT products_moderation_status_check
  CHECK (moderation_status = ANY (ARRAY['draft','pending','approved','rejected','hidden','archived']));

-- 2) archive / restore / safe delete RPCs
CREATE OR REPLACE FUNCTION public.product_can_manage(_product_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.products p
     WHERE p.id = _product_id
       AND (p.vendor_id = auth.uid() OR public.has_any_admin_role(auth.uid()))
  )
$$;

CREATE OR REPLACE FUNCTION public.archive_product(_product_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.product_can_manage(_product_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.products
     SET moderation_status = 'archived',
         is_active = false,
         updated_at = now()
   WHERE id = _product_id;

  RETURN 'archived';
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_product(_product_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _status text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.product_can_manage(_product_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  _status := CASE WHEN public.has_any_admin_role(auth.uid()) THEN 'approved' ELSE 'pending' END;

  UPDATE public.products
     SET moderation_status = _status,
         is_active = (_status = 'approved'),
         updated_at = now()
   WHERE id = _product_id
     AND moderation_status = 'archived';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product is not archived';
  END IF;

  RETURN _status;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_or_archive_product(_product_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _has_orders boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.product_can_manage(_product_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.product_id = _product_id)
    INTO _has_orders;

  IF _has_orders THEN
    UPDATE public.products
       SET moderation_status = 'archived',
           is_active = false,
           updated_at = now()
     WHERE id = _product_id;
    RETURN 'archived';
  END IF;

  DELETE FROM public.cart_items WHERE product_id = _product_id;
  DELETE FROM public.favorites WHERE product_id = _product_id;
  DELETE FROM public.recently_viewed WHERE product_id = _product_id;
  DELETE FROM public.wishlist_items WHERE product_id = _product_id;
  DELETE FROM public.daily_deals WHERE product_id = _product_id;
  DELETE FROM public.quantity_discounts WHERE product_id = _product_id;
  DELETE FROM public.products WHERE id = _product_id;

  RETURN 'deleted';
END;
$$;

GRANT EXECUTE ON FUNCTION public.archive_product(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_product(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_or_archive_product(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.product_can_manage(uuid) TO authenticated;

-- 3) prevent purchases of archived / unavailable products
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
  _coupon_code_final text := NULL;
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

    SELECT p.id, p.price, p.vendor_id, COALESCE(p.shipping_cost, 0) AS shipping_cost,
           COALESCE(p.is_active, false) AS is_active, p.moderation_status
      INTO _product
      FROM public.products p
     WHERE p.id = (_item->>'product_id')::uuid;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product not found';
    END IF;

    IF _product.is_active IS NOT TRUE OR _product.moderation_status <> 'approved' THEN
      RAISE EXCEPTION 'Product unavailable';
    END IF;

    _subtotal := _subtotal + (_product.price * _qty);
    _shipping := _shipping + _product.shipping_cost;
  END LOOP;

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
    status, payment_status, coupon_code, discount_amount
  ) VALUES (
    _uid, _total, _shipping_address, _phone, _notes,
    'pending', 'pending', _coupon_code_final, _discount
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
    _order_id, 'cash', _total, 'pending',
    'COD-' || extract(epoch from now())::bigint::text,
    jsonb_build_object('method', 'cash_on_delivery')
  );

  DELETE FROM public.cart_items WHERE user_id = _uid;

  DELETE FROM public.favorites
   WHERE user_id = _uid
     AND product_id IN (
       SELECT (i->>'product_id')::uuid FROM jsonb_array_elements(_items) AS i
     );

  RETURN _order_id;
END;
$function$;