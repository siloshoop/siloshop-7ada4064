CREATE OR REPLACE FUNCTION public.product_features_valid(p jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p IS NULL OR jsonb_typeof(p) <> 'array' THEN false
    WHEN jsonb_array_length(p) > 30 THEN false
    ELSE NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p) AS e(item)
      WHERE CASE
        WHEN jsonb_typeof(e.item) <> 'object' THEN true
        WHEN jsonb_typeof(e.item -> 'title') IS DISTINCT FROM 'string' THEN true
        WHEN jsonb_typeof(e.item -> 'value') IS DISTINCT FROM 'string' THEN true
        WHEN char_length(btrim(e.item ->> 'title')) NOT BETWEEN 1 AND 80 THEN true
        WHEN char_length(btrim(e.item ->> 'value')) NOT BETWEEN 1 AND 300 THEN true
        WHEN (SELECT count(*) FROM jsonb_object_keys(e.item)) <> 2 THEN true
        ELSE false
      END
    )
  END
$$;

GRANT EXECUTE ON FUNCTION public.product_features_valid(jsonb) TO anon, authenticated, service_role;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS features jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.products.features IS 'Seller-defined product features: ordered array of {"title","value"} strings shown in the product features section.';

ALTER TABLE public.products
  ADD CONSTRAINT products_features_valid CHECK (public.product_features_valid(features));

ALTER TABLE public.products
  ADD CONSTRAINT products_length_cm_range CHECK (length_cm IS NULL OR (length_cm > 0 AND length_cm <= 100000));

ALTER TABLE public.products
  ADD CONSTRAINT products_width_cm_range CHECK (width_cm IS NULL OR (width_cm > 0 AND width_cm <= 100000));