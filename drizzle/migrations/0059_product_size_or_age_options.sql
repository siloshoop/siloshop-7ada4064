ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS age_ranges text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS size_chart jsonb;

COMMENT ON COLUMN public.products.age_ranges IS 'Seller-chosen suitable age options (buyer-selectable via product_variants attribute العمر). Mutually exclusive with sizes.';
COMMENT ON COLUMN public.products.size_chart IS 'Optional per-size measurements {columns: text[], rows: [{size, values}]} in cm. Only allowed for size products.';

ALTER TABLE public.products
  ADD CONSTRAINT products_size_or_age_only CHECK (
    NOT (COALESCE(cardinality(sizes), 0) > 0 AND cardinality(age_ranges) > 0)
    AND NOT (size_chart IS NOT NULL AND cardinality(age_ranges) > 0)
  ),
  ADD CONSTRAINT products_age_ranges_limit CHECK (cardinality(age_ranges) <= 30),
  ADD CONSTRAINT products_size_chart_limit CHECK (size_chart IS NULL OR octet_length(size_chart::text) <= 20000);

CREATE OR REPLACE FUNCTION public.enforce_variant_size_or_age()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.attributes IS NOT NULL
     AND jsonb_typeof(NEW.attributes) = 'object'
     AND NEW.attributes ? 'المقاس'
     AND NEW.attributes ? 'العمر' THEN
    RAISE EXCEPTION 'لا يمكن الجمع بين المقاس والعمر في نفس المنتج' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_variant_size_or_age ON public.product_variants;
CREATE TRIGGER trg_enforce_variant_size_or_age
  BEFORE INSERT OR UPDATE OF attributes ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.enforce_variant_size_or_age();