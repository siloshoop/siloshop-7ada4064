
-- 1. delivered_at column + backfill trigger
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

CREATE OR REPLACE FUNCTION public.set_orders_delivered_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'delivered' AND (OLD.status IS DISTINCT FROM 'delivered') AND NEW.delivered_at IS NULL THEN
    NEW.delivered_at = now();
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_orders_delivered_at ON public.orders;
CREATE TRIGGER trg_orders_delivered_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_orders_delivered_at();

-- Backfill for existing delivered orders
UPDATE public.orders SET delivered_at = updated_at WHERE status = 'delivered' AND delivered_at IS NULL;

-- 2. returns table
CREATE TABLE IF NOT EXISTS public.returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id uuid REFERENCES public.order_items(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL,
  vendor_id uuid NOT NULL,
  reason text NOT NULL,
  notes text,
  images text[] NOT NULL DEFAULT '{}',
  video_url text,
  status text NOT NULL DEFAULT 'pending',
  review_note text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT returns_reason_check CHECK (reason IN (
    'damaged','wrong_product','missing_parts','not_as_described','defective','changed_mind','other'
  )),
  CONSTRAINT returns_status_check CHECK (status IN (
    'pending','under_review','approved','rejected','info_requested','return_in_progress','returned','refunded','closed'
  )),
  CONSTRAINT returns_images_max CHECK (array_length(images, 1) IS NULL OR array_length(images, 1) <= 10)
);

CREATE UNIQUE INDEX IF NOT EXISTS returns_unique_active_per_item
  ON public.returns(order_item_id)
  WHERE order_item_id IS NOT NULL AND status <> 'closed' AND status <> 'rejected';

CREATE UNIQUE INDEX IF NOT EXISTS returns_unique_active_per_order
  ON public.returns(order_id)
  WHERE order_item_id IS NULL AND status <> 'closed' AND status <> 'rejected';

