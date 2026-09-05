ALTER TABLE public.cart_items REPLICA IDENTITY FULL;
ALTER TABLE public.compare_items REPLICA IDENTITY FULL;
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cart_items;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.compare_items;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;