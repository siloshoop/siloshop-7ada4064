DROP POLICY IF EXISTS "Admins can view all products" ON public.products;
CREATE POLICY "Admin roles can view all products"
ON public.products FOR SELECT TO authenticated
USING (public.has_any_admin_role(auth.uid()));

CREATE OR REPLACE FUNCTION public.admin_moderate_product(_product_id uuid, _action text, _reason text DEFAULT NULL::text, _reason_code text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _p public.products%ROWTYPE;
  _new_status text;
  _new_active boolean;
BEGIN
  IF NOT public.has_any_admin_role(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  SELECT * INTO _p FROM public.products WHERE id=_product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'product_not_found'; END IF;

  CASE _action
    WHEN 'approve'  THEN _new_status := 'approved';  _new_active := true;
    WHEN 'reject'   THEN _new_status := 'rejected';  _new_active := false;
    WHEN 'hide'     THEN _new_status := 'hidden';    _new_active := false;
    WHEN 'restore'  THEN _new_status := 'approved';  _new_active := true;
    WHEN 'suspend'  THEN _new_status := 'hidden';    _new_active := false;
    WHEN 'delete'   THEN
      IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')) THEN
        RAISE EXCEPTION 'not_authorized';
      END IF;
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
END;
$function$;