-- Create function to notify users when product price changes
CREATE OR REPLACE FUNCTION notify_price_change()
RETURNS TRIGGER AS $$
DECLARE
  saved_comp RECORD;
  price_diff NUMERIC;
  price_direction TEXT;
BEGIN
  -- Only proceed if price actually changed
  IF OLD.price IS DISTINCT FROM NEW.price THEN
    price_diff := OLD.price - NEW.price;
    
    IF price_diff > 0 THEN
      price_direction := 'انخفض';
    ELSE
      price_direction := 'ارتفع';
    END IF;
    
    -- Find all saved comparisons that contain this product
    FOR saved_comp IN 
      SELECT DISTINCT user_id 
      FROM saved_comparisons 
      WHERE NEW.id = ANY(product_ids)
    LOOP
      -- Insert notification for each user
      INSERT INTO notifications (user_id, title, message, type, related_id)
      VALUES (
        saved_comp.user_id,
        'تغيير في سعر منتج',
        'سعر المنتج "' || NEW.name || '" ' || price_direction || ' من ' || OLD.price || ' إلى ' || NEW.price || ' ل.س',
        'price_change',
        NEW.id
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on products table
DROP TRIGGER IF EXISTS on_product_price_change ON products;
CREATE TRIGGER on_product_price_change
  AFTER UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION notify_price_change();

-- Add INSERT policy for notifications (system can insert)
CREATE POLICY "System can insert notifications"
ON notifications
FOR INSERT
WITH CHECK (true);