DROP POLICY IF EXISTS "variants_public_read" ON public.product_variants;

CREATE POLICY "variants_public_read" ON public.product_variants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_variants.product_id
        AND p.is_active IS TRUE
        AND p.moderation_status = 'approved'
    )
  );

CREATE POLICY "variants_manager_read" ON public.product_variants
  FOR SELECT TO authenticated
  USING (public.product_can_manage(product_variants.product_id));