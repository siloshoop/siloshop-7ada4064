-- Per-product shipping basis: free, fixed price, or set by the shipping company.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS shipping_mode text
    CONSTRAINT products_shipping_mode_check CHECK (shipping_mode IN ('free', 'fixed', 'variable'));

COMMENT ON COLUMN public.products.shipping_mode IS
  'Shipping basis: free = no cost to buyer, fixed = shipping_cost in product currency, variable = set by the shipping company. NULL derives from shipping_cost.';

-- Backfill: existing rows keep their current meaning (0 = free, > 0 = fixed price).
UPDATE public.products
   SET shipping_mode = CASE WHEN COALESCE(shipping_cost, 0) > 0 THEN 'fixed' ELSE 'free' END
 WHERE shipping_mode IS NULL;