
-- 1. Extend products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS product_type text NOT NULL DEFAULT 'seller',
  ADD COLUMN IF NOT EXISTS sku text,
  ADD COLUMN IF NOT EXISTS discount_price numeric(10,2),
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'SYP',
  ADD COLUMN IF NOT EXISTS sizes text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS colors text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS weight numeric(10,3),
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS external_id text;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_product_type_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_product_type_check CHECK (product_type IN ('platform','seller'));

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_source_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_source_check CHECK (source IN ('manual','supplier_api','xml','csv','xlsx'));

CREATE UNIQUE INDEX IF NOT EXISTS products_sku_unique
  ON public.products (sku) WHERE sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_product_type ON public.products (product_type);
CREATE UNIQUE INDEX IF NOT EXISTS products_source_external_unique
  ON public.products (source, external_id)
  WHERE external_id IS NOT NULL AND product_type = 'platform';

-- 2. Products RLS: keep existing seller policy, add admin management for platform products
DROP POLICY IF EXISTS "Admins can manage platform products" ON public.products;
CREATE POLICY "Admins can manage platform products"
  ON public.products
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Prevent vendors from touching platform-typed rows even if vendor_id matches
DROP POLICY IF EXISTS "Vendors can manage their own products" ON public.products;
CREATE POLICY "Vendors can manage their own products"
  ON public.products
  FOR ALL
  TO authenticated
  USING (
    auth.uid() = vendor_id
    AND product_type = 'seller'
    AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'vendor'::user_role)
  )
  WITH CHECK (
    auth.uid() = vendor_id
    AND product_type = 'seller'
    AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'vendor'::user_role)
  );

-- 3. Admin write policies on categories & brands
DROP POLICY IF EXISTS "Admins can manage categories" ON public.categories;
CREATE POLICY "Admins can manage categories"
  ON public.categories
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can manage brands" ON public.brands;
CREATE POLICY "Admins can manage brands"
  ON public.brands
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Ensure write grants exist
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brands TO authenticated;
GRANT ALL ON public.categories TO service_role;
GRANT ALL ON public.brands TO service_role;
