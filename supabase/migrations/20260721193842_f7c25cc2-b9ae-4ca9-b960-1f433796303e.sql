
DO $$ BEGIN
  CREATE TYPE public.seller_status AS ENUM ('pending','approved','rejected','suspended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.seller_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  store_name text,
  contact_email text,
  contact_phone text,
  store_description text,
  address text,
  governorate text,
  identity_document_url text,
  business_document_url text,
  status public.seller_status NOT NULL DEFAULT 'pending',
  rejection_reason text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.seller_applications TO authenticated;
GRANT ALL ON public.seller_applications TO service_role;

ALTER TABLE public.seller_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "seller_app_owner_select" ON public.seller_applications;
CREATE POLICY "seller_app_owner_select" ON public.seller_applications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "seller_app_owner_insert" ON public.seller_applications;
CREATE POLICY "seller_app_owner_insert" ON public.seller_applications
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "seller_app_owner_update" ON public.seller_applications;
CREATE POLICY "seller_app_owner_update" ON public.seller_applications
  FOR UPDATE TO authenticated
  USING (
    (user_id = auth.uid() AND status IN ('pending','rejected'))
    OR public.has_role(auth.uid(),'admin')
  )
  WITH CHECK (
    (user_id = auth.uid() AND status IN ('pending','rejected'))
    OR public.has_role(auth.uid(),'admin')
  );

DROP TRIGGER IF EXISTS trg_seller_applications_updated ON public.seller_applications;
CREATE TRIGGER trg_seller_applications_updated
  BEFORE UPDATE ON public.seller_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_seller_apps_status ON public.seller_applications(status);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _wants_vendor boolean := (NEW.raw_user_meta_data->>'role') = 'vendor';
BEGIN
  INSERT INTO profiles (id, full_name, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), 'customer'::user_role);

  INSERT INTO user_roles (user_id, role) VALUES (NEW.id, 'customer'::app_role)
    ON CONFLICT DO NOTHING;

  IF _wants_vendor THEN
    INSERT INTO public.seller_applications (user_id, store_name, contact_email, contact_phone, status)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'store_name', NEW.email, NEW.raw_user_meta_data->>'phone', 'pending')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.approve_seller_application(_app_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _uid uuid; BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'not_authorized'; END IF;
  SELECT user_id INTO _uid FROM public.seller_applications WHERE id=_app_id;
  IF _uid IS NULL THEN RAISE EXCEPTION 'application_not_found'; END IF;
  UPDATE public.seller_applications
     SET status='approved', reviewed_at=now(), reviewed_by=auth.uid(), rejection_reason=NULL
   WHERE id=_app_id;
  UPDATE public.profiles SET role='vendor'::user_role, updated_at=now() WHERE id=_uid;
  INSERT INTO public.user_roles (user_id, role) VALUES (_uid,'vendor'::app_role) ON CONFLICT DO NOTHING;
  INSERT INTO public.notifications (user_id,title,message,type,related_id)
  VALUES (_uid,'تمت الموافقة على حسابك كبائع','تمت الموافقة على طلبك، يمكنك الآن الوصول إلى لوحة البائع وإضافة المنتجات.','seller_approved',_app_id);
END; $$;

CREATE OR REPLACE FUNCTION public.reject_seller_application(_app_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _uid uuid; BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF _reason IS NULL OR length(trim(_reason))=0 THEN RAISE EXCEPTION 'reason_required'; END IF;
  SELECT user_id INTO _uid FROM public.seller_applications WHERE id=_app_id;
  IF _uid IS NULL THEN RAISE EXCEPTION 'application_not_found'; END IF;
  UPDATE public.seller_applications
     SET status='rejected', rejection_reason=_reason, reviewed_at=now(), reviewed_by=auth.uid()
   WHERE id=_app_id;
  INSERT INTO public.notifications (user_id,title,message,type,related_id)
  VALUES (_uid,'تم رفض طلب البائع','تم رفض طلبك. السبب: '||_reason||' — يمكنك تعديل بياناتك وإعادة التقديم.','seller_rejected',_app_id);
END; $$;

CREATE OR REPLACE FUNCTION public.suspend_seller(_user_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'not_authorized'; END IF;
  UPDATE public.seller_applications
     SET status='suspended', rejection_reason=_reason, reviewed_at=now(), reviewed_by=auth.uid()
   WHERE user_id=_user_id;
  DELETE FROM public.user_roles WHERE user_id=_user_id AND role='vendor'::app_role;
  INSERT INTO public.notifications (user_id,title,message,type)
  VALUES (_user_id,'تم إيقاف حساب البائع',COALESCE('تم إيقاف حسابك مؤقتاً. '||_reason,'تم إيقاف حسابك مؤقتاً.'),'seller_suspended');
END; $$;

CREATE OR REPLACE FUNCTION public.reactivate_seller(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'not_authorized'; END IF;
  UPDATE public.seller_applications
     SET status='approved', rejection_reason=NULL, reviewed_at=now(), reviewed_by=auth.uid()
   WHERE user_id=_user_id;
  UPDATE public.profiles SET role='vendor'::user_role, updated_at=now() WHERE id=_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id,'vendor'::app_role) ON CONFLICT DO NOTHING;
  INSERT INTO public.notifications (user_id,title,message,type)
  VALUES (_user_id,'تم إعادة تفعيل حساب البائع','تم إعادة تفعيل حسابك، يمكنك متابعة البيع الآن.','seller_reactivated');
END; $$;

CREATE OR REPLACE FUNCTION public.delete_seller_account(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'not_authorized'; END IF;
  DELETE FROM public.user_roles WHERE user_id=_user_id AND role='vendor'::app_role;
  DELETE FROM public.seller_applications WHERE user_id=_user_id;
  UPDATE public.profiles SET role='customer'::user_role, updated_at=now() WHERE id=_user_id;
END; $$;

CREATE OR REPLACE FUNCTION public.submit_seller_application(
  _store_name text, _contact_email text, _contact_phone text,
  _store_description text, _address text, _governorate text,
  _identity_document_url text, _business_document_url text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _uid uuid := auth.uid(); _app_id uuid; _current public.seller_status;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _store_name IS NULL OR length(trim(_store_name))<2 THEN RAISE EXCEPTION 'store_name_required'; END IF;
  IF _contact_phone IS NULL OR length(trim(_contact_phone))<6 THEN RAISE EXCEPTION 'phone_required'; END IF;
  IF _identity_document_url IS NULL THEN RAISE EXCEPTION 'identity_document_required'; END IF;

  SELECT id, status INTO _app_id, _current FROM public.seller_applications WHERE user_id=_uid;

  IF _app_id IS NULL THEN
    INSERT INTO public.seller_applications (
      user_id, store_name, contact_email, contact_phone, store_description,
      address, governorate, identity_document_url, business_document_url,
      status, submitted_at
    ) VALUES (
      _uid, _store_name, _contact_email, _contact_phone, _store_description,
      _address, _governorate, _identity_document_url, _business_document_url,
      'pending', now()
    ) RETURNING id INTO _app_id;
  ELSE
    IF _current NOT IN ('pending','rejected') THEN RAISE EXCEPTION 'application_locked'; END IF;
    UPDATE public.seller_applications SET
      store_name=_store_name, contact_email=_contact_email, contact_phone=_contact_phone,
      store_description=_store_description, address=_address, governorate=_governorate,
      identity_document_url=_identity_document_url,
      business_document_url=COALESCE(_business_document_url, business_document_url),
      status='pending', rejection_reason=NULL, submitted_at=now()
    WHERE id=_app_id;
  END IF;

  RETURN _app_id;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_list_seller_applications()
RETURNS TABLE (
  id uuid, user_id uuid, full_name text, email text,
  store_name text, contact_phone text, governorate text,
  status public.seller_status, rejection_reason text,
  identity_document_url text, business_document_url text,
  store_description text, address text,
  submitted_at timestamptz, created_at timestamptz,
  products_count bigint, orders_count bigint
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT sa.id, sa.user_id, p.full_name, u.email,
         sa.store_name, sa.contact_phone, sa.governorate,
         sa.status, sa.rejection_reason,
         sa.identity_document_url, sa.business_document_url,
         sa.store_description, sa.address,
         sa.submitted_at, sa.created_at,
         (SELECT count(*) FROM public.products pr WHERE pr.vendor_id=sa.user_id) AS products_count,
         (SELECT count(DISTINCT oi.order_id) FROM public.order_items oi WHERE oi.vendor_id=sa.user_id) AS orders_count
  FROM public.seller_applications sa
  LEFT JOIN public.profiles p ON p.id=sa.user_id
  LEFT JOIN auth.users u ON u.id=sa.user_id
  WHERE public.has_role(auth.uid(),'admin')
  ORDER BY sa.created_at DESC;
$$;

-- Storage RLS
DROP POLICY IF EXISTS "seller_docs_owner_read" ON storage.objects;
CREATE POLICY "seller_docs_owner_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='seller-documents' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(),'admin')
  ));

DROP POLICY IF EXISTS "seller_docs_owner_write" ON storage.objects;
CREATE POLICY "seller_docs_owner_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='seller-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "seller_docs_owner_update" ON storage.objects;
CREATE POLICY "seller_docs_owner_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id='seller-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "seller_docs_owner_delete" ON storage.objects;
CREATE POLICY "seller_docs_owner_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id='seller-documents' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(),'admin')
  ));
