ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_size_or_age_only;
ALTER TABLE public.products
  ADD CONSTRAINT products_size_chart_needs_sizes CHECK (size_chart IS NULL OR COALESCE(cardinality(sizes), 0) > 0);

DROP TRIGGER IF EXISTS trg_enforce_variant_size_or_age ON public.product_variants;
DROP FUNCTION IF EXISTS public.enforce_variant_size_or_age();

COMMENT ON COLUMN public.products.age_ranges IS 'Seller-chosen suitable age options (buyer-selectable via product_variants attribute العمر). May be combined with sizes.';
COMMENT ON COLUMN public.products.size_chart IS 'Optional per-size measurements {columns: text[], rows: [{size, values}]} in cm. Requires sizes.';