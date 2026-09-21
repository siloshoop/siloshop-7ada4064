-- 1. Backend guard: sellers can never approve, re-activate or forge moderation fields.
CREATE OR REPLACE FUNCTION public.enforce_product_moderation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_admin boolean;
  v_material boolean;
BEGIN
  v_admin := auth.uid() IS NOT NULL AND public.has_any_admin_role(auth.uid());
  IF v_admin OR coalesce(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.moderation_status IS NULL OR NEW.moderation_status NOT IN ('draft', 'pending') THEN
      NEW.moderation_status := 'pending';
    END IF;
    NEW.moderated_by := NULL;
    NEW.moderated_at := NULL;
    NEW.moderation_reason := NULL;
    NEW.moderation_reason_code := NULL;
    NEW.is_featured := false;
    NEW.is_trending := false;
    NEW.is_recommended := false;
    NEW.is_active := false;
    RETURN NEW;
  END IF;

  -- UPDATE performed by a non-admin (normally the owning vendor)
  NEW.moderated_by := OLD.moderated_by;
  NEW.moderated_at := OLD.moderated_at;
  NEW.moderation_reason_code := OLD.moderation_reason_code;
  NEW.is_featured := OLD.is_featured;
  NEW.is_trending := OLD.is_trending;
  NEW.is_recommended := OLD.is_recommended;

  IF NEW.moderation_status IS DISTINCT FROM OLD.moderation_status THEN
    IF NOT (
      (OLD.moderation_status IN ('draft', 'rejected') AND NEW.moderation_status = 'pending')
      OR NEW.moderation_status = 'archived'
      OR (OLD.moderation_status = 'archived' AND NEW.moderation_status = 'draft')
    ) THEN
      RAISE EXCEPTION 'moderation_status_change_not_allowed';
    END IF;
    IF NEW.moderation_status = 'pending' THEN
      NEW.moderation_reason := NULL;
    END IF;
  ELSE
    NEW.moderation_reason := OLD.moderation_reason;
  END IF;

  -- Editing an approved product sends it back to review when content changes
  IF OLD.moderation_status = 'approved' AND NEW.moderation_status = 'approved' THEN
    v_material :=
         (NEW.name IS DISTINCT FROM OLD.name)
      OR (NEW.name_en IS DISTINCT FROM OLD.name_en)
      OR (NEW.description IS DISTINCT FROM OLD.description)
      OR (NEW.short_description IS DISTINCT FROM OLD.short_description)
      OR (NEW.price IS DISTINCT FROM OLD.price)
      OR (NEW.image_url IS DISTINCT FROM OLD.image_url)
      OR (NEW.images IS DISTINCT FROM OLD.images)
      OR (NEW.video_url IS DISTINCT FROM OLD.video_url)
      OR (NEW.category_id IS DISTINCT FROM OLD.category_id)
      OR (NEW.subcategory_id IS DISTINCT FROM OLD.subcategory_id)
      OR (NEW.brand_id IS DISTINCT FROM OLD.brand_id);

    IF v_material THEN
      NEW.moderation_status := 'pending';
      NEW.moderation_reason := NULL;
      NEW.moderation_reason_code := NULL;

      INSERT INTO public.product_moderation_log
        (product_id, action, reason, performed_by, from_status, to_status)
      VALUES
        (NEW.id, 'auto_review_after_edit', 'تعديل جوهري من البائع على منتج معتمد يتطلب إعادة المراجعة',
         auth.uid(), 'approved', 'pending');
    END IF;
  END IF;

  -- Only an approved product may be publicly active
  IF NEW.moderation_status <> 'approved' THEN
    NEW.is_active := false;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_product_moderation ON public.products;
CREATE TRIGGER trg_enforce_product_moderation
BEFORE INSERT OR UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.enforce_product_moderation();

-- 2. Moderation RPC: reasons required, suspension reserved for super admins, full audit trail.
CREATE OR REPLACE FUNCTION public.admin_moderate_product(_product_id uuid, _action text, _reason text DEFAULT NULL::text, _reason_code text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _p public.products%ROWTYPE;
  _new_status text;
  _new_active boolean;
BEGIN
  IF NOT public.has_any_admin_role(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;

  IF _action IN ('suspend', 'delete') AND NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF _action IN ('reject', 'hide', 'suspend') AND coalesce(btrim(_reason), '') = '' THEN
    RAISE EXCEPTION 'reason_required';
  END IF;

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

  IF _action = 'suspend' AND _p.moderation_status <> 'approved' THEN
    RAISE EXCEPTION 'product_not_approved';
  END IF;

  UPDATE public.products
     SET moderation_status=_new_status,
         moderation_reason=_reason,
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
$$;

REVOKE EXECUTE ON FUNCTION public.admin_moderate_product(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_moderate_product(uuid, text, text, text) TO authenticated, service_role;