DROP POLICY IF EXISTS "Brands are viewable by everyone" ON public.brands;
CREATE POLICY "Anyone can view active brands"
ON public.brands
FOR SELECT
TO public
USING (is_active = true);

DROP POLICY IF EXISTS "Anyone can view active announcements" ON public.announcements;
CREATE POLICY "Anyone can view active announcements"
ON public.announcements
FOR SELECT
TO public
USING (
  is_active = true
  AND (start_date IS NULL OR start_date <= now())
  AND (end_date IS NULL OR end_date > now())
);

ALTER TABLE public.brands REPLICA IDENTITY FULL;
ALTER TABLE public.native_ads REPLICA IDENTITY FULL;
ALTER TABLE public.announcements REPLICA IDENTITY FULL;
ALTER TABLE public.products REPLICA IDENTITY FULL;
ALTER TABLE public.categories REPLICA IDENTITY FULL;
ALTER TABLE public.subcategories REPLICA IDENTITY FULL;
ALTER TABLE public.daily_deals REPLICA IDENTITY FULL;
ALTER TABLE public.faq_items REPLICA IDENTITY FULL;
ALTER TABLE public.pickup_centers REPLICA IDENTITY FULL;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'brands',
    'native_ads',
    'announcements',
    'products',
    'categories',
    'subcategories',
    'daily_deals',
    'faq_items',
    'pickup_centers'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = table_name
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', table_name);
    END IF;
  END LOOP;
END;
$$;