DO $migration$
DECLARE definition text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='create_order' AND p.pronargs=7;
  IF definition IS NULL OR position('PERFORM pg_advisory_xact_lock' IN definition)=0 THEN RAISE EXCEPTION 'create_order signature changed'; END IF;
  definition := replace(definition,
    'PERFORM pg_advisory_xact_lock(hashtext(''create_order:'' || _uid::text));',
    $body$PERFORM pg_advisory_xact_lock(hashtext('create_order:' || _uid::text));

  -- Validate summed quantities, including repeated lines, before any decrement.
  FOR _item IN SELECT jsonb_build_object('product_id', i->>'product_id', 'variant_id', NULLIF(i->>'variant_id',''), 'quantity', sum((i->>'quantity')::integer)) FROM jsonb_array_elements(_items) i GROUP BY i->>'product_id', NULLIF(i->>'variant_id','') ORDER BY i->>'product_id', NULLIF(i->>'variant_id','')
  LOOP
    SELECT p.* INTO _product FROM public.products p WHERE p.id=(_item->>'product_id')::uuid FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_UNAVAILABLE'; END IF;
    _qty := (_item->>'quantity')::integer;
    _variant_id := NULLIF(_item->>'variant_id','')::uuid;
    IF _variant_id IS NULL THEN
      IF EXISTS (SELECT 1 FROM public.product_variants WHERE product_id=_product.id) THEN RAISE EXCEPTION 'VARIANT_REQUIRED:%',_product.name; END IF;
      IF _product.stock_quantity<_qty THEN RAISE EXCEPTION 'OUT_OF_STOCK:%',_product.name; END IF;
    ELSE
      SELECT v.* INTO _variant FROM public.product_variants v WHERE v.id=_variant_id FOR UPDATE;
      IF NOT FOUND OR _variant.product_id<>_product.id OR _variant.is_active IS NOT TRUE THEN RAISE EXCEPTION 'VARIANT_UNAVAILABLE:%',_product.name; END IF;
      IF _variant.stock_quantity<_qty THEN RAISE EXCEPTION 'OUT_OF_STOCK:%',_product.name; END IF;
    END IF;
  END LOOP;
$body$);
  EXECUTE definition;
END;
$migration$;