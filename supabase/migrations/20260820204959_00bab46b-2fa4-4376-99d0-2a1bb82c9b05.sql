ALTER TABLE public.products ADD COLUMN IF NOT EXISTS barcode text;
CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products (barcode) WHERE barcode IS NOT NULL;

CREATE OR REPLACE FUNCTION public.seller_bulk_update_products(
  _ids uuid[],
  _price_pct numeric DEFAULT NULL,
  _stock integer DEFAULT NULL,
  _is_active boolean DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_count integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF _ids IS NULL OR array_length(_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'no_products_selected';
  END IF;
  IF array_length(_ids, 1) > 200 THEN
    RAISE EXCEPTION 'too_many_products';
  END IF;
  IF _price_pct IS NOT NULL AND (_price_pct < -90 OR _price_pct > 500) THEN
    RAISE EXCEPTION 'invalid_price_percent';
  END IF;
  IF _stock IS NOT NULL AND (_stock < 0 OR _stock > 1000000) THEN
    RAISE EXCEPTION 'invalid_stock';
  END IF;
  IF _price_pct IS NULL AND _stock IS NULL AND _is_active IS NULL THEN
    RAISE EXCEPTION 'nothing_to_update';
  END IF;

  UPDATE public.products p
     SET price = CASE WHEN _price_pct IS NULL THEN p.price
                      ELSE GREATEST(1, round(p.price * (1 + _price_pct / 100.0), 2)) END,
         stock_quantity = COALESCE(_stock, p.stock_quantity),
         is_active = COALESCE(_is_active, p.is_active),
         updated_at = now()
   WHERE p.id = ANY(_ids)
     AND p.vendor_id = v_uid
     AND p.source = 'seller';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.seller_bulk_update_products(uuid[], numeric, integer, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seller_bulk_update_products(uuid[], numeric, integer, boolean) TO authenticated;