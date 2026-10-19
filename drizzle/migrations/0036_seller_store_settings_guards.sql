CREATE OR REPLACE FUNCTION public.seller_update_store_profile(_store_name text DEFAULT NULL, _store_description text DEFAULT NULL, _contact_email text DEFAULT NULL, _contact_phone text DEFAULT NULL, _address text DEFAULT NULL, _city text DEFAULT NULL, _logo_url text DEFAULT NULL, _cover_image_url text DEFAULT NULL, _working_hours text DEFAULT NULL, _return_policy text DEFAULT NULL, _shipping_policy text DEFAULT NULL, _business_info text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $$
DECLARE v_uid uuid := auth.uid(); v_id uuid; v_value text; v_limit integer; v_index integer := 0;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'يرجى تسجيل الدخول' USING ERRCODE='42501'; END IF;
 IF NOT public.has_role(v_uid, 'vendor') OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=v_uid AND account_status='active') THEN
 RAISE EXCEPTION 'إعدادات المتجر متاحة للبائع فقط' USING ERRCODE='42501'; END IF;
 SELECT id INTO v_id FROM public.seller_applications WHERE user_id=v_uid AND status='approved' ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE;
 IF v_id IS NULL THEN RAISE EXCEPTION 'لا يوجد متجر معتمد لهذا الحساب' USING ERRCODE='42501'; END IF;
 IF _store_name IS NOT NULL AND btrim(_store_name)='' THEN RAISE EXCEPTION 'اسم المتجر مطلوب'; END IF;
 FOREACH v_value IN ARRAY ARRAY[_store_name,_store_description,_contact_email,_contact_phone,_address,_city,_logo_url,_cover_image_url,_working_hours,_return_policy,_shipping_policy,_business_info] LOOP
 v_index := v_index+1;
 v_limit := (ARRAY[150,5000,255,30,1000,100,2048,2048,500,5000,5000,3000])[v_index];
 IF length(v_value)>v_limit THEN RAISE EXCEPTION 'أحد الحقول يتجاوز الطول المسموح'; END IF;
 END LOOP;
 IF COALESCE(_contact_email,'')<>'' AND _contact_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'البريد الإلكتروني غير صالح'; END IF;
 IF COALESCE(_contact_phone,'')<>'' AND _contact_phone !~ '^(\+[1-9][0-9]{6,14}|0[0-9]{7,14})$' THEN RAISE EXCEPTION 'رقم الهاتف غير صالح؛ أدخل رقمًا صحيحًا مع رمز الدولة'; END IF;
 FOREACH v_value IN ARRAY ARRAY[_logo_url,_cover_image_url] LOOP
 IF COALESCE(v_value,'')<>'' AND v_value !~ '^https://[^[:space:]]+$' AND (split_part(v_value,'/',1)<>v_uid::text OR v_value LIKE '%..%' OR v_value !~ '\.(jpg|jpeg|png|webp|gif)$') THEN RAISE EXCEPTION 'رابط الصورة غير صالح أو لا يخص متجرك'; END IF;
 END LOOP;
 UPDATE public.seller_applications SET
 store_name=COALESCE(btrim(_store_name),store_name), store_description=COALESCE(_store_description,store_description), contact_email=COALESCE(_contact_email,contact_email), contact_phone=COALESCE(_contact_phone,contact_phone), address=COALESCE(_address,address), city=COALESCE(_city,city), logo_url=COALESCE(_logo_url,logo_url), cover_image_url=COALESCE(_cover_image_url,cover_image_url), working_hours=COALESCE(_working_hours,working_hours), return_policy=COALESCE(_return_policy,return_policy), shipping_policy=COALESCE(_shipping_policy,shipping_policy), business_info=COALESCE(_business_info,business_info),updated_at=now()
 WHERE id=v_id AND user_id=v_uid;
 INSERT INTO public.activity_logs(user_id,action_type,action_details) VALUES(v_uid,'store_profile_updated',jsonb_build_object('at',now()));
END; $$;
REVOKE ALL ON FUNCTION public.seller_update_store_profile(text,text,text,text,text,text,text,text,text,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.seller_update_store_profile(text,text,text,text,text,text,text,text,text,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_store_public_contact(_vendor_id uuid)
RETURNS TABLE(contact_phone text,address text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO public AS $$
 SELECT NULLIF(sa.contact_phone,''),NULLIF(sa.address,'') FROM public.seller_applications sa JOIN public.profiles p ON p.id=sa.user_id
 WHERE sa.user_id=_vendor_id AND sa.status='approved' AND p.role='vendor' AND p.account_status='active'
 ORDER BY sa.created_at DESC,sa.id DESC LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_store_public_contact(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_store_public_contact(uuid) TO anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.is_public_store_image(_path text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO public AS $$
 SELECT EXISTS(SELECT 1 FROM public.seller_applications sa JOIN public.profiles p ON p.id=sa.user_id WHERE sa.status='approved' AND p.role='vendor' AND p.account_status='active' AND _path IN(sa.logo_url,sa.cover_image_url));
$$;
REVOKE ALL ON FUNCTION public.is_public_store_image(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_public_store_image(text) TO anon,authenticated,service_role;
CREATE POLICY store_assets_saved_brand_read ON storage.objects FOR SELECT TO anon,authenticated USING(bucket_id='store-assets' AND public.is_public_store_image(name));