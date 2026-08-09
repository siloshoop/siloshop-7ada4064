-- =========================================================
-- 1. Order history log: actor + device + previous status
-- =========================================================
ALTER TABLE public.order_status_history
  ADD COLUMN IF NOT EXISTS from_status text,
  ADD COLUMN IF NOT EXISTS changed_by uuid,
  ADD COLUMN IF NOT EXISTS changed_by_role text,
  ADD COLUMN IF NOT EXISTS ip_address text,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS is_override boolean NOT NULL DEFAULT false;

DO $$ BEGIN
  ALTER TABLE public.order_status_history
    ADD CONSTRAINT order_status_history_role_check
    CHECK (changed_by_role IS NULL OR changed_by_role IN ('system','buyer','seller','admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DROP POLICY IF EXISTS "Admins can view all order history" ON public.order_status_history;
CREATE POLICY "Admins can view all order history"
  ON public.order_status_history FOR SELECT TO authenticated
  USING (public.has_any_admin_role(auth.uid()));

-- =========================================================
-- 2. Orders: shipping info, estimated delivery, freeze, refund
-- =========================================================
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS driver_name text,
  ADD COLUMN IF NOT EXISTS driver_phone text,
  ADD COLUMN IF NOT EXISTS delivery_notes text,
  ADD COLUMN IF NOT EXISTS is_frozen boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS frozen_reason text,
  ADD COLUMN IF NOT EXISTS frozen_by uuid,
  ADD COLUMN IF NOT EXISTS frozen_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

DO $$ BEGIN
  ALTER TABLE public.orders
    ADD CONSTRAINT orders_refund_status_check
    CHECK (refund_status IN ('none','pending','approved','refunded','closed'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Normalise legacy status value
UPDATE public.orders SET status = 'preparing' WHERE status = 'processing';

-- =========================================================
-- 3. Status model helpers
-- =========================================================
CREATE OR REPLACE FUNCTION public.normalize_order_status(_status text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE lower(trim(coalesce(_status,'')))
           WHEN 'processing' THEN 'preparing'
           ELSE lower(trim(coalesce(_status,'')))
         END;
$$;

CREATE OR REPLACE FUNCTION public.is_valid_order_status(_status text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT public.normalize_order_status(_status) IN (
    'pending','confirmed','preparing','ready_for_shipping','shipped',
    'out_for_delivery','delivered','completed','cancelled','returned'
  );
$$;

CREATE OR REPLACE FUNCTION public.order_status_can_transition(_from text, _to text, _role text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE f text := public.normalize_order_status(_from);
        t text := public.normalize_order_status(_to);
        allowed text[];
BEGIN
  IF NOT public.is_valid_order_status(t) THEN RETURN false; END IF;
  IF f = t THEN RETURN false; END IF;

  allowed := CASE f
    WHEN 'pending'            THEN ARRAY['confirmed','cancelled']
    WHEN 'confirmed'          THEN ARRAY['preparing','cancelled']
    WHEN 'preparing'          THEN ARRAY['ready_for_shipping','cancelled']
    WHEN 'ready_for_shipping' THEN ARRAY['shipped','cancelled']
    WHEN 'shipped'            THEN ARRAY['out_for_delivery','delivered','returned']
    WHEN 'out_for_delivery'   THEN ARRAY['delivered','returned']
    WHEN 'delivered'          THEN ARRAY['completed','returned']
    WHEN 'completed'          THEN ARRAY['returned']
    ELSE ARRAY[]::text[]
  END;

  IF NOT (t = ANY(allowed)) THEN RETURN false; END IF;

  -- Buyers may only cancel; sellers may not mark completed/returned
  IF _role = 'buyer' AND t <> 'cancelled' THEN RETURN false; END IF;
  IF _role = 'seller' AND t IN ('completed','returned') THEN RETURN false; END IF;

  RETURN true;
END; $$;

-- =========================================================
-- 4. Unified, audited status update
-- =========================================================
CREATE OR REPLACE FUNCTION public.update_order_status(
  _order_id uuid,
  _status text,
  _note text DEFAULT NULL,
  _ip_address text DEFAULT NULL,
  _user_agent text DEFAULT NULL,
  _override boolean DEFAULT false
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _o public.orders%ROWTYPE;
  _role text;
  _new text := public.normalize_order_status(_status);
  _is_admin boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.is_valid_order_status(_new) THEN RAISE EXCEPTION 'invalid_status'; END IF;

  SELECT * INTO _o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;

  _is_admin := public.has_any_admin_role(_uid);
  IF _is_admin THEN _role := 'admin';
  ELSIF EXISTS (SELECT 1 FROM public.order_items WHERE order_id = _order_id AND vendor_id = _uid) THEN _role := 'seller';
  ELSIF _o.customer_id = _uid THEN _role := 'buyer';
  ELSE RAISE EXCEPTION 'not_authorized'; END IF;

  IF _o.is_frozen AND NOT _is_admin THEN RAISE EXCEPTION 'order_frozen'; END IF;
  IF public.normalize_order_status(_o.status) = _new THEN RAISE EXCEPTION 'duplicate_status'; END IF;

  IF NOT public.order_status_can_transition(_o.status, _new, _role) THEN
    IF NOT (_is_admin AND _override) THEN RAISE EXCEPTION 'invalid_transition'; END IF;
  END IF;

  UPDATE public.orders
     SET status = _new,
         delivered_at = CASE WHEN _new = 'delivered' AND delivered_at IS NULL THEN now() ELSE delivered_at END,
         completed_at = CASE WHEN _new = 'completed' AND completed_at IS NULL THEN now() ELSE completed_at END,
         updated_at = now()
   WHERE id = _order_id;

  INSERT INTO public.order_status_history
    (order_id, status, from_status, notes, changed_by, changed_by_role, ip_address, user_agent, is_override)
  VALUES (_order_id, _new, _o.status, _note, _uid, _role, _ip_address, _user_agent,
          COALESCE(_override,false) AND NOT public.order_status_can_transition(_o.status, _new, _role));

  INSERT INTO public.activity_logs (user_id, action_type, action_details, ip_address, user_agent)
  VALUES (_uid, 'order_status_update',
          jsonb_build_object('order_id', _order_id, 'from', _o.status, 'to', _new,
                             'role', _role, 'override', COALESCE(_override,false), 'note', _note),
          _ip_address, _user_agent);
END; $$;

-- =========================================================
-- 5. Shipping information (seller / admin)
-- =========================================================
CREATE OR REPLACE FUNCTION public.set_order_shipping_info(
  _order_id uuid,
  _courier_name text DEFAULT NULL,
  _tracking_number text DEFAULT NULL,
  _driver_name text DEFAULT NULL,
  _driver_phone text DEFAULT NULL,
  _delivery_notes text DEFAULT NULL,
  _estimated_delivery timestamptz DEFAULT NULL,
  _ip_address text DEFAULT NULL,
  _user_agent text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _o public.orders%ROWTYPE;
  _role text;
  _is_admin boolean;
  _eta_changed boolean := false;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO _o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;

  _is_admin := public.has_any_admin_role(_uid);
  IF _is_admin THEN _role := 'admin';
  ELSIF EXISTS (SELECT 1 FROM public.order_items WHERE order_id = _order_id AND vendor_id = _uid) THEN _role := 'seller';
  ELSE RAISE EXCEPTION 'not_authorized'; END IF;

  IF _o.is_frozen AND NOT _is_admin THEN RAISE EXCEPTION 'order_frozen'; END IF;

  _eta_changed := _estimated_delivery IS NOT NULL
    AND (_o.estimated_delivery IS NULL OR date_trunc('minute', _o.estimated_delivery) <> date_trunc('minute', _estimated_delivery));

  UPDATE public.orders
     SET courier_name = COALESCE(NULLIF(trim(COALESCE(_courier_name,'')),''), courier_name),
         tracking_number = COALESCE(NULLIF(trim(COALESCE(_tracking_number,'')),''), tracking_number),
         driver_name = COALESCE(NULLIF(trim(COALESCE(_driver_name,'')),''), driver_name),
         driver_phone = COALESCE(NULLIF(trim(COALESCE(_driver_phone,'')),''), driver_phone),
         delivery_notes = COALESCE(NULLIF(trim(COALESCE(_delivery_notes,'')),''), delivery_notes),
         estimated_delivery = COALESCE(_estimated_delivery, estimated_delivery),
         updated_at = now()
   WHERE id = _order_id;

  IF _eta_changed THEN
    INSERT INTO public.notifications (user_id, title, message, type, related_id)
    VALUES (_o.customer_id, 'تحديث موعد التسليم المتوقع',
            'تم تحديث موعد التسليم المتوقع لطلبك #' || substr(_order_id::text,1,8) ||
            ' إلى ' || to_char(_estimated_delivery, 'YYYY-MM-DD'),
            'order_status', _order_id);
  END IF;

  INSERT INTO public.activity_logs (user_id, action_type, action_details, ip_address, user_agent)
  VALUES (_uid, 'order_shipping_update',
          jsonb_build_object('order_id', _order_id, 'role', _role,
                             'courier', _courier_name, 'tracking', _tracking_number,
                             'driver', _driver_name, 'eta_changed', _eta_changed),
          _ip_address, _user_agent);
END; $$;

-- =========================================================
-- 6. Admin control: freeze / reopen / refund workflow
-- =========================================================
CREATE OR REPLACE FUNCTION public.admin_set_order_freeze(
  _order_id uuid, _frozen boolean, _reason text DEFAULT NULL,
  _ip_address text DEFAULT NULL, _user_agent text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _o public.orders%ROWTYPE;
BEGIN
  IF NOT public.has_any_admin_role(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  SELECT * INTO _o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;
  IF _frozen AND (_reason IS NULL OR length(trim(_reason)) = 0) THEN RAISE EXCEPTION 'reason_required'; END IF;
  IF _o.is_frozen = _frozen THEN RAISE EXCEPTION 'duplicate_status'; END IF;

  UPDATE public.orders
     SET is_frozen = _frozen,
         frozen_reason = CASE WHEN _frozen THEN _reason ELSE NULL END,
         frozen_by = CASE WHEN _frozen THEN auth.uid() ELSE NULL END,
         frozen_at = CASE WHEN _frozen THEN now() ELSE NULL END,
         updated_at = now()
   WHERE id = _order_id;

  INSERT INTO public.order_status_history
    (order_id, status, from_status, notes, changed_by, changed_by_role, ip_address, user_agent)
  VALUES (_order_id, _o.status, _o.status,
          CASE WHEN _frozen THEN 'تجميد الطلب: ' || _reason ELSE 'إلغاء تجميد الطلب' END,
          auth.uid(), 'admin', _ip_address, _user_agent);

  INSERT INTO public.activity_logs (user_id, action_type, action_details, ip_address, user_agent)
  VALUES (auth.uid(), CASE WHEN _frozen THEN 'order_freeze' ELSE 'order_unfreeze' END,
          jsonb_build_object('order_id', _order_id, 'reason', _reason), _ip_address, _user_agent);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_reopen_order(
  _order_id uuid, _status text, _reason text,
  _ip_address text DEFAULT NULL, _user_agent text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _o public.orders%ROWTYPE; _new text := public.normalize_order_status(_status);
BEGIN
  IF NOT public.has_any_admin_role(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF _reason IS NULL OR length(trim(_reason)) = 0 THEN RAISE EXCEPTION 'reason_required'; END IF;
  IF NOT public.is_valid_order_status(_new) THEN RAISE EXCEPTION 'invalid_status'; END IF;
  IF _new IN ('cancelled','returned','completed') THEN RAISE EXCEPTION 'invalid_status'; END IF;

  SELECT * INTO _o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;
  IF public.normalize_order_status(_o.status) NOT IN ('cancelled','returned','completed','delivered') THEN
    RAISE EXCEPTION 'order_not_closed';
  END IF;

  UPDATE public.orders
     SET status = _new, cancelled_at = NULL, cancelled_by = NULL,
         cancelled_by_role = NULL, cancellation_reason = NULL, updated_at = now()
   WHERE id = _order_id;

  INSERT INTO public.order_status_history
    (order_id, status, from_status, notes, changed_by, changed_by_role, ip_address, user_agent, is_override)
  VALUES (_order_id, _new, _o.status, 'إعادة فتح الطلب: ' || _reason, auth.uid(), 'admin', _ip_address, _user_agent, true);

  INSERT INTO public.notifications (user_id, title, message, type, related_id)
  VALUES (_o.customer_id, 'تم إعادة فتح طلبك', 'السبب: ' || _reason, 'order_status', _order_id);

  INSERT INTO public.activity_logs (user_id, action_type, action_details, ip_address, user_agent)
  VALUES (auth.uid(), 'order_reopen',
          jsonb_build_object('order_id', _order_id, 'from', _o.status, 'to', _new, 'reason', _reason),
          _ip_address, _user_agent);
END; $$;

CREATE OR REPLACE FUNCTION public.update_refund_status(
  _order_id uuid, _status text, _note text DEFAULT NULL,
  _ip_address text DEFAULT NULL, _user_agent text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _o public.orders%ROWTYPE;
  _labels jsonb := jsonb_build_object('pending','بانتظار الاسترداد','approved','تمت الموافقة على الاسترداد',
                                      'refunded','تم رد المبلغ','closed','مغلق');
  _allowed text[];
BEGIN
  IF NOT public.has_any_admin_role(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF _status NOT IN ('pending','approved','refunded','closed') THEN RAISE EXCEPTION 'invalid_status'; END IF;

  SELECT * INTO _o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;
  IF _o.refund_status = _status THEN RAISE EXCEPTION 'duplicate_status'; END IF;

  _allowed := CASE _o.refund_status
    WHEN 'none'     THEN ARRAY['pending']
    WHEN 'pending'  THEN ARRAY['approved','closed']
    WHEN 'approved' THEN ARRAY['refunded','closed']
    WHEN 'refunded' THEN ARRAY['closed']
    ELSE ARRAY[]::text[] END;
  IF NOT (_status = ANY(_allowed)) THEN RAISE EXCEPTION 'invalid_transition'; END IF;

  UPDATE public.orders
     SET refund_status = _status,
         payment_status = CASE WHEN _status = 'refunded' THEN 'refunded' ELSE payment_status END,
         updated_at = now()
   WHERE id = _order_id;

  IF _status = 'refunded' THEN
    UPDATE public.payments
       SET payment_status = 'refunded',
           payment_details = COALESCE(payment_details,'{}'::jsonb) ||
             jsonb_build_object('refunded_at', now(), 'refunded_by', auth.uid(), 'refund_note', _note),
           updated_at = now()
     WHERE order_id = _order_id AND payment_status <> 'refunded';
  END IF;

  INSERT INTO public.order_status_history
    (order_id, status, from_status, notes, changed_by, changed_by_role, ip_address, user_agent)
  VALUES (_order_id, _o.status, _o.status,
          'الاسترداد: ' || COALESCE(_labels->>_status, _status) || COALESCE(' — ' || _note, ''),
          auth.uid(), 'admin', _ip_address, _user_agent);

  INSERT INTO public.notifications (user_id, title, message, type, related_id)
  VALUES (_o.customer_id, 'تحديث حالة الاسترداد',
          COALESCE(_labels->>_status, _status) || COALESCE(' — ' || _note, ''), 'order_refund', _order_id);

  INSERT INTO public.activity_logs (user_id, action_type, action_details, ip_address, user_agent)
  VALUES (auth.uid(), 'order_refund_update',
          jsonb_build_object('order_id', _order_id, 'from', _o.refund_status, 'to', _status, 'note', _note),
          _ip_address, _user_agent);
END; $$;

-- Admin final decision on a disputed return
CREATE OR REPLACE FUNCTION public.admin_resolve_return_dispute(
  _return_id uuid, _decision text, _note text,
  _ip_address text DEFAULT NULL, _user_agent text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _r public.returns%ROWTYPE; _new text;
BEGIN
  IF NOT public.has_any_admin_role(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF _decision NOT IN ('approve','reject') THEN RAISE EXCEPTION 'invalid_status'; END IF;
  IF _note IS NULL OR length(trim(_note)) = 0 THEN RAISE EXCEPTION 'reason_required'; END IF;

  SELECT * INTO _r FROM public.returns WHERE id = _return_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'return_not_found'; END IF;

  _new := CASE WHEN _decision = 'approve' THEN 'approved' ELSE 'rejected' END;
  IF _r.status = _new THEN RAISE EXCEPTION 'duplicate_status'; END IF;

  UPDATE public.returns
     SET status = _new, review_note = _note,
         resolved_at = CASE WHEN _new = 'rejected' THEN now() ELSE resolved_at END,
         updated_at = now()
   WHERE id = _return_id;

  INSERT INTO public.return_status_history (return_id, from_status, to_status, changed_by, changed_by_role, note)
  VALUES (_return_id, _r.status, _new, auth.uid(), 'admin', 'قرار الإدارة النهائي: ' || _note);

  IF _new = 'approved' THEN
    UPDATE public.orders SET refund_status = 'pending', updated_at = now()
     WHERE id = _r.order_id AND refund_status = 'none';
  END IF;

  INSERT INTO public.notifications (user_id, title, message, type, related_id)
  VALUES (_r.customer_id, 'قرار الإدارة في طلب الإرجاع', _note, 'return_status', _return_id),
         (_r.vendor_id, 'قرار الإدارة في طلب إرجاع', _note, 'return_status', _return_id);

  INSERT INTO public.activity_logs (user_id, action_type, action_details, ip_address, user_agent)
  VALUES (auth.uid(), 'return_dispute_resolved',
          jsonb_build_object('return_id', _return_id, 'decision', _decision, 'note', _note),
          _ip_address, _user_agent);
END; $$;

-- =========================================================
-- 7. Order timeline reader (buyer / seller / admin)
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_order_timeline(_order_id uuid)
RETURNS TABLE(
  id uuid, status text, from_status text, notes text,
  changed_by_role text, actor_name text, ip_address text, user_agent text,
  is_override boolean, created_at timestamptz
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _is_admin boolean; _is_customer boolean; _is_vendor boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  _is_admin := public.has_any_admin_role(_uid);
  SELECT EXISTS (SELECT 1 FROM public.orders WHERE id = _order_id AND customer_id = _uid) INTO _is_customer;
  SELECT EXISTS (SELECT 1 FROM public.order_items WHERE order_id = _order_id AND vendor_id = _uid) INTO _is_vendor;
  IF NOT (_is_admin OR _is_customer OR _is_vendor) THEN RAISE EXCEPTION 'not_authorized'; END IF;

  RETURN QUERY
  SELECT h.id, h.status, h.from_status, h.notes,
         COALESCE(h.changed_by_role,'system') AS changed_by_role,
         CASE WHEN _is_admin THEN p.full_name ELSE NULL END AS actor_name,
         CASE WHEN _is_admin THEN h.ip_address ELSE NULL END AS ip_address,
         CASE WHEN _is_admin THEN h.user_agent ELSE NULL END AS user_agent,
         h.is_override, h.created_at
  FROM public.order_status_history h
  LEFT JOIN public.profiles p ON p.id = h.changed_by
  WHERE h.order_id = _order_id
  ORDER BY h.created_at ASC;
END; $$;

-- =========================================================
-- 8. Seller performance metrics
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_seller_performance(_vendor_id uuid DEFAULT NULL)
RETURNS TABLE(
  total_orders bigint,
  delivered_orders bigint,
  cancelled_orders bigint,
  returned_orders bigint,
  avg_prep_hours numeric,
  avg_delivery_hours numeric,
  cancellation_rate numeric,
  return_rate numeric,
  satisfaction_score numeric,
  ratings_count bigint
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _vid uuid := COALESCE(_vendor_id, auth.uid());
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _vid <> auth.uid() AND NOT public.has_any_admin_role(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;

  RETURN QUERY
  WITH vo AS (
    SELECT DISTINCT o.id, o.status FROM public.orders o
    JOIN public.order_items oi ON oi.order_id = o.id
    WHERE oi.vendor_id = _vid
  ),
  prep AS (
    SELECT h.order_id,
           EXTRACT(EPOCH FROM (MIN(CASE WHEN h.status IN ('shipped','ready_for_shipping') THEN h.created_at END)
                             - MIN(CASE WHEN h.status = 'confirmed' THEN h.created_at END)))/3600 AS hrs
    FROM public.order_status_history h
    WHERE h.order_id IN (SELECT id FROM vo)
    GROUP BY h.order_id
  ),
  deliv AS (
    SELECT h.order_id,
           EXTRACT(EPOCH FROM (MIN(CASE WHEN h.status = 'delivered' THEN h.created_at END)
                             - MIN(CASE WHEN h.status = 'shipped' THEN h.created_at END)))/3600 AS hrs
    FROM public.order_status_history h
    WHERE h.order_id IN (SELECT id FROM vo)
    GROUP BY h.order_id
  ),
  tot AS (SELECT COUNT(*)::numeric AS n FROM vo)
  SELECT
    (SELECT COUNT(*) FROM vo)::bigint,
    (SELECT COUNT(*) FROM vo WHERE status IN ('delivered','completed'))::bigint,
    (SELECT COUNT(*) FROM vo WHERE status = 'cancelled')::bigint,
    (SELECT COUNT(DISTINCT order_id) FROM public.returns WHERE vendor_id = _vid)::bigint,
    ROUND(COALESCE((SELECT AVG(hrs) FROM prep WHERE hrs IS NOT NULL AND hrs >= 0), 0)::numeric, 2),
    ROUND(COALESCE((SELECT AVG(hrs) FROM deliv WHERE hrs IS NOT NULL AND hrs >= 0), 0)::numeric, 2),
    CASE WHEN (SELECT n FROM tot) > 0
      THEN ROUND((SELECT COUNT(*) FROM vo WHERE status = 'cancelled')::numeric * 100 / (SELECT n FROM tot), 2)
      ELSE 0 END,
    CASE WHEN (SELECT n FROM tot) > 0
      THEN ROUND((SELECT COUNT(DISTINCT order_id) FROM public.returns WHERE vendor_id = _vid)::numeric * 100 / (SELECT n FROM tot), 2)
      ELSE 0 END,
    ROUND(COALESCE((SELECT AVG(rating) FROM public.vendor_ratings WHERE vendor_id = _vid), 0)::numeric, 2),
    (SELECT COUNT(*) FROM public.vendor_ratings WHERE vendor_id = _vid)::bigint;
END; $$;

-- =========================================================
-- 9. Keep legacy RPCs consistent with the new model
-- =========================================================
CREATE OR REPLACE FUNCTION public.vendor_update_order_status(
  _order_id uuid, _status text, _tracking_number text DEFAULT NULL, _courier_name text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _tracking_number IS NOT NULL OR _courier_name IS NOT NULL THEN
    PERFORM public.set_order_shipping_info(_order_id, _courier_name, _tracking_number);
  END IF;
  PERFORM public.update_order_status(_order_id, _status);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_update_order_status(
  _order_id uuid, _status text, _tracking_number text DEFAULT NULL,
  _courier_name text DEFAULT NULL, _note text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_any_admin_role(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF _tracking_number IS NOT NULL OR _courier_name IS NOT NULL THEN
    PERFORM public.set_order_shipping_info(_order_id, _courier_name, _tracking_number);
  END IF;
  PERFORM public.update_order_status(_order_id, _status, _note, NULL, NULL, true);
END; $$;

CREATE INDEX IF NOT EXISTS idx_order_status_history_status ON public.order_status_history(status);
CREATE INDEX IF NOT EXISTS idx_orders_refund_status ON public.orders(refund_status);