-- Create function to notify users when favorite product price drops
CREATE OR REPLACE FUNCTION public.notify_price_drop()
RETURNS TRIGGER AS $$
DECLARE
  user_record RECORD;
  product_name TEXT;
  old_price NUMERIC;
  new_price NUMERIC;
  discount_percent NUMERIC;
BEGIN
  -- Only proceed if price actually dropped
  IF NEW.price < OLD.price THEN
    old_price := OLD.price;
    new_price := NEW.price;
    product_name := NEW.name;
    discount_percent := ROUND(((old_price - new_price) / old_price) * 100);
    
    -- Find all users who have this product in favorites and have price_drops enabled
    FOR user_record IN
      SELECT DISTINCT f.user_id
      FROM favorites f
      LEFT JOIN notification_preferences np ON np.user_id = f.user_id
      WHERE f.product_id = NEW.id
        AND (np.price_drops IS NULL OR np.price_drops = true)
    LOOP
      -- Insert notification for each user
      INSERT INTO notifications (
        user_id,
        title,
        message,
        type,
        related_id,
        is_read
      ) VALUES (
        user_record.user_id,
        'انخفاض سعر منتج مفضل! 🎉',
        'انخفض سعر "' || product_name || '" من ' || old_price || ' إلى ' || new_price || ' ل.س (خصم ' || discount_percent || '%)',
        'price_drop',
        NEW.id,
        false
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for price drop notifications
DROP TRIGGER IF EXISTS trigger_notify_price_drop ON products;
CREATE TRIGGER trigger_notify_price_drop
AFTER UPDATE OF price ON products
FOR EACH ROW
WHEN (NEW.price < OLD.price)
EXECUTE FUNCTION public.notify_price_drop();