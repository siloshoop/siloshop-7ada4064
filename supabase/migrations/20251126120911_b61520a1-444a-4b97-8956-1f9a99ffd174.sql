-- Create favorites table
CREATE TABLE public.favorites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);

-- Enable RLS
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

-- RLS Policies for favorites
CREATE POLICY "Users can manage their own favorites"
  ON public.favorites
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create coupons table
CREATE TABLE public.coupons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  vendor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC NOT NULL CHECK (discount_value > 0),
  min_purchase NUMERIC DEFAULT 0,
  max_uses INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- RLS Policies for coupons
CREATE POLICY "Vendors can manage their own coupons"
  ON public.coupons
  FOR ALL
  USING (auth.uid() = vendor_id)
  WITH CHECK (auth.uid() = vendor_id);

CREATE POLICY "Anyone can view active coupons"
  ON public.coupons
  FOR SELECT
  USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

-- Add trigger for updated_at on coupons
CREATE TRIGGER update_coupons_updated_at
  BEFORE UPDATE ON public.coupons
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add tracking fields to orders table
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS tracking_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS courier_name TEXT,
  ADD COLUMN IF NOT EXISTS tracking_number TEXT,
  ADD COLUMN IF NOT EXISTS estimated_delivery TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS current_location_lat NUMERIC,
  ADD COLUMN IF NOT EXISTS current_location_lng NUMERIC,
  ADD COLUMN IF NOT EXISTS delivery_lat NUMERIC,
  ADD COLUMN IF NOT EXISTS delivery_lng NUMERIC,
  ADD COLUMN IF NOT EXISTS coupon_code TEXT,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0;

-- Create order_status_history table for tracking updates
CREATE TABLE public.order_status_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  location_lat NUMERIC,
  location_lng NUMERIC,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for order_status_history
CREATE POLICY "Users can view their order history"
  ON public.order_status_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_status_history.order_id
      AND orders.customer_id = auth.uid()
    )
  );

CREATE POLICY "Vendors can add status updates for their orders"
  ON public.order_status_history
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      WHERE o.id = order_status_history.order_id
      AND oi.vendor_id = auth.uid()
    )
  );

-- Enable realtime for favorites
ALTER PUBLICATION supabase_realtime ADD TABLE public.favorites;

-- Enable realtime for order status updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_status_history;

-- Function to notify user of order status change
CREATE OR REPLACE FUNCTION public.notify_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  customer_id_var UUID;
BEGIN
  -- Get customer_id from order
  SELECT customer_id INTO customer_id_var
  FROM orders
  WHERE id = NEW.order_id;

  -- Create notification for customer
  INSERT INTO notifications (user_id, title, message, type, related_id)
  VALUES (
    customer_id_var,
    'تحديث حالة الطلب',
    'تم تحديث حالة طلبك إلى: ' || NEW.status,
    'order_status',
    NEW.order_id
  );

  RETURN NEW;
END;
$$;

-- Trigger for order status updates
CREATE TRIGGER on_order_status_change
  AFTER INSERT ON public.order_status_history
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_order_status_change();