CREATE OR REPLACE FUNCTION public.notify_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _customer uuid;
  _label text;
  _msg text;
  _actor uuid := NEW.changed_by;
  _uid uuid;
  _labels jsonb := jsonb_build_object(
    'pending','قيد الانتظار','confirmed','تم التأكيد','preparing','قيد التجهيز',
    'processing','قيد التجهيز','ready_for_shipping','جاهز للشحن','shipped','تم الشحن',
    'out_for_delivery','خارج للتوصيل','delivered','تم التوصيل','completed','مكتمل',
    'cancelled','ملغي','returned','مرتجع');
BEGIN
  SELECT o.customer_id INTO _customer FROM public.orders o WHERE o.id = NEW.order_id;
  _label := COALESCE(_labels->>NEW.status, NEW.status);
  _msg := 'الطلب #' || left(NEW.order_id::text, 8) || ' — الحالة الآن: ' || _label
          || COALESCE(' — ' || NULLIF(trim(COALESCE(NEW.notes, '')), ''), '');

  -- Customer
  IF _customer IS NOT NULL AND _customer IS DISTINCT FROM _actor THEN
    INSERT INTO public.notifications (user_id, title, message, type, related_id)
    VALUES (_customer, 'تحديث حالة الطلب', _msg, 'order_status', NEW.order_id);
  END IF;

  -- Sellers with items in this order
  FOR _uid IN
    SELECT DISTINCT oi.vendor_id FROM public.order_items oi
    WHERE oi.order_id = NEW.order_id AND oi.vendor_id IS NOT NULL
  LOOP
    IF _uid IS DISTINCT FROM _actor AND _uid IS DISTINCT FROM _customer THEN
      INSERT INTO public.notifications (user_id, title, message, type, related_id)
      VALUES (_uid, 'تحديث حالة طلب لديك', _msg, 'order_status', NEW.order_id);
    END IF;
  END LOOP;

  -- Administrators: closing states and administrative overrides
  IF NEW.is_override OR NEW.status IN ('cancelled', 'returned', 'completed') THEN
    FOR _uid IN
      SELECT DISTINCT ur.user_id FROM public.user_roles ur
      WHERE ur.role IN ('admin', 'super_admin')
    LOOP
      IF _uid IS DISTINCT FROM _actor THEN
        INSERT INTO public.notifications (user_id, title, message, type, related_id)
        VALUES (_uid,
          CASE WHEN NEW.is_override THEN 'تجاوز إداري لحالة طلب' ELSE 'تحديث حالة طلب' END,
          _msg, 'order_status', NEW.order_id);
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;