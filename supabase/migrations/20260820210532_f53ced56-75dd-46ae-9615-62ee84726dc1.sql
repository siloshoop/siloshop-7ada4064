-- =========================================================
-- 1. CATEGORY / SUBCATEGORY / BRAND ENRICHMENT
-- =========================================================
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS banner_url text,
  ADD COLUMN IF NOT EXISTS seo_title text,
  ADD COLUMN IF NOT EXISTS seo_description text,
  ADD COLUMN IF NOT EXISTS seo_keywords text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.subcategories
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS banner_url text,
  ADD COLUMN IF NOT EXISTS seo_title text,
  ADD COLUMN IF NOT EXISTS seo_description text,
  ADD COLUMN IF NOT EXISTS seo_keywords text,
  ADD COLUMN IF NOT EXISTS parent_subcategory_id uuid REFERENCES public.subcategories(id) ON DELETE SET NULL;

ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS banner_url text,
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS seo_title text,
  ADD COLUMN IF NOT EXISTS seo_description text,
  ADD COLUMN IF NOT EXISTS seo_keywords text,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- =========================================================
-- 2. PRODUCT ENRICHMENT
-- =========================================================
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS name_en text,
  ADD COLUMN IF NOT EXISTS short_description text,
  ADD COLUMN IF NOT EXISTS gtin text,
  ADD COLUMN IF NOT EXISTS min_order_quantity integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS max_order_quantity integer,
  ADD COLUMN IF NOT EXISTS length_cm numeric,
  ADD COLUMN IF NOT EXISTS width_cm numeric,
  ADD COLUMN IF NOT EXISTS height_cm numeric,
  ADD COLUMN IF NOT EXISTS shipping_weight numeric,
  ADD COLUMN IF NOT EXISTS shipping_class text,
  ADD COLUMN IF NOT EXISTS warranty text,
  ADD COLUMN IF NOT EXISTS return_policy text,
  ADD COLUMN IF NOT EXISTS country_of_origin text,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS seo_title text,
  ADD COLUMN IF NOT EXISTS seo_description text,
  ADD COLUMN IF NOT EXISTS seo_keywords text,
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_trending boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_recommended boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS views_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clicks_count integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_products_tags ON public.products USING gin (tags);
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products (slug);
CREATE INDEX IF NOT EXISTS idx_products_featured ON public.products (is_featured) WHERE is_featured;
CREATE INDEX IF NOT EXISTS idx_products_trending ON public.products (is_trending) WHERE is_trending;
CREATE INDEX IF NOT EXISTS idx_categories_parent ON public.categories (parent_id);
CREATE INDEX IF NOT EXISTS idx_subcategories_parent_sub ON public.subcategories (parent_subcategory_id);

-- =========================================================
-- 3. GLOBAL ATTRIBUTES
-- =========================================================
CREATE TABLE IF NOT EXISTS public.product_attributes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_ar text NOT NULL,
  input_type text NOT NULL DEFAULT 'select',
  unit text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.product_attributes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_attributes TO authenticated;
GRANT ALL ON public.product_attributes TO service_role;
ALTER TABLE public.product_attributes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attributes_public_read" ON public.product_attributes;
CREATE POLICY "attributes_public_read" ON public.product_attributes
  FOR SELECT USING (is_active OR public.has_any_admin_role(auth.uid()));

DROP POLICY IF EXISTS "attributes_admin_write" ON public.product_attributes;
CREATE POLICY "attributes_admin_write" ON public.product_attributes
  FOR ALL TO authenticated
  USING (public.has_any_admin_role(auth.uid()))
  WITH CHECK (public.has_any_admin_role(auth.uid()));

CREATE TABLE IF NOT EXISTS public.product_attribute_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attribute_id uuid NOT NULL REFERENCES public.product_attributes(id) ON DELETE CASCADE,
  value text NOT NULL,
  value_ar text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attr_values_attribute ON public.product_attribute_values (attribute_id);

