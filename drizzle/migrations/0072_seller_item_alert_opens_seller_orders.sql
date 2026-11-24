CREATE OR REPLACE FUNCTION public.notify_vendor_new_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  vendor_id_var UUID;
  product_name_var TEXT;
BEGIN
  SELECT p.vendor_id, p.name INTO vendor_id_var, product_name_var
  FROM products p
  WHERE p.id = NEW.product_id;

  -- Seller-side sale alert: 'new_order' opens the seller order screen and shares
  -- one phone alert per order with the checkout's new-order notice.
  INSERT INTO notifications (user_id, title, message, type, related_id)
  VALUES (
    vendor_id_var,
    'طلب جديد',
    'لديك طلب جديد على المنتج: ' || product_name_var,
    'new_order',
    NEW.order_id
  );

  RETURN NEW;
END;
$function$;