-- 1. Keep tracking_status in sync with the authoritative order status
CREATE OR REPLACE FUNCTION public.sync_order_tracking_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.tracking_status := COALESCE(NEW.tracking_status, NEW.status);
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.tracking_status IS NOT DISTINCT FROM OLD.tracking_status THEN
    NEW.tracking_status := NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_order_tracking_status ON public.orders;
CREATE TRIGGER trg_sync_order_tracking_status
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.sync_order_tracking_status();

-- 2. Realtime for shipping/tracking tables used by the tracking page
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tracking_history;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.shipping_details;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- 3. Public reviews with reviewer display name (profiles are not readable directly)
CREATE OR REPLACE FUNCTION public.get_product_reviews(_product_id uuid)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  rating integer,
  comment text,
  image_url text,
  created_at timestamptz,
  reviewer_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.user_id, r.rating, r.comment, r.image_url, r.created_at,
         COALESCE(NULLIF(btrim(pr.full_name), ''), 'مستخدم سيلو شوب')
  FROM public.reviews r
  LEFT JOIN public.profiles pr ON pr.id = r.user_id
  WHERE r.product_id = _product_id
    AND (r.is_hidden = false OR r.user_id = auth.uid())
  ORDER BY r.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_product_reviews(uuid) TO anon, authenticated;