-- Enable realtime for orders table only
ALTER TABLE orders REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE orders;