CREATE INDEX IF NOT EXISTS returns_customer_idx ON public.returns(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS returns_vendor_idx ON public.returns(vendor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS returns_order_idx ON public.returns(order_id);

GRANT SELECT, INSERT, UPDATE ON public.returns TO authenticated;
GRANT ALL ON public.returns TO service_role;
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyers can view own returns" ON public.returns FOR SELECT
  TO authenticated USING (auth.uid() = customer_id);
CREATE POLICY "Vendors can view returns for their products" ON public.returns FOR SELECT
  TO authenticated USING (auth.uid() = vendor_id);
CREATE POLICY "Admins can view all returns" ON public.returns FOR SELECT
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Vendors can update their returns" ON public.returns FOR UPDATE
  TO authenticated USING (auth.uid() = vendor_id) WITH CHECK (auth.uid() = vendor_id);
CREATE POLICY "Admins can update all returns" ON public.returns FOR UPDATE
  TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
-- No direct INSERT policy; must go through create_return_request RPC

CREATE OR REPLACE FUNCTION public.update_returns_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_returns_updated_at ON public.returns;
CREATE TRIGGER trg_returns_updated_at BEFORE UPDATE ON public.returns
  FOR EACH ROW EXECUTE FUNCTION public.update_returns_updated_at();

-- 3. return_status_history
CREATE TABLE IF NOT EXISTS public.return_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL REFERENCES public.returns(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  changed_by uuid,
  changed_by_role text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS return_history_return_idx ON public.return_status_history(return_id, created_at);
GRANT SELECT, INSERT ON public.return_status_history TO authenticated;
GRANT ALL ON public.return_status_history TO service_role;
ALTER TABLE public.return_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Involved parties can view return history" ON public.return_status_history FOR SELECT
  TO authenticated USING (
    return_id IN (
      SELECT id FROM public.returns
      WHERE customer_id = auth.uid() OR vendor_id = auth.uid()
    ) OR public.has_role(auth.uid(), 'admin')
  );

-- 4. RPC: create_return_request
CREATE OR REPLACE FUNCTION public.create_return_request(
  _order_id uuid,
  _order_item_id uuid,
  _reason text,
  _notes text,
  _images text[],
  _video_url text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _order public.orders%ROWTYPE;
  _item public.order_items%ROWTYPE;
  _vendor uuid;
  _return_id uuid;
  _return_window_days constant int := 14;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO _order FROM public.orders WHERE id = _order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;
  IF _order.customer_id <> _uid THEN RAISE EXCEPTION 'not_order_owner'; END IF;
  IF _order.status <> 'delivered' THEN RAISE EXCEPTION 'order_not_delivered'; END IF;
  IF _order.delivered_at IS NULL OR _order.delivered_at < (now() - (_return_window_days || ' days')::interval) THEN
    RAISE EXCEPTION 'return_window_expired';
  END IF;

  IF _order_item_id IS NOT NULL THEN
    SELECT * INTO _item FROM public.order_items WHERE id = _order_item_id AND order_id = _order_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'order_item_not_found'; END IF;
    _vendor := _item.vendor_id;
  ELSE
    SELECT vendor_id INTO _vendor FROM public.order_items WHERE order_id = _order_id LIMIT 1;
    IF _vendor IS NULL THEN RAISE EXCEPTION 'no_vendor_for_order'; END IF;
  END IF;

  -- Duplicate check
  IF _order_item_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.returns WHERE order_item_id = _order_item_id AND status NOT IN ('closed','rejected')) THEN
      RAISE EXCEPTION 'duplicate_return_request';
    END IF;
  ELSE
    IF EXISTS (SELECT 1 FROM public.returns WHERE order_id = _order_id AND order_item_id IS NULL AND status NOT IN ('closed','rejected')) THEN
      RAISE EXCEPTION 'duplicate_return_request';
    END IF;
  END IF;

  IF _images IS NOT NULL AND array_length(_images, 1) > 10 THEN RAISE EXCEPTION 'too_many_images'; END IF;

  INSERT INTO public.returns (order_id, order_item_id, customer_id, vendor_id, reason, notes, images, video_url, status)
  VALUES (_order_id, _order_item_id, _uid, _vendor, _reason, _notes, COALESCE(_images, '{}'::text[]), _video_url, 'pending')
  RETURNING id INTO _return_id;

  INSERT INTO public.return_status_history (return_id, from_status, to_status, changed_by, changed_by_role, note)
  VALUES (_return_id, NULL, 'pending', _uid, 'customer', 'Return request submitted');

  -- Notify vendor
  INSERT INTO public.notifications (user_id, title, message, type, data)
  VALUES (_vendor, 'طلب إرجاع جديد', 'لديك طلب إرجاع جديد بانتظار المراجعة', 'return_created',
          jsonb_build_object('return_id', _return_id, 'order_id', _order_id));

  -- Order timeline
  BEGIN
    INSERT INTO public.order_status_history (order_id, status, note, created_by)
    VALUES (_order_id, 'return_requested', COALESCE(_notes, _reason), _uid);
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN _return_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.create_return_request(uuid,uuid,text,text,text[],text) TO authenticated;

-- 5. RPC: update_return_status (vendor/admin)
CREATE OR REPLACE FUNCTION public.update_return_status(
  _return_id uuid,
  _new_status text,
  _note text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _r public.returns%ROWTYPE;
  _role text;
  _valid text[] := ARRAY['pending','under_review','approved','rejected','info_requested','return_in_progress','returned','refunded','closed'];
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT (_new_status = ANY(_valid)) THEN RAISE EXCEPTION 'invalid_status'; END IF;

  SELECT * INTO _r FROM public.returns WHERE id = _return_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'return_not_found'; END IF;

  IF _uid = _r.vendor_id THEN _role := 'vendor';
  ELSIF public.has_role(_uid, 'admin') THEN _role := 'admin';
  ELSE RAISE EXCEPTION 'not_authorized'; END IF;

  UPDATE public.returns
    SET status = _new_status,
        review_note = COALESCE(_note, review_note),
        resolved_at = CASE WHEN _new_status IN ('refunded','closed','rejected') THEN now() ELSE resolved_at END
    WHERE id = _return_id;

  INSERT INTO public.return_status_history (return_id, from_status, to_status, changed_by, changed_by_role, note)
  VALUES (_return_id, _r.status, _new_status, _uid, _role, _note);

  -- Notify buyer
  INSERT INTO public.notifications (user_id, title, message, type, data)
  VALUES (_r.customer_id, 'تحديث طلب الإرجاع',
          'تم تحديث حالة طلب الإرجاع إلى: ' || _new_status,
          'return_status', jsonb_build_object('return_id', _return_id, 'status', _new_status));
END; $$;

GRANT EXECUTE ON FUNCTION public.update_return_status(uuid,text,text) TO authenticated;

-- 6. Storage policies on returns-media bucket (scoped to auth.uid()/<folder>)
CREATE POLICY "Users can upload own return media" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (
    bucket_id = 'returns-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "Users can read own return media" ON storage.objects FOR SELECT
  TO authenticated USING (
    bucket_id = 'returns-media'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.returns r
        WHERE r.vendor_id = auth.uid()
          AND name LIKE r.customer_id::text || '/%'
      )
      OR public.has_role(auth.uid(), 'admin')
    )
  );
CREATE POLICY "Users can delete own return media" ON storage.objects FOR DELETE
  TO authenticated USING (
    bucket_id = 'returns-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
