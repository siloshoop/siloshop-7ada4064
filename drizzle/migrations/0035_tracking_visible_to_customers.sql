ALTER TABLE public.orders ALTER COLUMN shipment_tracking_enabled SET DEFAULT true;
UPDATE public.orders SET shipment_tracking_enabled = true WHERE shipment_tracking_enabled IS DISTINCT FROM true;
CREATE OR REPLACE FUNCTION public.force_shipment_tracking_visible() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.shipment_tracking_enabled := true; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_force_shipment_tracking_visible ON public.orders;
CREATE TRIGGER trg_force_shipment_tracking_visible BEFORE INSERT OR UPDATE OF shipment_tracking_enabled ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.force_shipment_tracking_visible();