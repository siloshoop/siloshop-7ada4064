ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS tracking_status text,
  ADD COLUMN IF NOT EXISTS tracking_number text,
  ADD COLUMN IF NOT EXISTS shipping_carrier text,
  ADD COLUMN IF NOT EXISTS tracking_updated_at timestamptz;

CREATE TABLE IF NOT EXISTS public.order_item_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id uuid NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  status text NOT NULL,
  note text,
  tracking_number text,
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_oish_item ON public.order_item_status_history(order_item_id, created_at);
GRANT SELECT ON public.order_item_status_history TO authenticated;
GRANT ALL ON public.order_item_status_history TO service_role;
ALTER TABLE public.order_item_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Item history visible to buyer, seller, admin" ON public.order_item_status_history
FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.order_items oi JOIN public.orders o ON o.id = oi.order_id
  WHERE oi.id = order_item_id
    AND (o.customer_id = auth.uid() OR oi.vendor_id = auth.uid() OR public.has_any_admin_role(auth.uid()))
));

-- Backfill: each item starts from the saved status of the shipment that owns it
UPDATE public.order_items oi SET
  tracking_status = public.normalize_order_status(COALESCE(
    (SELECT c.status FROM public.orders c WHERE c.parent_order_id = oi.order_id AND c.vendor_id = oi.vendor_id ORDER BY c.created_at LIMIT 1),
    (SELECT o.status FROM public.orders o WHERE o.id = oi.order_id), 'pending')),
  tracking_updated_at = now()
WHERE oi.tracking_status IS NULL;

ALTER TABLE public.order_items ALTER COLUMN tracking_status SET DEFAULT 'pending';

CREATE OR REPLACE FUNCTION public.order_item_set_initial_tracking()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.tracking_status IS NULL THEN NEW.tracking_status := 'pending'; END IF;
  NEW.tracking_updated_at := COALESCE(NEW.tracking_updated_at, now());
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_order_item_initial_tracking ON public.order_items;
CREATE TRIGGER trg_order_item_initial_tracking BEFORE INSERT ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.order_item_set_initial_tracking();

-- Whole-order cancellation is the only order-level event applied to items
CREATE OR REPLACE FUNCTION public.order_cancel_items_tracking()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.normalize_order_status(NEW.status) = 'cancelled'
     AND public.normalize_order_status(OLD.status) IS DISTINCT FROM 'cancelled' THEN
    UPDATE public.order_items oi SET tracking_status = 'cancelled', tracking_updated_at = now()
     WHERE oi.tracking_status IN ('pending','confirmed','preparing','ready_for_shipping')
       AND (oi.order_id = NEW.id OR (NEW.parent_order_id IS NOT NULL AND oi.order_id = NEW.parent_order_id AND oi.vendor_id = NEW.vendor_id));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_order_cancel_items_tracking ON public.orders;
CREATE TRIGGER trg_order_cancel_items_tracking AFTER UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.order_cancel_items_tracking();

CREATE OR REPLACE FUNCTION public.update_order_item_tracking(
  _item_id uuid, _status text, _tracking_number text DEFAULT NULL, _carrier text DEFAULT NULL, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE it public.order_items%ROWTYPE; uid uuid := auth.uid(); is_admin boolean; t text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  SELECT * INTO it FROM public.order_items WHERE id = _item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ITEM_NOT_FOUND'; END IF;
  is_admin := public.has_any_admin_role(uid);
  IF NOT is_admin AND it.vendor_id <> uid THEN RAISE EXCEPTION 'NOT_ALLOWED'; END IF;
  IF length(coalesce(_tracking_number,'')) > 100 OR length(coalesce(_carrier,'')) > 100 OR length(coalesce(_note,'')) > 500 THEN
    RAISE EXCEPTION 'INVALID_INPUT'; END IF;
  t := public.normalize_order_status(_status);
  IF t <> public.normalize_order_status(it.tracking_status) THEN
    IF NOT public.order_status_can_transition(it.tracking_status, t, CASE WHEN is_admin THEN 'admin' ELSE 'seller' END) THEN
      RAISE EXCEPTION 'INVALID_STATUS_TRANSITION'; END IF;
  END IF;
  UPDATE public.order_items SET
    tracking_status = t,
    tracking_number = COALESCE(NULLIF(trim(_tracking_number),''), tracking_number),
    shipping_carrier = COALESCE(NULLIF(trim(_carrier),''), shipping_carrier),
    tracking_updated_at = now()
  WHERE id = _item_id;
  INSERT INTO public.order_item_status_history(order_item_id, status, note, tracking_number, changed_by)
  VALUES (_item_id, t, NULLIF(trim(_note),''), NULLIF(trim(_tracking_number),''), uid);
END $$;
REVOKE ALL ON FUNCTION public.update_order_item_tracking(uuid,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_order_item_tracking(uuid,text,text,text,text) TO authenticated;