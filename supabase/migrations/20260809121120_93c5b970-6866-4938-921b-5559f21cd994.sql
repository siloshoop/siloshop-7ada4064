ALTER TABLE public.seller_applications
  ADD COLUMN IF NOT EXISTS owner_name text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS cover_image_url text;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  INSERT INTO profiles (id, full_name, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    'customer'::user_role
  );

  INSERT INTO user_roles (user_id, role) VALUES (NEW.id, 'customer'::app_role)
    ON CONFLICT DO NOTHING;

  RETURN NEW;
END; $function$;

DROP FUNCTION IF EXISTS public.submit_seller_application(text, text, text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.submit_seller_application(
  _store_name text,
  _owner_name text,
  _contact_email text,
  _contact_phone text,
  _governorate text,
  _city text,
  _address text DEFAULT NULL,
  _store_description text DEFAULT NULL,
  _logo_url text DEFAULT NULL,
  _cover_image_url text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _uid uuid := auth.uid(); _app_id uuid; _current public.seller_status;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _store_name IS NULL OR length(trim(_store_name)) < 2 THEN RAISE EXCEPTION 'store_name_required'; END IF;
  IF _owner_name IS NULL OR length(trim(_owner_name)) < 2 THEN RAISE EXCEPTION 'owner_name_required'; END IF;
  IF _contact_email IS NULL OR position('@' in _contact_email) = 0 THEN RAISE EXCEPTION 'email_required'; END IF;
  IF _contact_phone IS NULL OR length(trim(_contact_phone)) < 6 THEN RAISE EXCEPTION 'phone_required'; END IF;
  IF _governorate IS NULL OR length(trim(_governorate)) < 2 THEN RAISE EXCEPTION 'governorate_required'; END IF;
  IF _city IS NULL OR length(trim(_city)) < 2 THEN RAISE EXCEPTION 'city_required'; END IF;

  SELECT id, status INTO _app_id, _current FROM public.seller_applications WHERE user_id = _uid;

  IF _app_id IS NULL THEN
    INSERT INTO public.seller_applications (
      user_id, store_name, owner_name, contact_email, contact_phone,
      governorate, city, address, store_description, logo_url, cover_image_url,
      status, submitted_at
    ) VALUES (
      _uid, trim(_store_name), trim(_owner_name), trim(_contact_email), trim(_contact_phone),
      _governorate, _city, _address, _store_description, _logo_url, _cover_image_url,
      'pending', now()
    ) RETURNING id INTO _app_id;
  ELSE
    IF _current NOT IN ('pending','rejected') THEN RAISE EXCEPTION 'application_locked'; END IF;
    UPDATE public.seller_applications SET
      store_name = trim(_store_name),
      owner_name = trim(_owner_name),
      contact_email = trim(_contact_email),
      contact_phone = trim(_contact_phone),
      governorate = _governorate,
      city = _city,
      address = _address,
      store_description = _store_description,
      logo_url = COALESCE(_logo_url, logo_url),
      cover_image_url = COALESCE(_cover_image_url, cover_image_url),
      status = 'pending',
      rejection_reason = NULL,
      submitted_at = now()
    WHERE id = _app_id;
  END IF;

  RETURN _app_id;
END; $$;

REVOKE EXECUTE ON FUNCTION public.submit_seller_application(text,text,text,text,text,text,text,text,text,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_seller_application(text,text,text,text,text,text,text,text,text,text) TO authenticated;

DROP FUNCTION IF EXISTS public.admin_list_seller_applications();
CREATE OR REPLACE FUNCTION public.admin_list_seller_applications()
RETURNS TABLE (
  id uuid, user_id uuid, full_name text, email text,
  store_name text, owner_name text, contact_phone text, contact_email text,
  governorate text, city text,
  status public.seller_status, rejection_reason text,
  identity_document_url text, business_document_url text,
  logo_url text, cover_image_url text,
  store_description text, address text,
  submitted_at timestamptz, created_at timestamptz,
  products_count bigint, orders_count bigint
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT sa.id, sa.user_id, p.full_name, u.email,
         sa.store_name, sa.owner_name, sa.contact_phone, sa.contact_email,
         sa.governorate, sa.city,
         sa.status, sa.rejection_reason,
         sa.identity_document_url, sa.business_document_url,
         sa.logo_url, sa.cover_image_url,
         sa.store_description, sa.address,
         sa.submitted_at, sa.created_at,
         (SELECT count(*) FROM public.products pr WHERE pr.vendor_id = sa.user_id) AS products_count,
         (SELECT count(DISTINCT oi.order_id) FROM public.order_items oi WHERE oi.vendor_id = sa.user_id) AS orders_count
  FROM public.seller_applications sa
  LEFT JOIN public.profiles p ON p.id = sa.user_id
  LEFT JOIN auth.users u ON u.id = sa.user_id
  WHERE public.has_any_admin_role(auth.uid())
  ORDER BY sa.created_at DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_seller_applications() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_list_seller_applications() TO authenticated;

DROP POLICY IF EXISTS "store_assets_read" ON storage.objects;
CREATE POLICY "store_assets_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'store-assets' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_any_admin_role(auth.uid())
  ));

DROP POLICY IF EXISTS "store_assets_owner_insert" ON storage.objects;
CREATE POLICY "store_assets_owner_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'store-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "store_assets_owner_update" ON storage.objects;
CREATE POLICY "store_assets_owner_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'store-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "store_assets_owner_delete" ON storage.objects;
CREATE POLICY "store_assets_owner_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'store-assets' AND (storage.foldername(name))[1] = auth.uid()::text);