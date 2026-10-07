DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='product_variants') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.product_variants;
  END IF;
END $$;