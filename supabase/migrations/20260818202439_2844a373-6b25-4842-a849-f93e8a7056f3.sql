-- 1. New columns
ALTER TABLE public.returns
  ADD COLUMN IF NOT EXISTS return_instructions text,
  ADD COLUMN IF NOT EXISTS return_address text,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS shipped_at timestamptz,
  ADD COLUMN IF NOT EXISTS received_at timestamptz;

-- 2. create_return_request: 7-day window, required description, max 5 images, notify seller + admins
CREATE OR REPLACE FUNCTION public.create_return_request(_order_id uuid, _order_item_id uuid, _reason text, _notes text, _images text[], _video_url text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _order public.orders%ROWTYPE;
  _item public.order_items%ROWTYPE;
  _vendor uuid;
  _return_id uuid;
  _return_window_days constant int := 7;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO _order FROM public.orders WHERE id = _order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;
  IF _order.customer_id <> _uid THEN RAISE EXCEPTION 'not_order_owner'; END IF;
  IF _order.status <> 'delivered' THEN RAISE EXCEPTION 'order_not_delivered'; END IF;
  IF _order.delivered_at IS NULL OR _order.delivered_at < (now() - (_return_window_days || ' days')::interval) THEN
    RAISE EXCEPTION 'return_window_expired';
  END IF;

  IF _reason IS NULL OR length(trim(_reason)) = 0 THEN RAISE EXCEPTION 'reason_required'; END IF;
  IF _notes IS NULL OR length(trim(_notes)) < 10 THEN RAISE EXCEPTION 'description_required'; END IF;
  IF _images IS NOT NULL AND array_length(_images, 1) > 5 THEN RAISE EXCEPTION 'too_many_images'; END IF;

  IF _order_item_id IS NOT NULL THEN
    SELECT * INTO _item FROM public.order_items WHERE id = _order_item_id AND order_id = _order_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'order_item_not_found'; END IF;
    _vendor := _item.vendor_id;
  ELSE
    SELECT vendor_id INTO _vendor FROM public.order_items WHERE order_id = _order_id LIMIT 1;
    IF _vendor IS NULL THEN RAISE EXCEPTION 'no_vendor_for_order'; END IF;
  END IF;

  -- One active return per order item (or per order when no item specified)
  IF _order_item_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.returns WHERE order_item_id = _order_item_id AND status NOT IN ('closed','rejected')) THEN
      RAISE EXCEPTION 'duplicate_return_request';
    END IF;
  ELSE
    IF EXISTS (SELECT 1 FROM public.returns WHERE order_id = _order_id AND order_item_id IS NULL AND status NOT IN ('closed','rejected')) THEN
      RAISE EXCEPTION 'duplicate_return_request';
    END IF;
  END IF;

  INSERT INTO public.returns (order_id, order_item_id, customer_id, vendor_id, reason, notes, images, video_url, status)
  VALUES (_order_id, _order_item_id, _uid, _vendor, _reason, _notes, COALESCE(_images, '{}'::text[]), _video_url, 'pending')
  RETURNING id INTO _return_id;

  INSERT INTO public.return_status_history (return_id, from_status, to_status, changed_by, changed_by_role, note)
  VALUES (_return_id, NULL, 'pending', _uid, 'customer', 'تم إرسال طلب الإرجاع');

  -- Notify customer, seller and all admins
  INSERT INTO public.notifications (user_id, title, message, type, related_id)
  VALUES (_uid, 'تم إرسال طلب الإرجاع',
          'رقم الطلب: ' || left(_return_id::text, 8) || ' — بانتظار مراجعة البائع', 'return_status', _return_id),
         (_vendor, 'طلب إرجاع جديد',
          'لديك طلب إرجاع جديد بانتظار المراجعة', 'return_created', _return_id);

  INSERT INTO public.notifications (user_id, title, message, type, related_id)
  SELECT DISTINCT ur.user_id, 'طلب إرجاع جديد على المنصة',
         'طلب إرجاع رقم ' || left(_return_id::text, 8) || ' بحاجة للمتابعة', 'return_created', _return_id
    FROM public.user_roles ur
   WHERE ur.role IN ('admin'::public.app_role, 'super_admin'::public.app_role)
     AND ur.user_id NOT IN (_uid, _vendor);

  INSERT INTO public.activity_logs (user_id, action_type, action_details)
  VALUES (_uid, 'return_requested',
          jsonb_build_object('return_id', _return_id, 'order_id', _order_id, 'order_item_id', _order_item_id, 'reason', _reason));

  BEGIN
    INSERT INTO public.order_status_history (order_id, status, note, changed_by, changed_by_role)
    VALUES (_order_id, 'return_requested', COALESCE(_notes, _reason), _uid, 'customer');
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN _return_id;
END; $function$;

