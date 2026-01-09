-- Create brand_followers table
CREATE TABLE public.brand_followers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, brand_id)
);

-- Enable RLS
ALTER TABLE public.brand_followers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own brand follows" 
ON public.brand_followers 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can follow brands" 
ON public.brand_followers 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unfollow brands" 
ON public.brand_followers 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create index for better performance
CREATE INDEX idx_brand_followers_user_id ON public.brand_followers(user_id);
CREATE INDEX idx_brand_followers_brand_id ON public.brand_followers(brand_id);

-- Create function to notify followers when new product is added
CREATE OR REPLACE FUNCTION public.notify_brand_followers()
RETURNS TRIGGER AS $$
DECLARE
  follower_record RECORD;
  brand_name TEXT;
BEGIN
  -- Only proceed if brand_id is set
  IF NEW.brand_id IS NOT NULL THEN
    -- Get brand name
    SELECT name_ar INTO brand_name FROM public.brands WHERE id = NEW.brand_id;
    
    -- Insert notification for each follower
    FOR follower_record IN 
      SELECT user_id FROM public.brand_followers WHERE brand_id = NEW.brand_id
    LOOP
      INSERT INTO public.notifications (user_id, title, message, type, related_id)
      VALUES (
        follower_record.user_id,
        'منتج جديد من ' || COALESCE(brand_name, 'علامة تجارية'),
        'تم إضافة منتج جديد: ' || NEW.name,
        'new_product',
        NEW.id
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on products table
CREATE TRIGGER notify_brand_followers_on_new_product
AFTER INSERT ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.notify_brand_followers();