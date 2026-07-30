-- 1. New product fields
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS ships_within_days integer,
  ADD COLUMN IF NOT EXISTS moderation_reason_code text;

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_moderation_status_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_moderation_status_check
  CHECK (moderation_status IN ('draft','pending','approved','rejected','hidden'));

-- 2. Allow explicit drafts on insert (seller products still default to pending)
CREATE OR REPLACE FUNCTION public.set_product_moderation_default()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.product_type = 'platform' THEN
    NEW.moderation_status := COALESCE(NEW.moderation_status, 'approved');
  ELSIF NEW.moderation_status = 'draft' THEN
    NEW.moderation_status := 'draft';
    NEW.is_active := false;
  ELSE
    NEW.moderation_status := 'pending';
  END IF;
  RETURN NEW;
END; $$;

-- 3. Vendor submits a draft (or rejected product) for review
CREATE OR REPLACE FUNCTION public.vendor_submit_product_for_review(_product_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p public.products%ROWTYPE;
BEGIN
  SELECT * INTO _p FROM public.products WHERE id = _product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'product_not_found'; END IF;
  IF _p.vendor_id <> auth.uid() THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF _p.moderation_status NOT IN ('draft','rejected') THEN RAISE EXCEPTION 'invalid_status'; END IF;

  UPDATE public.products
     SET moderation_status = 'pending',
         moderation_reason = NULL,
         moderation_reason_code = NULL,
         is_active = true,
         updated_at = now()
   WHERE id = _product_id;

  INSERT INTO public.product_moderation_log (product_id, action, reason, performed_by, from_status, to_status)
  VALUES (_product_id, 'submit', NULL, auth.uid(), _p.moderation_status, 'pending');
END; $$;

REVOKE ALL ON FUNCTION public.vendor_submit_product_for_review(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.vendor_submit_product_for_review(uuid) TO authenticated;

-- 4. Structured rejection reasons in admin moderation
CREATE OR REPLACE FUNCTION public.admin_moderate_product(
  _product_id uuid, _action text, _reason text DEFAULT NULL, _reason_code text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _p public.products%ROWTYPE;
  _new_status text;
  _new_active boolean;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'not_authorized'; END IF;
  SELECT * INTO _p FROM public.products WHERE id=_product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'product_not_found'; END IF;

  CASE _action
    WHEN 'approve'  THEN _new_status := 'approved';  _new_active := true;
    WHEN 'reject'   THEN _new_status := 'rejected';  _new_active := false;
    WHEN 'hide'     THEN _new_status := 'hidden';    _new_active := false;
    WHEN 'restore'  THEN _new_status := 'approved';  _new_active := true;
    WHEN 'suspend'  THEN _new_status := 'hidden';    _new_active := false;
    WHEN 'delete'   THEN
      INSERT INTO public.product_moderation_log (product_id,action,reason,performed_by,from_status,to_status)
      VALUES (_product_id,'delete',_reason,auth.uid(),_p.moderation_status,NULL);
      DELETE FROM public.products WHERE id=_product_id;
      IF _p.vendor_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id,title,message,type,related_id)
        VALUES (_p.vendor_id,'تم حذف منتجك',COALESCE('تم حذف منتجك: '||_reason,'تم حذف منتجك من قبل الإدارة.'),'product_deleted',_product_id);
      END IF;
      RETURN;
    ELSE RAISE EXCEPTION 'invalid_action';
  END CASE;

  UPDATE public.products
     SET moderation_status=_new_status, moderation_reason=_reason,
         moderation_reason_code = CASE WHEN _action='reject' THEN _reason_code ELSE NULL END,
         moderated_at=now(), moderated_by=auth.uid(),
         is_active=_new_active, updated_at=now()
   WHERE id=_product_id;

  INSERT INTO public.product_moderation_log (product_id,action,reason,performed_by,from_status,to_status)
  VALUES (_product_id,_action,COALESCE(_reason_code||' — ','')||COALESCE(_reason,''),auth.uid(),_p.moderation_status,_new_status);

  IF _p.vendor_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id,title,message,type,related_id)
    VALUES (
      _p.vendor_id,
      CASE _action
        WHEN 'approve' THEN 'تمت الموافقة على منتجك'
        WHEN 'reject'  THEN 'تم رفض منتجك'
        WHEN 'hide'    THEN 'تم إخفاء منتجك'
        WHEN 'restore' THEN 'تم إعادة نشر منتجك'
        WHEN 'suspend' THEN 'تم تعليق منتجك'
        ELSE 'تحديث حالة المنتج'
      END,
      _p.name || COALESCE(' — ' || _reason_code, '') || COALESCE(' — ' || _reason, ''),
      'product_'||_action,
      _product_id
    );
  END IF;
END; $$;

REVOKE ALL ON FUNCTION public.admin_moderate_product(uuid, text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_moderate_product(uuid, text, text, text) TO authenticated;

-- 5. Low-stock alerts (threshold 5) in addition to out-of-stock
CREATE OR REPLACE FUNCTION public.notify_vendor_low_stock()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _threshold int := 5;
BEGIN
  IF NEW.stock_quantity <= 0 AND OLD.stock_quantity > 0 THEN
    INSERT INTO notifications (user_id, title, message, type, related_id)
    VALUES (NEW.vendor_id, 'نفاد المخزون',
            'المنتج "' || NEW.name || '" نفد من المخزون', 'warning', NEW.id);
  ELSIF NEW.stock_quantity > 0
        AND NEW.stock_quantity <= _threshold
        AND OLD.stock_quantity > _threshold THEN
    INSERT INTO notifications (user_id, title, message, type, related_id)
    VALUES (NEW.vendor_id, 'كمية محدودة',
            'تبقّى ' || NEW.stock_quantity || ' قطعة فقط من المنتج "' || NEW.name || '"',
            'warning', NEW.id);
  END IF;
  RETURN NEW;
END; $$;