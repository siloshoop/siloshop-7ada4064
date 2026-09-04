ALTER TABLE public.cart_items
  ADD COLUMN IF NOT EXISTS variant_id uuid NULL REFERENCES public.product_variants(id) ON DELETE CASCADE;

ALTER TABLE public.cart_items DROP CONSTRAINT IF EXISTS cart_items_user_id_product_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS cart_items_user_product_variant_uq
  ON public.cart_items (user_id, product_id, COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid));