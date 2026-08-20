-- ============ 1. ORDERS COLUMNS ============
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_number text,
  ADD COLUMN IF NOT EXISTS invoice_number text,
  ADD COLUMN IF NOT EXISTS subtotal_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS shipped_at timestamptz,
  ADD COLUMN IF NOT EXISTS shipping_notes text;

CREATE SEQUENCE IF NOT EXISTS public.order_number_seq START 1000;

CREATE OR REPLACE FUNCTION public.next_order_number()
RETURNS text
LANGUAGE sql
VOLATILE
SET search_path TO 'public'
AS $$
  SELECT 'SO-' || to_char(now(), 'YYMM') || '-' || lpad(nextval('public.order_number_seq')::text, 6, '0');
$$;

CREATE OR REPLACE FUNCTION public.orders_set_numbers()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.order_number IS NULL OR length(trim(NEW.order_number)) = 0 THEN
    NEW.order_number := public.next_order_number();
  END IF;
  IF NEW.invoice_number IS NULL OR length(trim(NEW.invoice_number)) = 0 THEN
    NEW.invoice_number := 'INV-' || substr(NEW.order_number, 4);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_set_numbers ON public.orders;
CREATE TRIGGER trg_orders_set_numbers
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_set_numbers();

-- backfill existing orders in creation order
WITH ranked AS (
  SELECT id, row_number() OVER (ORDER BY created_at ASC) AS rn, created_at
  FROM public.orders WHERE order_number IS NULL
)
UPDATE public.orders o
   SET order_number = 'SO-' || to_char(r.created_at, 'YYMM') || '-' || lpad((r.rn)::text, 6, '0'),
       invoice_number = 'INV-' || to_char(r.created_at, 'YYMM') || '-' || lpad((r.rn)::text, 6, '0')
  FROM ranked r
 WHERE o.id = r.id;

UPDATE public.orders o
   SET subtotal_amount = COALESCE(s.sum_items, 0),
       shipping_amount = GREATEST(COALESCE(o.total_amount,0) + COALESCE(o.discount_amount,0) - COALESCE(s.sum_items,0), 0)
  FROM (SELECT order_id, SUM(price * quantity) AS sum_items FROM public.order_items GROUP BY order_id) s
 WHERE o.id = s.order_id AND o.subtotal_amount = 0;

