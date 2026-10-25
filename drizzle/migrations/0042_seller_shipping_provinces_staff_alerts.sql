ALTER TABLE public.seller_applications ADD COLUMN shipping_all_provinces boolean NOT NULL DEFAULT true, ADD COLUMN shipping_provinces text[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE public.notifications ADD COLUMN staff_event_key text;
CREATE UNIQUE INDEX notifications_staff_event_unique ON public.notifications(user_id,staff_event_key) WHERE staff_event_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.valid_shipping_provinces(_provinces text[]) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=public AS $$ SELECT _provinces IS NOT NULL AND _provinces <@ ARRAY['دمشق','ريف دمشق','حلب','حمص','حماة','اللاذقية','طرطوس','إدلب','درعا','السويداء','القنيطرة','الرقة','دير الزور','الحسكة']::text[] AND array_position(_provinces,NULL) IS NULL $$;
ALTER TABLE public.seller_applications ADD CONSTRAINT seller_shipping_regions_valid CHECK (public.valid_shipping_provinces(shipping_provinces) AND (shipping_all_provinces OR cardinality(shipping_provinces)>0));

CREATE OR REPLACE FUNCTION public.seller_update_shipping_regions(_all_provinces boolean,_provinces text[]) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'vendor') OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND account_status='active') THEN RAISE EXCEPTION 'إعدادات الشحن متاحة للبائع فقط' USING ERRCODE='42501'; END IF;
 IF _all_provinces IS NULL OR NOT public.valid_shipping_provinces(_provinces) OR (NOT _all_provinces AND cardinality(_provinces)=0) THEN RAISE EXCEPTION 'اختر محافظة سورية واحدة على الأقل'; END IF;
 SELECT id INTO v_id FROM public.seller_applications WHERE user_id=auth.uid() AND status='approved' ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE;
 IF v_id IS NULL THEN RAISE EXCEPTION 'لا يوجد متجر معتمد' USING ERRCODE='42501'; END IF;
 UPDATE public.seller_applications SET shipping_all_provinces=_all_provinces,shipping_provinces=CASE WHEN _all_provinces THEN '{}'::text[] ELSE ARRAY(SELECT DISTINCT unnest(_provinces)) END WHERE id=v_id;
END $$;
REVOKE ALL ON FUNCTION public.seller_update_shipping_regions(boolean,text[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.seller_update_shipping_regions(boolean,text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_vendor_shipping_regions(_vendor_ids uuid[]) RETURNS TABLE(vendor_id uuid,shipping_all_provinces boolean,shipping_provinces text[]) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT DISTINCT ON(sa.user_id) sa.user_id,sa.shipping_all_provinces,sa.shipping_provinces FROM public.seller_applications sa JOIN public.profiles p ON p.id=sa.user_id WHERE sa.user_id=ANY(_vendor_ids) AND sa.status='approved' AND p.account_status='active' ORDER BY sa.user_id,sa.created_at DESC,sa.id DESC
$$;
REVOKE ALL ON FUNCTION public.get_vendor_shipping_regions(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_vendor_shipping_regions(uuid[]) TO anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.assert_order_shipping_regions(_items jsonb,_address text,_pickup_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE province text; v record; regions record;
BEGIN
 province:=btrim(split_part(replace(_address,',','،'),'،',3));
 IF _pickup_id IS NOT NULL THEN SELECT governorate INTO province FROM public.pickup_centers WHERE id=_pickup_id AND is_active; END IF;
 IF NOT public.valid_shipping_provinces(ARRAY[province]) OR COALESCE(province,'')='' THEN RAISE EXCEPTION 'اختر محافظة سورية صحيحة للتوصيل'; END IF;
 FOR v IN SELECT DISTINCT p.vendor_id FROM jsonb_array_elements(_items) i JOIN public.products p ON p.id=(i->>'product_id')::uuid WHERE p.product_type IS DISTINCT FROM 'platform' ORDER BY p.vendor_id LOOP
  SELECT sa.shipping_all_provinces,sa.shipping_provinces INTO regions FROM public.seller_applications sa WHERE sa.user_id=v.vendor_id AND sa.status='approved' ORDER BY sa.created_at DESC,sa.id DESC LIMIT 1 FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'تعذّر التحقق من محافظات شحن البائع'; END IF;
  IF NOT regions.shipping_all_provinces AND NOT province=ANY(regions.shipping_provinces) THEN RAISE EXCEPTION 'البائع لا يشحن إلى محافظة %',province; END IF;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.assert_order_shipping_regions(jsonb,text,uuid) FROM PUBLIC,anon,authenticated;
DO $$ DECLARE d text; marker text := 'PERFORM pg_advisory_xact_lock(hashtext(''create_order:'' || _uid::text));'; BEGIN
 d:=pg_get_functiondef('public.create_order(jsonb,text,text,text,text,text,uuid)'::regprocedure);
 IF position(marker in d)=0 THEN RAISE EXCEPTION 'create_order marker missing'; END IF;
 d:=replace(d,marker,marker || E'\n PERFORM public.assert_order_shipping_regions(_items,_shipping_address,_pickup_center_id);');
 EXECUTE d;
END $$;

CREATE OR REPLACE FUNCTION public.notify_staff_event(_event text,_id uuid,_title text,_message text) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 INSERT INTO public.notifications(user_id,title,message,type,related_id,staff_event_key)
 SELECT DISTINCT ur.user_id,_title,_message,_event,_id,_event||':'||_id::text FROM public.user_roles ur JOIN public.profiles p ON p.id=ur.user_id WHERE ur.role IN ('super_admin','moderator') AND p.account_status='active'
 ON CONFLICT(user_id,staff_event_key) WHERE staff_event_key IS NOT NULL DO NOTHING
$$;
REVOKE ALL ON FUNCTION public.notify_staff_event(text,uuid,text,text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.notify_staff_store_request() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NEW.status='pending' THEN
  IF TG_OP='INSERT' THEN PERFORM public.notify_staff_event('staff_store_request',NEW.id,'طلب فتح متجر','طلب فتح متجر: '||COALESCE(NEW.store_name,''));
  ELSIF OLD.status IS DISTINCT FROM NEW.status THEN PERFORM public.notify_staff_event('staff_store_request',NEW.id,'طلب فتح متجر','طلب فتح متجر: '||COALESCE(NEW.store_name,'')); END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER staff_store_request_alert AFTER INSERT OR UPDATE OF status ON public.seller_applications FOR EACH ROW EXECUTE FUNCTION public.notify_staff_store_request();
CREATE OR REPLACE FUNCTION public.notify_staff_product_added() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 PERFORM public.notify_staff_event('staff_product_added',NEW.id,'منتج جديد','تمت إضافة منتج: '||NEW.name); RETURN NEW;
END $$;
CREATE TRIGGER staff_product_added_alert AFTER INSERT ON public.products FOR EACH ROW EXECUTE FUNCTION public.notify_staff_product_added();
CREATE OR REPLACE FUNCTION public.notify_staff_customer_registered() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NEW.email_confirmed_at IS NOT NULL AND (TG_OP='INSERT' OR OLD.email_confirmed_at IS NULL) AND EXISTS(SELECT 1 FROM public.profiles WHERE id=NEW.id AND role='customer') THEN
 PERFORM public.notify_staff_event('staff_customer_registered',NEW.id,'عميل جديد','تم تسجيل عميل جديد');
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER staff_customer_registered_alert AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users FOR EACH ROW EXECUTE FUNCTION public.notify_staff_customer_registered();