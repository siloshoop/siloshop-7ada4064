-- 1. Return reasons (admin managed)
CREATE TABLE IF NOT EXISTS public.return_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  label_ar text NOT NULL,
  label_en text,
  requires_images boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.return_reasons TO anon;
GRANT SELECT ON public.return_reasons TO authenticated;
GRANT ALL ON public.return_reasons TO service_role;
ALTER TABLE public.return_reasons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reasons_public_read" ON public.return_reasons;
CREATE POLICY "reasons_public_read" ON public.return_reasons FOR SELECT USING (is_active OR public.has_any_admin_role(auth.uid()));
DROP POLICY IF EXISTS "reasons_admin_write" ON public.return_reasons;
CREATE POLICY "reasons_admin_write" ON public.return_reasons FOR ALL TO authenticated
  USING (public.has_any_admin_role(auth.uid())) WITH CHECK (public.has_any_admin_role(auth.uid()));

INSERT INTO public.return_reasons (code, label_ar, label_en, requires_images, sort_order) VALUES
  ('wrong_product','منتج خاطئ','Wrong Product', true, 1),
  ('damaged','منتج تالف','Damaged Product', true, 2),
  ('defective','منتج معيب لا يعمل','Defective Product', true, 3),
  ('missing_parts','أجزاء ناقصة','Missing Parts', true, 4),
  ('incorrect_size','مقاس غير صحيح','Incorrect Size', false, 5),
  ('incorrect_color','لون غير صحيح','Incorrect Color', false, 6),
  ('not_as_described','مختلف عن الوصف','Not As Described', true, 7),
  ('poor_quality','جودة سيئة','Poor Quality', true, 8),
  ('other','سبب آخر','Other', false, 99)
ON CONFLICT (code) DO NOTHING;

-- 2. Return window setting
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS return_window_days int NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS returns_replacement_enabled boolean NOT NULL DEFAULT false;

-- 3. returns table upgrade
ALTER TABLE public.returns
  ADD COLUMN IF NOT EXISTS return_number text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS resolution_type text NOT NULL DEFAULT 'refund',
  ADD COLUMN IF NOT EXISTS inspection_result text,
  ADD COLUMN IF NOT EXISTS inspection_note text,
  ADD COLUMN IF NOT EXISTS inspection_at timestamptz,
  ADD COLUMN IF NOT EXISTS carrier text,
  ADD COLUMN IF NOT EXISTS tracking_number text,
  ADD COLUMN IF NOT EXISTS arrival_date date,
  ADD COLUMN IF NOT EXISTS assigned_staff_id uuid,
  ADD COLUMN IF NOT EXISTS admin_note text,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_replacement boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS replacement_order_id uuid,
  ADD COLUMN IF NOT EXISTS refund_amount numeric(14,2),
  ADD COLUMN IF NOT EXISTS refund_method text NOT NULL DEFAULT 'cod_manual',
  ADD COLUMN IF NOT EXISTS return_window_days int NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS last_actor_role text;

UPDATE public.returns SET description = COALESCE(description, notes) WHERE description IS NULL;

ALTER TABLE public.returns DROP CONSTRAINT IF EXISTS returns_status_check;
ALTER TABLE public.returns DROP CONSTRAINT IF EXISTS returns_reason_check;

UPDATE public.returns SET status = CASE status
  WHEN 'pending' THEN 'pending_review'
  WHEN 'under_review' THEN 'seller_reviewing'
  WHEN 'info_requested' THEN 'waiting_customer'
  WHEN 'awaiting_return' THEN 'approved'
  WHEN 'return_in_progress' THEN 'customer_shipping'
  WHEN 'item_shipped' THEN 'customer_shipping'
  WHEN 'returned' THEN 'seller_inspecting'
  WHEN 'refunded' THEN 'completed'
  WHEN 'closed' THEN 'completed'
  ELSE status END;

ALTER TABLE public.returns ADD CONSTRAINT returns_status_check CHECK (status IN (
  'pending_review','seller_reviewing','waiting_customer','approved','rejected',
  'customer_shipping','seller_inspecting','inspection_passed','inspection_failed',
  'completed','cancelled'));
ALTER TABLE public.returns ALTER COLUMN status SET DEFAULT 'pending_review';
ALTER TABLE public.returns ADD CONSTRAINT returns_resolution_check CHECK (resolution_type IN ('refund','replacement','partial','none'));
ALTER TABLE public.returns ADD CONSTRAINT returns_inspection_check CHECK (inspection_result IS NULL OR inspection_result IN ('accepted','rejected','partial'));

DROP INDEX IF EXISTS public.returns_unique_active_per_item;
DROP INDEX IF EXISTS public.returns_unique_active_per_order;
CREATE UNIQUE INDEX returns_unique_active_per_item ON public.returns (order_item_id)
  WHERE order_item_id IS NOT NULL AND status NOT IN ('completed','rejected','cancelled');
CREATE UNIQUE INDEX returns_unique_active_per_order ON public.returns (order_id)
  WHERE order_item_id IS NULL AND status NOT IN ('completed','rejected','cancelled');
CREATE INDEX IF NOT EXISTS returns_status_idx ON public.returns (status, created_at DESC);
CREATE INDEX IF NOT EXISTS returns_number_idx ON public.returns (return_number);
CREATE INDEX IF NOT EXISTS returns_staff_idx ON public.returns (assigned_staff_id) WHERE assigned_staff_id IS NOT NULL;