GRANT SELECT ON public.product_attribute_values TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_attribute_values TO authenticated;
GRANT ALL ON public.product_attribute_values TO service_role;
ALTER TABLE public.product_attribute_values ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attr_values_public_read" ON public.product_attribute_values;
CREATE POLICY "attr_values_public_read" ON public.product_attribute_values
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "attr_values_admin_write" ON public.product_attribute_values;
CREATE POLICY "attr_values_admin_write" ON public.product_attribute_values
  FOR ALL TO authenticated
  USING (public.has_any_admin_role(auth.uid()))
  WITH CHECK (public.has_any_admin_role(auth.uid()));

-- =========================================================
-- 4. PRODUCT VARIANTS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  sku text,
  barcode text,
  price numeric,
  discount_price numeric,
  stock_quantity integer NOT NULL DEFAULT 0,
  weight numeric,
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_variants_product ON public.product_variants (product_id);
CREATE INDEX IF NOT EXISTS idx_variants_sku ON public.product_variants (sku);

GRANT SELECT ON public.product_variants TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_variants TO authenticated;
GRANT ALL ON public.product_variants TO service_role;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "variants_public_read" ON public.product_variants;
CREATE POLICY "variants_public_read" ON public.product_variants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_variants.product_id
        AND p.is_active IS TRUE
        AND p.moderation_status = 'approved'
    )
    OR public.product_can_manage(product_variants.product_id)
  );

DROP POLICY IF EXISTS "variants_owner_write" ON public.product_variants;
CREATE POLICY "variants_owner_write" ON public.product_variants
  FOR ALL TO authenticated
  USING (public.product_can_manage(product_variants.product_id))
  WITH CHECK (public.product_can_manage(product_variants.product_id));

CREATE OR REPLACE FUNCTION public.touch_variant_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_variants_touch ON public.product_variants;
CREATE TRIGGER trg_variants_touch BEFORE UPDATE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.touch_variant_updated_at();

-- =========================================================
-- 5. METRICS
-- =========================================================
CREATE OR REPLACE FUNCTION public.track_product_metric(_product_id uuid, _metric text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _metric NOT IN ('view', 'click') THEN
    RAISE EXCEPTION 'invalid_metric';
  END IF;
  IF _metric = 'view' THEN
    UPDATE public.products SET views_count = views_count + 1 WHERE id = _product_id;
  ELSE
    UPDATE public.products SET clicks_count = clicks_count + 1 WHERE id = _product_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.track_product_metric(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_product_metric(uuid, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.product_analytics(_product_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.product_can_manage(_product_id) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT jsonb_build_object(
    'views', COALESCE(p.views_count, 0),
    'clicks', COALESCE(p.clicks_count, 0),
    'stock', COALESCE(p.stock_quantity, 0),
    'units_sold', COALESCE((SELECT SUM(oi.quantity) FROM public.order_items oi WHERE oi.product_id = _product_id), 0),
    'revenue', COALESCE((SELECT SUM(oi.quantity * oi.price) FROM public.order_items oi WHERE oi.product_id = _product_id), 0),
    'orders', COALESCE((SELECT COUNT(DISTINCT oi.order_id) FROM public.order_items oi WHERE oi.product_id = _product_id), 0),
    'wishlist_count', COALESCE((SELECT COUNT(*) FROM public.favorites f WHERE f.product_id = _product_id), 0),
    'cart_count', COALESCE((SELECT COUNT(*) FROM public.cart_items c WHERE c.product_id = _product_id), 0),
    'returns', COALESCE((SELECT COUNT(*) FROM public.returns r JOIN public.order_items oi2 ON oi2.id = r.order_item_id WHERE oi2.product_id = _product_id), 0),
    'review_count', COALESCE((SELECT COUNT(*) FROM public.reviews rv WHERE rv.product_id = _product_id AND rv.is_hidden IS FALSE), 0),
    'review_score', COALESCE((SELECT ROUND(AVG(rv.rating)::numeric, 2) FROM public.reviews rv WHERE rv.product_id = _product_id AND rv.is_hidden IS FALSE), 0),
    'conversion_rate', CASE
      WHEN COALESCE(p.views_count, 0) > 0
      THEN ROUND((COALESCE((SELECT SUM(oi.quantity) FROM public.order_items oi WHERE oi.product_id = _product_id), 0)::numeric / p.views_count) * 100, 2)
      ELSE 0 END
  )
  INTO v_result
  FROM public.products p
  WHERE p.id = _product_id;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.product_analytics(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.product_analytics(uuid) TO authenticated;