-- Create table to track recently viewed products
CREATE TABLE public.recently_viewed (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  viewed_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);

-- Enable RLS
ALTER TABLE public.recently_viewed ENABLE ROW LEVEL SECURITY;

-- Users can manage their own recently viewed products
CREATE POLICY "Users can view their own recently viewed"
ON public.recently_viewed
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own recently viewed"
ON public.recently_viewed
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recently viewed"
ON public.recently_viewed
FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own recently viewed"
ON public.recently_viewed
FOR UPDATE
USING (auth.uid() = user_id);

-- Create table for daily deals
CREATE TABLE public.daily_deals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  discount_percentage integer NOT NULL CHECK (discount_percentage > 0 AND discount_percentage <= 100),
  start_date timestamp with time zone NOT NULL DEFAULT now(),
  end_date timestamp with time zone NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT valid_date_range CHECK (end_date > start_date)
);

-- Enable RLS for daily_deals
ALTER TABLE public.daily_deals ENABLE ROW LEVEL SECURITY;

-- Anyone can view active deals
CREATE POLICY "Anyone can view active deals"
ON public.daily_deals
FOR SELECT
USING (is_active = true AND end_date > now());

-- Vendors can manage deals for their products
CREATE POLICY "Vendors can manage their product deals"
ON public.daily_deals
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM products
    WHERE products.id = daily_deals.product_id
    AND products.vendor_id = auth.uid()
  )
);

-- Enable realtime for recently_viewed
ALTER PUBLICATION supabase_realtime ADD TABLE public.recently_viewed;