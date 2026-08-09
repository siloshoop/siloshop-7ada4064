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
  _valid text[] := ARRAY['pending','under_review','approved','rejected','info_requested','return_in_progress','returned','refunded','closed'];
  _labels jsonb := jsonb_build_object(
    'pending','قيد الانتظار','under_review','قيد المراجعة','approved','تمت الموافقة',
    'rejected','مرفوض','info_requested','بحاجة لمعلومات إضافية','return_in_progress','جاري الإرجاع',
    'returned','تم استلام المنتج','refunded','تم رد المبلغ','closed','مغلق');
  _item record;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT (_new_status = ANY(_valid)) THEN RAISE EXCEPTION 'invalid_status'; END IF;

  SELECT * INTO _r FROM public.returns WHERE id = _return_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'return_not_found'; END IF;

  IF _uid = _r.vendor_id THEN _role := 'vendor';
  ELSIF public.has_any_admin_role(_uid) THEN _role := 'admin';
  ELSE RAISE EXCEPTION 'not_authorized'; END IF;

  UPDATE public.returns
    SET status = _new_status,
        review_note = COALESCE(_note, review_note),
        resolved_at = CASE WHEN _new_status IN ('refunded','closed','rejected') THEN now() ELSE resolved_at END
    WHERE id = _return_id;

  INSERT INTO public.return_status_history (return_id, from_status, to_status, changed_by, changed_by_role, note)
  VALUES (_return_id, _r.status, _new_status, _uid, _role, _note);

  -- Restore stock once the returned goods are physically received
  IF _new_status = 'returned' AND _r.status <> 'returned' AND _r.order_item_id IS NOT NULL THEN
    PERFORM set_config('app.stock_reason', 'return', true);
    FOR _item IN
      SELECT product_id, quantity FROM public.order_items WHERE id = _r.order_item_id
    LOOP
      UPDATE public.products
         SET stock_quantity = COALESCE(stock_quantity, 0) + _item.quantity,
             updated_at = now()
       WHERE id = _item.product_id;
    END LOOP;
    PERFORM set_config('app.stock_reason', '', true);
  END IF;

  INSERT INTO public.notifications (user_id, title, message, type, related_id)
  VALUES (_r.customer_id, 'تحديث طلب الإرجاع',
          'تم تحديث حالة طلب الإرجاع إلى: ' || COALESCE(_labels->>_new_status, _new_status),
          'return_status', _return_id);
END; $function$;