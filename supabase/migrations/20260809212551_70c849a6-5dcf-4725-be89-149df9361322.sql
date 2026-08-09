ALTER TABLE public.stock_movements REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_movements;