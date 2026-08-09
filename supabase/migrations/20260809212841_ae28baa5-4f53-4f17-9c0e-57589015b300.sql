DROP TRIGGER IF EXISTS trigger_notify_price_drop ON public.products;

ALTER TABLE public.products
  ALTER COLUMN price TYPE numeric(14,2),
  ALTER COLUMN original_price TYPE numeric(14,2),
  ALTER COLUMN discount_price TYPE numeric(14,2),
  ALTER COLUMN shipping_cost TYPE numeric(14,2),
  ALTER COLUMN weight TYPE numeric(12,3);

CREATE TRIGGER trigger_notify_price_drop
  AFTER UPDATE OF price ON public.products
  FOR EACH ROW WHEN (new.price < old.price)
  EXECUTE FUNCTION public.notify_price_drop();

ALTER TABLE public.orders
  ALTER COLUMN total_amount TYPE numeric(14,2),
  ALTER COLUMN discount_amount TYPE numeric(14,2);

ALTER TABLE public.order_items
  ALTER COLUMN price TYPE numeric(14,2);

ALTER TABLE public.payments
  ALTER COLUMN amount TYPE numeric(14,2);

ALTER TABLE public.payment_transactions
  ALTER COLUMN amount TYPE numeric(14,2);

ALTER TABLE public.coupons
  ALTER COLUMN discount_value TYPE numeric(14,2),
  ALTER COLUMN min_purchase TYPE numeric(14,2);