
-- Phase 1: Roles & Moderation Foundation

-- 1. Extend app_role enum (values usable in future migrations)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'moderator';

-- 2. Role-array helper (usable now with 'admin'; super_admin/moderator become callable next migration)
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles text[])
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text = ANY(_roles)
  )
$$;

-- 3. Account status on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active'
    CHECK (account_status IN ('active','suspended','banned')),
  ADD COLUMN IF NOT EXISTS status_reason text,
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS status_changed_by uuid;

-- 4. Product moderation status
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'pending'
    CHECK (moderation_status IN ('pending','approved','rejected','hidden')),
  ADD COLUMN IF NOT EXISTS moderation_reason text,
  ADD COLUMN IF NOT EXISTS moderated_at timestamptz,
  ADD COLUMN IF NOT EXISTS moderated_by uuid;

-- Backfill: keep production visibility unchanged.
UPDATE public.products SET moderation_status = 'approved'
 WHERE moderation_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_products_moderation_active
  ON public.products (moderation_status, is_active, created_at DESC);

-- Auto-set moderation on insert: platform -> approved, seller -> pending
CREATE OR REPLACE FUNCTION public.set_product_moderation_default()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.product_type = 'platform' THEN
    NEW.moderation_status := COALESCE(NEW.moderation_status, 'approved');
  ELSE
    -- seller products always start pending (admins can override via RPC after)
    NEW.moderation_status := 'pending';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_set_product_moderation_default ON public.products;
CREATE TRIGGER trg_set_product_moderation_default
  BEFORE INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_product_moderation_default();

-- 5. Update public product visibility policy to require approved moderation
DROP POLICY IF EXISTS "Anyone can view active products" ON public.products;
CREATE POLICY "Anyone can view approved active products"
  ON public.products FOR SELECT
  USING (is_active = true AND moderation_status = 'approved');

-- Vendors need to see their own pending/rejected/hidden products
CREATE POLICY "Vendors can view their own products regardless of status"
  ON public.products FOR SELECT
  USING (auth.uid() = vendor_id);

-- Admins can see everything
CREATE POLICY "Admins can view all products"
  ON public.products FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- 6. Product moderation log
CREATE TABLE IF NOT EXISTS public.product_moderation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('approve','reject','hide','restore','suspend','delete','edit')),
  reason text,
  performed_by uuid NOT NULL,
  from_status text,
  to_status text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.product_moderation_log TO authenticated;
GRANT ALL ON public.product_moderation_log TO service_role;
ALTER TABLE public.product_moderation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view moderation log"
  ON public.product_moderation_log FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Vendors can view their product moderation log"
  ON public.product_moderation_log FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_moderation_log.product_id
      AND p.vendor_id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS idx_pml_product ON public.product_moderation_log (product_id, created_at DESC);

-- 7. RPCs: user account management (admin only for now; super_admin gating added next migration)
CREATE OR REPLACE FUNCTION public.admin_suspend_user(_user_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF _user_id = auth.uid() THEN RAISE EXCEPTION 'cannot_target_self'; END IF;
  UPDATE public.profiles
     SET account_status='suspended', status_reason=_reason,
         status_changed_at=now(), status_changed_by=auth.uid(), updated_at=now()
   WHERE id=_user_id;
  INSERT INTO public.notifications (user_id,title,message,type)
  VALUES (_user_id,'تم إيقاف حسابك',COALESCE('تم إيقاف حسابك: '||_reason,'تم إيقاف حسابك مؤقتاً.'),'account_suspended');
END; $$;

CREATE OR REPLACE FUNCTION public.admin_activate_user(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'not_authorized'; END IF;
  UPDATE public.profiles
     SET account_status='active', status_reason=NULL,
         status_changed_at=now(), status_changed_by=auth.uid(), updated_at=now()
   WHERE id=_user_id;
  INSERT INTO public.notifications (user_id,title,message,type)
  VALUES (_user_id,'تم إعادة تفعيل حسابك','تم إعادة تفعيل حسابك، يمكنك متابعة استخدام المنصة.','account_activated');
END; $$;

CREATE OR REPLACE FUNCTION public.admin_ban_user(_user_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF _user_id = auth.uid() THEN RAISE EXCEPTION 'cannot_target_self'; END IF;
  UPDATE public.profiles
     SET account_status='banned', status_reason=_reason,
         status_changed_at=now(), status_changed_by=auth.uid(), updated_at=now()
   WHERE id=_user_id;
  -- Remove privileged roles on ban
  DELETE FROM public.user_roles WHERE user_id=_user_id AND role IN ('vendor'::app_role,'admin'::app_role);
  INSERT INTO public.notifications (user_id,title,message,type)
  VALUES (_user_id,'تم حظر حسابك',COALESCE('تم حظر حسابك بشكل دائم: '||_reason,'تم حظر حسابك بشكل دائم.'),'account_banned');
END; $$;

-- 8. RPC: product moderation
CREATE OR REPLACE FUNCTION public.admin_moderate_product(_product_id uuid, _action text, _reason text DEFAULT NULL)
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
         moderated_at=now(), moderated_by=auth.uid(),
         is_active=_new_active, updated_at=now()
   WHERE id=_product_id;

  INSERT INTO public.product_moderation_log (product_id,action,reason,performed_by,from_status,to_status)
  VALUES (_product_id,_action,_reason,auth.uid(),_p.moderation_status,_new_status);

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
      COALESCE(_p.name || ' — ' || COALESCE(_reason,''), _p.name),
      'product_'||_action,
      _product_id
    );
  END IF;
END; $$;