-- 4. Return number generator
CREATE SEQUENCE IF NOT EXISTS public.return_number_seq;
CREATE OR REPLACE FUNCTION public.returns_set_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.return_number IS NULL THEN
    NEW.return_number := 'RT-' || to_char(now(), 'YYMM') || '-' || lpad(nextval('public.return_number_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_returns_set_number ON public.returns;
CREATE TRIGGER trg_returns_set_number BEFORE INSERT ON public.returns
  FOR EACH ROW EXECUTE FUNCTION public.returns_set_number();
UPDATE public.returns SET return_number = 'RT-' || to_char(created_at, 'YYMM') || '-' || lpad(nextval('public.return_number_seq')::text, 6, '0') WHERE return_number IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS returns_number_unique ON public.returns (return_number);

-- 5. Child tables
CREATE TABLE IF NOT EXISTS public.return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL REFERENCES public.returns(id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  product_id uuid,
  product_name text,
  product_image text,
  variant_label text,
  quantity int NOT NULL CHECK (quantity > 0),
  unit_price numeric(14,2) NOT NULL DEFAULT 0,
  item_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (return_id, order_item_id)
);

CREATE TABLE IF NOT EXISTS public.return_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL REFERENCES public.returns(id) ON DELETE CASCADE,
  url text NOT NULL,
  kind text NOT NULL DEFAULT 'product' CHECK (kind IN ('damage','package','product','inspection','proof')),
  uploaded_by uuid,
  uploader_role text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.return_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL REFERENCES public.returns(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  sender_role text NOT NULL CHECK (sender_role IN ('customer','vendor','admin')),
  body text,
  attachments text[] NOT NULL DEFAULT '{}',
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (body IS NOT NULL OR array_length(attachments,1) > 0)
);

CREATE TABLE IF NOT EXISTS public.return_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL REFERENCES public.returns(id) ON DELETE CASCADE,
  author_id uuid,
  author_role text,
  note text NOT NULL,
  is_internal boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS return_items_return_idx ON public.return_items (return_id);
CREATE INDEX IF NOT EXISTS return_items_product_idx ON public.return_items (product_id);
CREATE INDEX IF NOT EXISTS return_images_return_idx ON public.return_images (return_id, created_at);
CREATE INDEX IF NOT EXISTS return_messages_return_idx ON public.return_messages (return_id, created_at);
CREATE INDEX IF NOT EXISTS return_notes_return_idx ON public.return_notes (return_id, created_at);

-- 6. Access helper
CREATE OR REPLACE FUNCTION public.return_actor_role(_return_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _r public.returns%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO _r FROM public.returns WHERE id = _return_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF _r.customer_id = _uid THEN RETURN 'customer'; END IF;
  IF _r.vendor_id = _uid THEN RETURN 'vendor'; END IF;
  IF public.has_any_admin_role(_uid) THEN RETURN 'admin'; END IF;
  RETURN NULL;
END; $$;
REVOKE ALL ON FUNCTION public.return_actor_role(uuid) FROM public;
REVOKE ALL ON FUNCTION public.return_actor_role(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.return_actor_role(uuid) TO authenticated, service_role;

-- 7. Grants + RLS on child tables
GRANT SELECT ON public.return_items TO authenticated;
GRANT SELECT ON public.return_images TO authenticated;
GRANT SELECT ON public.return_messages TO authenticated;
GRANT UPDATE (is_read, read_at) ON public.return_messages TO authenticated;
GRANT SELECT ON public.return_notes TO authenticated;
GRANT ALL ON public.return_items TO service_role;
GRANT ALL ON public.return_images TO service_role;
GRANT ALL ON public.return_messages TO service_role;
GRANT ALL ON public.return_notes TO service_role;

ALTER TABLE public.return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "return_items_read" ON public.return_items;
CREATE POLICY "return_items_read" ON public.return_items FOR SELECT TO authenticated
  USING (public.return_actor_role(return_id) IS NOT NULL);
DROP POLICY IF EXISTS "return_images_read" ON public.return_images;
CREATE POLICY "return_images_read" ON public.return_images FOR SELECT TO authenticated
  USING (public.return_actor_role(return_id) IS NOT NULL);
DROP POLICY IF EXISTS "return_messages_read" ON public.return_messages;
CREATE POLICY "return_messages_read" ON public.return_messages FOR SELECT TO authenticated
  USING (public.return_actor_role(return_id) IS NOT NULL);
DROP POLICY IF EXISTS "return_messages_mark_read" ON public.return_messages;
CREATE POLICY "return_messages_mark_read" ON public.return_messages FOR UPDATE TO authenticated
  USING (public.return_actor_role(return_id) IS NOT NULL AND sender_id <> auth.uid())
  WITH CHECK (public.return_actor_role(return_id) IS NOT NULL AND sender_id <> auth.uid());
DROP POLICY IF EXISTS "return_notes_read" ON public.return_notes;
CREATE POLICY "return_notes_read" ON public.return_notes FOR SELECT TO authenticated
  USING (public.return_actor_role(return_id) IS NOT NULL
     AND (NOT is_internal OR public.return_actor_role(return_id) IN ('vendor','admin')));

DROP POLICY IF EXISTS "Vendors can update their returns" ON public.returns;
DROP POLICY IF EXISTS "Admins can update all returns" ON public.returns;
CREATE POLICY "Admins can update all returns" ON public.returns FOR UPDATE TO authenticated
  USING (public.has_any_admin_role(auth.uid())) WITH CHECK (public.has_any_admin_role(auth.uid()));

-- 8. Realtime
ALTER TABLE public.return_messages REPLICA IDENTITY FULL;
ALTER TABLE public.return_images REPLICA IDENTITY FULL;
ALTER TABLE public.returns REPLICA IDENTITY FULL;
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.return_messages; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.return_images; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;