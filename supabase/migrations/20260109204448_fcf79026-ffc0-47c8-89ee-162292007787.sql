-- Add unique constraint for push_subscriptions if not exists
ALTER TABLE public.push_subscriptions 
ADD CONSTRAINT push_subscriptions_user_endpoint_unique 
UNIQUE (user_id, endpoint);

-- Create or replace function to send push notifications to brand followers
CREATE OR REPLACE FUNCTION public.send_push_to_brand_followers()
RETURNS TRIGGER AS $$
DECLARE
  follower_record RECORD;
  brand_name TEXT;
BEGIN
  -- Only proceed if brand_id is set
  IF NEW.brand_id IS NOT NULL THEN
    -- Get brand name
    SELECT name_ar INTO brand_name FROM public.brands WHERE id = NEW.brand_id;
    
    -- Queue push notifications for each follower
    FOR follower_record IN 
      SELECT bf.user_id 
      FROM public.brand_followers bf
      INNER JOIN public.push_subscriptions ps ON ps.user_id = bf.user_id
      WHERE bf.brand_id = NEW.brand_id
    LOOP
      -- Insert into a queue table or directly call edge function
      -- For now, we create notifications which can be processed
      INSERT INTO public.notifications (user_id, title, message, type, related_id)
      VALUES (
        follower_record.user_id,
        'منتج جديد من ' || COALESCE(brand_name, 'علامة تجارية'),
        'تم إضافة: ' || NEW.name || ' - تصفح الآن!',
        'push_new_product',
        NEW.id
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop old trigger if exists and create new one
DROP TRIGGER IF EXISTS send_push_to_brand_followers_trigger ON public.products;

CREATE TRIGGER send_push_to_brand_followers_trigger
AFTER INSERT ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.send_push_to_brand_followers();