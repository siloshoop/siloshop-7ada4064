
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wishlists TO authenticated;
GRANT ALL ON public.wishlists TO service_role;
GRANT SELECT ON public.wishlists TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wishlist_items TO authenticated;
GRANT ALL ON public.wishlist_items TO service_role;
GRANT SELECT ON public.wishlist_items TO anon;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wishlist_items_product_id_fkey') THEN
    ALTER TABLE public.wishlist_items
      ADD CONSTRAINT wishlist_items_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE public.wishlists REPLICA IDENTITY FULL;
ALTER TABLE public.wishlist_items REPLICA IDENTITY FULL;

DO $$ BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.wishlists;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.wishlist_items;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