CREATE UNIQUE INDEX IF NOT EXISTS orders_order_number_key ON public.orders (order_number);
CREATE UNIQUE INDEX IF NOT EXISTS orders_invoice_number_key ON public.orders (invoice_number);
CREATE INDEX IF NOT EXISTS orders_status_created_idx ON public.orders (status, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_customer_created_idx ON public.orders (customer_id, created_at DESC);

-- ============ 2. ORDER ITEMS SNAPSHOT ============
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS variant_label text,
  ADD COLUMN IF NOT EXISTS discount_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subtotal numeric,
  ADD COLUMN IF NOT EXISTS product_name text,
  ADD COLUMN IF NOT EXISTS product_image text;

UPDATE public.order_items oi
   SET subtotal = COALESCE(oi.subtotal, oi.price * oi.quantity),
       product_name = COALESCE(oi.product_name, p.name),
       product_image = COALESCE(oi.product_image, p.image_url)
  FROM public.products p
 WHERE p.id = oi.product_id
   AND (oi.subtotal IS NULL OR oi.product_name IS NULL OR oi.product_image IS NULL);

UPDATE public.order_items SET subtotal = price * quantity WHERE subtotal IS NULL;

CREATE INDEX IF NOT EXISTS order_items_vendor_idx ON public.order_items (vendor_id, order_id);

-- ============ 3. SHIPPING DETAILS ============
CREATE TABLE IF NOT EXISTS public.shipping_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  shipping_company text,
  tracking_number text,
  estimated_delivery timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  shipping_notes text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.shipping_details TO authenticated;
GRANT ALL ON public.shipping_details TO service_role;
ALTER TABLE public.shipping_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shipping_details_participants_read" ON public.shipping_details
  FOR SELECT TO authenticated
  USING (
    public.has_any_admin_role(auth.uid())
    OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id = shipping_details.order_id AND o.customer_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = shipping_details.order_id AND oi.vendor_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS shipping_details_order_idx ON public.shipping_details (order_id);

-- ============ 4. TRACKING HISTORY ============
CREATE TABLE IF NOT EXISTS public.tracking_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status text NOT NULL,
  description text,
  location text,
  actor_role text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.tracking_history TO authenticated;
GRANT ALL ON public.tracking_history TO service_role;
ALTER TABLE public.tracking_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tracking_history_participants_read" ON public.tracking_history
  FOR SELECT TO authenticated
  USING (
    public.has_any_admin_role(auth.uid())
    OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id = tracking_history.order_id AND o.customer_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = tracking_history.order_id AND oi.vendor_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS tracking_history_order_idx ON public.tracking_history (order_id, created_at DESC);

-- ============ 5. ORDER NOTES ============
CREATE TABLE IF NOT EXISTS public.order_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  author_id uuid,
  author_role text NOT NULL,
  note text NOT NULL,
  is_internal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.order_notes TO authenticated;
GRANT ALL ON public.order_notes TO service_role;
ALTER TABLE public.order_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_notes_participants_read" ON public.order_notes
  FOR SELECT TO authenticated
  USING (
    public.has_any_admin_role(auth.uid())
    OR (
      NOT is_internal
      AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_notes.order_id AND o.customer_id = auth.uid())
    )
    OR EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = order_notes.order_id AND oi.vendor_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS order_notes_order_idx ON public.order_notes (order_id, created_at DESC);

-- ============ 6. SYNC TRIGGERS ============
CREATE OR REPLACE FUNCTION public.sync_order_shipping_details()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.shipping_details (
    order_id, shipping_company, tracking_number, estimated_delivery,
    shipped_at, delivered_at, shipping_notes, updated_by, updated_at
  ) VALUES (
    NEW.id, NEW.courier_name, NEW.tracking_number, NEW.estimated_delivery,
    NEW.shipped_at, NEW.delivered_at, COALESCE(NEW.shipping_notes, NEW.delivery_notes), auth.uid(), now()
  )
  ON CONFLICT (order_id) DO UPDATE
    SET shipping_company = COALESCE(EXCLUDED.shipping_company, public.shipping_details.shipping_company),
        tracking_number = COALESCE(EXCLUDED.tracking_number, public.shipping_details.tracking_number),
        estimated_delivery = COALESCE(EXCLUDED.estimated_delivery, public.shipping_details.estimated_delivery),
        shipped_at = COALESCE(EXCLUDED.shipped_at, public.shipping_details.shipped_at),
        delivered_at = COALESCE(EXCLUDED.delivered_at, public.shipping_details.delivered_at),
        shipping_notes = COALESCE(EXCLUDED.shipping_notes, public.shipping_details.shipping_notes),
        updated_by = COALESCE(EXCLUDED.updated_by, public.shipping_details.updated_by),
        updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_shipping_details ON public.orders;
CREATE TRIGGER trg_sync_shipping_details
  AFTER INSERT OR UPDATE OF courier_name, tracking_number, estimated_delivery, shipped_at, delivered_at, shipping_notes, delivery_notes
  ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.sync_order_shipping_details();

CREATE OR REPLACE FUNCTION public.sync_tracking_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.tracking_history (order_id, status, description, actor_role, created_at)
  VALUES (NEW.order_id, NEW.status, NEW.notes, COALESCE(NEW.changed_by_role, 'system'), COALESCE(NEW.created_at, now()));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_tracking_history ON public.order_status_history;
CREATE TRIGGER trg_sync_tracking_history
  AFTER INSERT ON public.order_status_history
  FOR EACH ROW EXECUTE FUNCTION public.sync_tracking_history();

-- seed tracking history + shipping details from existing data
INSERT INTO public.tracking_history (order_id, status, description, actor_role, created_at)
SELECT h.order_id, h.status, h.notes, COALESCE(h.changed_by_role, 'system'), h.created_at
  FROM public.order_status_history h
 WHERE NOT EXISTS (SELECT 1 FROM public.tracking_history t WHERE t.order_id = h.order_id);

INSERT INTO public.shipping_details (order_id, shipping_company, tracking_number, estimated_delivery, delivered_at, shipping_notes)
SELECT o.id, o.courier_name, o.tracking_number, o.estimated_delivery, o.delivered_at, o.delivery_notes
  FROM public.orders o
 WHERE NOT EXISTS (SELECT 1 FROM public.shipping_details s WHERE s.order_id = o.id);