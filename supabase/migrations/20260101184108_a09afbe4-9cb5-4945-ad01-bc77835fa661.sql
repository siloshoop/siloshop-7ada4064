-- Function to notify users when a new deal is added on their favorite products
CREATE OR REPLACE FUNCTION public.notify_favorites_new_deal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fav RECORD;
  product_name TEXT;
BEGIN
  -- Get product name
  SELECT name INTO product_name
  FROM products
  WHERE id = NEW.product_id;

  -- Notify all users who have this product in favorites
  FOR fav IN 
    SELECT user_id FROM favorites WHERE product_id = NEW.product_id
  LOOP
    INSERT INTO notifications (user_id, title, message, type, related_id)
    VALUES (
      fav.user_id,
      'عرض جديد على منتج مفضل',
      'تم إضافة خصم ' || NEW.discount_percentage || '% على المنتج: ' || product_name,
      'deal',
      NEW.product_id
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- Trigger for new deals
CREATE TRIGGER trigger_notify_favorites_new_deal
AFTER INSERT ON public.daily_deals
FOR EACH ROW
EXECUTE FUNCTION public.notify_favorites_new_deal();

-- Function to notify users when a deal on their favorite product ends
CREATE OR REPLACE FUNCTION public.notify_favorites_deal_ended()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fav RECORD;
  product_name TEXT;
BEGIN
  -- Only trigger when deal becomes inactive
  IF OLD.is_active = true AND NEW.is_active = false THEN
    -- Get product name
    SELECT name INTO product_name
    FROM products
    WHERE id = NEW.product_id;

    -- Notify all users who have this product in favorites
    FOR fav IN 
      SELECT user_id FROM favorites WHERE product_id = NEW.product_id
    LOOP
      INSERT INTO notifications (user_id, title, message, type, related_id)
      VALUES (
        fav.user_id,
        'انتهى العرض على منتج مفضل',
        'انتهى عرض الخصم على المنتج: ' || product_name,
        'deal_ended',
        NEW.product_id
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger for deal updates
CREATE TRIGGER trigger_notify_favorites_deal_ended
AFTER UPDATE ON public.daily_deals
FOR EACH ROW
EXECUTE FUNCTION public.notify_favorites_deal_ended();