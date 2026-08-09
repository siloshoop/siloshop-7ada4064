CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL,
  quantity_before integer,
  quantity_after integer,
  delta integer NOT NULL,
  reason text NOT NULL DEFAULT 'manual',
  note text,
  performed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_stock_movements_vendor_created ON public.stock_movements(vendor_id, created_at DESC);
CREATE INDEX idx_stock_movements_product_created ON public.stock_movements(product_id, created_at DESC);

GRANT SELECT ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendors view their own stock movements"
ON public.stock_movements FOR SELECT TO authenticated
USING (vendor_id = auth.uid());

CREATE POLICY "Admin roles view all stock movements"
ON public.stock_movements FOR SELECT TO authenticated
USING (public.has_any_admin_role(auth.uid()));

CREATE OR REPLACE FUNCTION public.log_stock_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason text := 'manual';
  v_delta integer;
BEGIN
  IF COALESCE(NEW.stock_quantity, 0) = COALESCE(OLD.stock_quantity, 0) THEN
    RETURN NEW;
  END IF;

  v_delta := COALESCE(NEW.stock_quantity, 0) - COALESCE(OLD.stock_quantity, 0);

  IF auth.uid() IS NULL THEN
    v_reason := CASE WHEN v_delta < 0 THEN 'sale' ELSE 'system' END;
  ELSIF auth.uid() <> NEW.vendor_id THEN
    v_reason := 'admin_adjustment';
  ELSE
    v_reason := 'manual';
  END IF;

  INSERT INTO public.stock_movements (product_id, vendor_id, quantity_before, quantity_after, delta, reason, performed_by)
  VALUES (NEW.id, NEW.vendor_id, OLD.stock_quantity, NEW.stock_quantity, v_delta, v_reason, auth.uid());

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_stock_movement ON public.products;
CREATE TRIGGER trg_log_stock_movement
AFTER UPDATE OF stock_quantity ON public.products
FOR EACH ROW EXECUTE FUNCTION public.log_stock_movement();