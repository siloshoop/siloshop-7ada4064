-- Missing GRANTs — RLS policies existed but PostgREST rejected reads because the authenticated role had no table privileges.
GRANT SELECT ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;

GRANT SELECT ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;

GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;

GRANT SELECT, INSERT ON public.delivery_ratings TO authenticated;
GRANT ALL ON public.delivery_ratings TO service_role;

-- Make sure realtime carries enough row data for the customer filter (customer_id=eq.<uid>) to match on UPDATE.
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.order_items REPLICA IDENTITY FULL;

-- Ensure order_items is in the realtime publication so vendors see new orders live.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'order_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
END $$;