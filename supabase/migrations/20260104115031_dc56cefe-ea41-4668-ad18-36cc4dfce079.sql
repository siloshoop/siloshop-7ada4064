-- Create delivery ratings table
CREATE TABLE public.delivery_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(order_id)
);

-- Enable RLS
ALTER TABLE public.delivery_ratings ENABLE ROW LEVEL SECURITY;

-- Users can view their own delivery ratings
CREATE POLICY "Users can view their own delivery ratings"
ON public.delivery_ratings
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create delivery ratings for their delivered orders
CREATE POLICY "Users can rate delivery for their orders"
ON public.delivery_ratings
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = delivery_ratings.order_id
    AND orders.customer_id = auth.uid()
    AND orders.status = 'delivered'
  )
);

-- Users can update their own ratings
CREATE POLICY "Users can update their delivery ratings"
ON public.delivery_ratings
FOR UPDATE
USING (auth.uid() = user_id);

-- Enable realtime for delivery_ratings
ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_ratings;