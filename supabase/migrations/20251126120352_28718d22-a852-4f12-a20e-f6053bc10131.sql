-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  is_read BOOLEAN NOT NULL DEFAULT false,
  related_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notifications
CREATE POLICY "Users can view their own notifications"
  ON public.notifications
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON public.notifications
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Create reviews table
CREATE TABLE public.reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, user_id)
);

-- Enable RLS
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- RLS Policies for reviews
CREATE POLICY "Anyone can view reviews"
  ON public.reviews
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create reviews"
  ON public.reviews
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reviews"
  ON public.reviews
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reviews"
  ON public.reviews
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add trigger for updated_at on reviews
CREATE TRIGGER update_reviews_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to create notification for new order
CREATE OR REPLACE FUNCTION public.notify_vendor_new_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  vendor_id_var UUID;
  product_name_var TEXT;
BEGIN
  -- Get vendor_id and product name from the order item
  SELECT p.vendor_id, p.name INTO vendor_id_var, product_name_var
  FROM products p
  WHERE p.id = NEW.product_id;

  -- Create notification for vendor
  INSERT INTO notifications (user_id, title, message, type, related_id)
  VALUES (
    vendor_id_var,
    'طلب جديد',
    'لديك طلب جديد على المنتج: ' || product_name_var,
    'order',
    NEW.order_id
  );

  RETURN NEW;
END;
$$;

-- Trigger for new order items
CREATE TRIGGER on_new_order_item
  AFTER INSERT ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_vendor_new_order();

-- Function to notify vendor when product is out of stock
CREATE OR REPLACE FUNCTION public.notify_vendor_low_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only notify if stock goes to 0 or below
  IF NEW.stock_quantity <= 0 AND OLD.stock_quantity > 0 THEN
    INSERT INTO notifications (user_id, title, message, type, related_id)
    VALUES (
      NEW.vendor_id,
      'نفاد المخزون',
      'المنتج "' || NEW.name || '" نفد من المخزون',
      'warning',
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger for product stock updates
CREATE TRIGGER on_product_stock_change
  AFTER UPDATE OF stock_quantity ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_vendor_low_stock();

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Enable realtime for reviews
ALTER PUBLICATION supabase_realtime ADD TABLE public.reviews;