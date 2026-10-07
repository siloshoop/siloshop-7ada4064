CREATE OR REPLACE FUNCTION public.effective_unit_price(_product_id uuid, _price numeric, _qty integer)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT round(
    COALESCE(_price, 0)
    * (1 - COALESCE((SELECT max(d.discount_percentage) FROM public.daily_deals d
                      WHERE d.product_id = _product_id AND d.is_active
                        AND d.start_date <= now() AND d.end_date > now()), 0) / 100.0)
    * (1 - COALESCE((SELECT q.discount_percentage FROM public.quantity_discounts q
                      WHERE q.product_id = _product_id AND q.min_quantity <= COALESCE(_qty, 1)
                      ORDER BY q.min_quantity DESC LIMIT 1), 0) / 100.0)
  , 2)
$$;
GRANT EXECUTE ON FUNCTION public.effective_unit_price(uuid, numeric, integer) TO anon, authenticated;

DO $do$
DECLARE _def text;
BEGIN
  _def := pg_get_functiondef('public.create_order(jsonb,text,text,text,text,text,uuid)'::regprocedure);
  IF strpos(_def, 'effective_unit_price') > 0 THEN RETURN; END IF;
  IF strpos(_def, '    _subtotal := _subtotal + (_unit_price * _qty);') = 0
     OR strpos(_def, '    INSERT INTO public.order_items (') = 0 THEN
    RAISE EXCEPTION 'create_order markers not found';
  END IF;
  _def := replace(_def, '    _subtotal := _subtotal + (_unit_price * _qty);',
    '    _unit_price := public.effective_unit_price(_product.id, _unit_price, _qty);' || chr(10) || '    _subtotal := _subtotal + (_unit_price * _qty);');
  _def := replace(_def, '    INSERT INTO public.order_items (',
    '    _unit_price := public.effective_unit_price(_product.id, _unit_price, _qty);' || chr(10) || '    INSERT INTO public.order_items (');
  EXECUTE _def;
END
$do$;

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

  SELECT COALESCE(SUM(public.effective_unit_price(p.id, COALESCE(v.discount_price, v.price, p.price), GREATEST((i->>'quantity')::int, 0)) * GREATEST((i->>'quantity')::int, 0)), 0),
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

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS pre_archive_status text;
UPDATE public.products SET pre_archive_status =
  CASE WHEN moderated_at IS NOT NULL AND moderation_reason IS NULL THEN 'approved' ELSE 'draft' END
 WHERE moderation_status = 'archived' AND pre_archive_status IS NULL;

CREATE OR REPLACE FUNCTION public.enforce_product_moderation()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_admin boolean;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.moderation_status = 'archived' AND OLD.moderation_status IS DISTINCT FROM 'archived' THEN
    NEW.pre_archive_status := OLD.moderation_status;
  END IF;

  v_admin := auth.uid() IS NOT NULL AND public.has_any_admin_role(auth.uid());
  IF v_admin OR coalesce(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.moderation_status IS NULL OR NEW.moderation_status NOT IN ('draft', 'pending') THEN
      NEW.moderation_status := 'pending';
    END IF;
    NEW.moderated_by := NULL;
    NEW.moderated_at := NULL;
    NEW.moderation_reason := NULL;
    NEW.moderation_reason_code := NULL;
    NEW.is_featured := false;
    NEW.is_trending := false;
    NEW.is_recommended := false;
    NEW.is_active := false;
    NEW.pre_archive_status := NULL;
    RETURN NEW;
  END IF;

  NEW.moderated_by := OLD.moderated_by;
  NEW.moderated_at := OLD.moderated_at;
  NEW.moderation_reason_code := OLD.moderation_reason_code;
  NEW.is_featured := OLD.is_featured;
  NEW.is_trending := OLD.is_trending;
  NEW.is_recommended := OLD.is_recommended;
  IF NOT (NEW.moderation_status = 'archived' AND OLD.moderation_status IS DISTINCT FROM 'archived') THEN
    NEW.pre_archive_status := OLD.pre_archive_status;
  END IF;

  IF NEW.moderation_status IS DISTINCT FROM OLD.moderation_status THEN
    IF NOT (
      (OLD.moderation_status IN ('draft', 'rejected') AND NEW.moderation_status = 'pending')
      OR NEW.moderation_status = 'archived'
      OR (OLD.moderation_status = 'archived' AND NEW.moderation_status IN ('draft', 'pending'))
      OR (OLD.moderation_status = 'archived' AND NEW.moderation_status = 'approved'
          AND OLD.pre_archive_status = 'approved')
    ) THEN
      RAISE EXCEPTION 'moderation_status_change_not_allowed';
    END IF;
    IF NEW.moderation_status = 'pending' THEN
      NEW.moderation_reason := NULL;
    END IF;
  ELSE
    NEW.moderation_reason := OLD.moderation_reason;
  END IF;

  IF NEW.moderation_status <> 'approved' THEN
    NEW.is_active := false;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.restore_product(_product_id uuid)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _status text;
  _prev text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.product_can_manage(_product_id) THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT pre_archive_status INTO _prev FROM public.products
   WHERE id = _product_id AND moderation_status = 'archived';
  IF NOT FOUND THEN RAISE EXCEPTION 'Product is not archived'; END IF;

  _status := CASE WHEN public.has_any_admin_role(auth.uid()) OR _prev = 'approved'
                  THEN 'approved' ELSE 'pending' END;

  UPDATE public.products
     SET moderation_status = _status,
         is_active = (_status = 'approved'),
         pre_archive_status = NULL,
         updated_at = now()
   WHERE id = _product_id AND moderation_status = 'archived';

  RETURN _status;
END;
$function$;