-- 3. update_return_status: full enterprise timeline
CREATE OR REPLACE FUNCTION public.update_return_status(_return_id uuid, _new_status text, _note text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _r public.returns%ROWTYPE;
  _role text;
  _valid text[] := ARRAY['pending','under_review','info_requested','approved','rejected',
                         'awaiting_return','item_shipped','item_received','inspection','completed',
                         'return_in_progress','returned','refunded','closed'];
  _labels jsonb := jsonb_build_object(
    'pending','قيد المراجعة الأولية','under_review','قيد المراجعة','info_requested','بحاجة لمعلومات إضافية',
    'approved','تمت الموافقة','rejected','مرفوض','awaiting_return','بانتظار إرجاع المنتج',
    'item_shipped','تم إرسال المنتج','item_received','تم استلام المنتج','inspection','قيد الفحص',
    'completed','تم إكمال الإرجاع','return_in_progress','جاري الإرجاع','returned','تم الإرجاع',
    'refunded','تم رد المبلغ','closed','مغلق');
  _item record;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT (_new_status = ANY(_valid)) THEN RAISE EXCEPTION 'invalid_status'; END IF;

  SELECT * INTO _r FROM public.returns WHERE id = _return_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'return_not_found'; END IF;

  IF public.has_any_admin_role(_uid) THEN _role := 'admin';
  ELSIF _uid = _r.vendor_id THEN _role := 'vendor';
  ELSE RAISE EXCEPTION 'not_authorized'; END IF;

  IF _new_status IN ('rejected') AND (_note IS NULL OR length(trim(_note)) = 0) THEN
    RAISE EXCEPTION 'reason_required';
  END IF;
  IF _r.status = _new_status THEN RAISE EXCEPTION 'duplicate_status'; END IF;
  IF _role = 'vendor' AND _r.status IN ('completed','closed','rejected') THEN
    RAISE EXCEPTION 'return_closed';
  END IF;

  UPDATE public.returns
    SET status = _new_status,
        review_note = COALESCE(_note, review_note),
        rejection_reason = CASE WHEN _new_status = 'rejected' THEN _note ELSE rejection_reason END,
        shipped_at = CASE WHEN _new_status = 'item_shipped' THEN COALESCE(shipped_at, now()) ELSE shipped_at END,
        received_at = CASE WHEN _new_status IN ('item_received','returned') THEN COALESCE(received_at, now()) ELSE received_at END,
        resolved_at = CASE WHEN _new_status IN ('completed','refunded','closed','rejected') THEN now() ELSE resolved_at END,
        updated_at = now()
    WHERE id = _return_id;

  INSERT INTO public.return_status_history (return_id, from_status, to_status, changed_by, changed_by_role, note)
  VALUES (_return_id, _r.status, _new_status, _uid, _role, _note);

  -- Restore stock once the returned goods are physically received
  IF _new_status IN ('item_received','returned')
     AND _r.status NOT IN ('item_received','returned')
     AND _r.order_item_id IS NOT NULL THEN
    PERFORM set_config('app.stock_reason', 'return', true);
    FOR _item IN SELECT product_id, quantity FROM public.order_items WHERE id = _r.order_item_id LOOP
      UPDATE public.products
         SET stock_quantity = COALESCE(stock_quantity, 0) + _item.quantity, updated_at = now()
       WHERE id = _item.product_id;
    END LOOP;
    PERFORM set_config('app.stock_reason', '', true);
  END IF;

  IF _new_status = 'completed' THEN
    UPDATE public.orders SET refund_status = 'completed', updated_at = now() WHERE id = _r.order_id;
  END IF;

  INSERT INTO public.notifications (user_id, title, message, type, related_id)
  VALUES (_r.customer_id, 'تحديث طلب الإرجاع',
          'تم تحديث حالة طلب الإرجاع إلى: ' || COALESCE(_labels->>_new_status, _new_status)
          || CASE WHEN _note IS NOT NULL AND length(trim(_note)) > 0 THEN ' — ' || _note ELSE '' END,
          'return_status', _return_id);

  INSERT INTO public.activity_logs (user_id, action_type, action_details)
  VALUES (_uid, 'return_status_updated',
          jsonb_build_object('return_id', _return_id, 'from', _r.status, 'to', _new_status, 'role', _role, 'note', _note));
END; $function$;

-- 4. Seller / admin decision with instructions + address
CREATE OR REPLACE FUNCTION public.review_return_request(
  _return_id uuid,
  _decision text,
  _note text,
  _instructions text DEFAULT NULL,
  _address text DEFAULT NULL
) RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _r public.returns%ROWTYPE;
  _role text;
  _new text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _decision NOT IN ('approve','reject') THEN RAISE EXCEPTION 'invalid_status'; END IF;

  SELECT * INTO _r FROM public.returns WHERE id = _return_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'return_not_found'; END IF;

  IF public.has_any_admin_role(_uid) THEN _role := 'admin';
  ELSIF _uid = _r.vendor_id THEN _role := 'vendor';
  ELSE RAISE EXCEPTION 'not_authorized'; END IF;

  IF _role = 'vendor' AND _r.status NOT IN ('pending','under_review','info_requested') THEN
    RAISE EXCEPTION 'return_already_reviewed';
  END IF;

  IF _decision = 'reject' THEN
    IF _note IS NULL OR length(trim(_note)) < 5 THEN RAISE EXCEPTION 'reason_required'; END IF;
    _new := 'rejected';
  ELSE
    IF _instructions IS NULL OR length(trim(_instructions)) < 5 THEN RAISE EXCEPTION 'instructions_required'; END IF;
    IF _address IS NULL OR length(trim(_address)) < 5 THEN RAISE EXCEPTION 'address_required'; END IF;
    _new := 'awaiting_return';
  END IF;

  UPDATE public.returns
     SET status = _new,
         review_note = COALESCE(_note, review_note),
         rejection_reason = CASE WHEN _new = 'rejected' THEN _note ELSE rejection_reason END,
         return_instructions = CASE WHEN _new = 'awaiting_return' THEN _instructions ELSE return_instructions END,
         return_address = CASE WHEN _new = 'awaiting_return' THEN _address ELSE return_address END,
         resolved_at = CASE WHEN _new = 'rejected' THEN now() ELSE resolved_at END,
         updated_at = now()
   WHERE id = _return_id;

  INSERT INTO public.return_status_history (return_id, from_status, to_status, changed_by, changed_by_role, note)
  VALUES (_return_id, _r.status, _new, _uid, _role,
          CASE WHEN _new = 'rejected' THEN 'رفض: ' || _note
               ELSE 'موافقة — تعليمات الإرجاع: ' || _instructions || ' | العنوان: ' || _address END);

  IF _new = 'awaiting_return' THEN
    UPDATE public.orders SET refund_status = 'pending', updated_at = now()
     WHERE id = _r.order_id AND refund_status = 'none';
  END IF;

  INSERT INTO public.notifications (user_id, title, message, type, related_id)
  VALUES (_r.customer_id,
          CASE WHEN _new = 'rejected' THEN 'تم رفض طلب الإرجاع' ELSE 'تمت الموافقة على طلب الإرجاع' END,
          CASE WHEN _new = 'rejected' THEN 'السبب: ' || _note
               ELSE 'يرجى إرسال المنتج وفق التعليمات: ' || _instructions END,
          'return_status', _return_id);

  INSERT INTO public.activity_logs (user_id, action_type, action_details)
  VALUES (_uid, 'return_reviewed',
          jsonb_build_object('return_id', _return_id, 'decision', _decision, 'role', _role, 'note', _note));
END; $function$;

-- 5. Customer marks the item as shipped back
CREATE OR REPLACE FUNCTION public.customer_ship_return(_return_id uuid, _note text DEFAULT NULL)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _r public.returns%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO _r FROM public.returns WHERE id = _return_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'return_not_found'; END IF;
  IF _r.customer_id <> _uid THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF _r.status NOT IN ('approved','awaiting_return') THEN RAISE EXCEPTION 'invalid_status'; END IF;

  UPDATE public.returns
     SET status = 'item_shipped', shipped_at = now(),
         review_note = COALESCE(_note, review_note), updated_at = now()
   WHERE id = _return_id;

  INSERT INTO public.return_status_history (return_id, from_status, to_status, changed_by, changed_by_role, note)
  VALUES (_return_id, _r.status, 'item_shipped', _uid, 'customer', COALESCE(_note, 'قام المشتري بإرسال المنتج'));

  INSERT INTO public.notifications (user_id, title, message, type, related_id)
  VALUES (_r.vendor_id, 'المشتري أرسل المنتج المرتجع',
          COALESCE(_note, 'المنتج في طريقه إليك، يرجى تأكيد الاستلام'), 'return_status', _return_id);

  INSERT INTO public.activity_logs (user_id, action_type, action_details)
  VALUES (_uid, 'return_item_shipped', jsonb_build_object('return_id', _return_id, 'note', _note));
END; $function$;

REVOKE ALL ON FUNCTION public.create_return_request(uuid, uuid, text, text, text[], text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_return_status(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.review_return_request(uuid, text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.customer_ship_return(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_return_request(uuid, uuid, text, text, text[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_return_status(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_return_request(uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.customer_ship_return(uuid, text) TO authenticated;