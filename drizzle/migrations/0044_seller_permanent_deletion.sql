CREATE TABLE public.seller_deletion_jobs (user_id uuid NOT NULL, scope text NOT NULL CHECK(scope IN ('store','account')), stage text NOT NULL DEFAULT 'prepared' CHECK(stage IN ('prepared','database_done','complete')), assets jsonb NOT NULL DEFAULT '[]', created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,scope));
GRANT ALL ON public.seller_deletion_jobs TO service_role;
ALTER TABLE public.seller_deletion_jobs ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.prepare_seller_deletion(_uid uuid,_scope text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j public.seller_deletion_jobs%ROWTYPE; a jsonb;
BEGIN
 IF _uid IS NULL OR _scope NOT IN ('store','account') THEN RAISE EXCEPTION 'invalid_request'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('create_order:'||_uid::text));
 PERFORM 1 FROM public.profiles WHERE id=_uid FOR UPDATE;
 PERFORM 1 FROM public.products WHERE vendor_id=_uid ORDER BY id FOR UPDATE;
 SELECT * INTO j FROM public.seller_deletion_jobs WHERE user_id=_uid AND scope=_scope FOR UPDATE;
 IF FOUND AND j.stage <> 'complete' THEN RETURN to_jsonb(j); END IF;
 IF EXISTS(SELECT 1 FROM public.seller_deletion_jobs WHERE user_id=_uid AND scope<>_scope AND stage<>'complete') THEN RAISE EXCEPTION 'deletion_in_progress'; END IF;
 IF EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_uid AND role IN ('admin','super_admin','moderator')) THEN RAISE EXCEPTION 'staff_account'; END IF;
 IF _scope='store' AND NOT EXISTS(SELECT 1 FROM public.seller_applications WHERE user_id=_uid) THEN RAISE EXCEPTION 'store_not_found'; END IF;
 IF EXISTS(SELECT 1 FROM public.orders o WHERE (o.vendor_id=_uid OR (_scope='account' AND o.customer_id=_uid) OR EXISTS(SELECT 1 FROM public.order_items i WHERE i.order_id=o.id AND i.vendor_id=_uid)) AND coalesce(public.normalize_order_status(o.status),'pending') NOT IN ('delivered','completed','cancelled','returned','refunded','failed')) OR EXISTS(SELECT 1 FROM public.returns WHERE (vendor_id=_uid OR (_scope='account' AND customer_id=_uid)) AND status NOT IN ('completed','rejected','cancelled','refunded','closed')) OR EXISTS(SELECT 1 FROM public.payout_requests WHERE vendor_id=_uid AND status NOT IN ('paid','completed','rejected','cancelled')) THEN RAISE EXCEPTION 'open_orders'; END IF;
 -- Financial retention policy has not been provided: fail before mutation, never erase buyer receipts.
 IF EXISTS(SELECT 1 FROM public.order_items WHERE vendor_id=_uid OR product_id IN(SELECT id FROM public.products WHERE vendor_id=_uid)) OR EXISTS(SELECT 1 FROM public.orders WHERE vendor_id=_uid OR (_scope='account' AND customer_id=_uid)) OR EXISTS(SELECT 1 FROM public.payout_requests WHERE vendor_id=_uid) OR EXISTS(SELECT 1 FROM public.returns WHERE vendor_id=_uid OR (_scope='account' AND customer_id=_uid)) THEN RAISE EXCEPTION 'retention_review_required'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('bucket',bucket_id,'path',name)),'[]') INTO a FROM storage.objects WHERE (_scope='account' AND (owner=_uid OR owner_id=_uid::text)) OR (split_part(name,'/',1)=_uid::text AND bucket_id IN ('product-images','seller-documents','store-assets')) OR (_scope='account' AND split_part(name,'/',1)=_uid::text AND bucket_id IN ('profile-images','review-images','chat-files','returns-media','documents'));
 INSERT INTO public.seller_deletion_jobs(user_id,scope,assets) VALUES(_uid,_scope,a) ON CONFLICT(user_id,scope) DO UPDATE SET assets=EXCLUDED.assets,stage='prepared',created_at=now() RETURNING * INTO j;
 RETURN to_jsonb(j);
END $$;
REVOKE ALL ON FUNCTION public.prepare_seller_deletion(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_seller_deletion(uuid,text) TO service_role;
CREATE OR REPLACE FUNCTION public.guard_deletion_writes() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u uuid; row jsonb:=to_jsonb(NEW);
BEGIN
 FOR u IN SELECT DISTINCT value::uuid FROM jsonb_each_text(row) WHERE key IN ('vendor_id','customer_id','user_id','sender_id','uploaded_by','answered_by') AND value IS NOT NULL ORDER BY value::uuid LOOP
  PERFORM pg_advisory_xact_lock(hashtext('create_order:'||u::text));
  IF EXISTS(SELECT 1 FROM public.seller_deletion_jobs WHERE user_id=u AND stage<>'complete' AND (scope='account' OR TG_TABLE_NAME IN ('products','seller_applications','orders','order_items','coupons','payout_requests','returns','vendor_followers','vendor_ratings','review_replies','conversations'))) THEN RAISE EXCEPTION 'deletion_in_progress'; END IF;
 END LOOP;
 IF row ? 'product_id' AND EXISTS(SELECT 1 FROM public.products p JOIN public.seller_deletion_jobs j ON j.user_id=p.vendor_id WHERE p.id=(row->>'product_id')::uuid AND j.stage<>'complete') THEN RAISE EXCEPTION 'deletion_in_progress'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_deletion_writes() FROM PUBLIC,anon,authenticated;
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['products','seller_applications','orders','order_items','coupons','payout_requests','returns','cart_items','favorites','compare_items','saved_for_later','vendor_followers','vendor_ratings','review_replies','conversations','messages','message_attachments','delivery_addresses','notification_preferences','product_questions','reviews','user_roles'] LOOP EXECUTE format('CREATE TRIGGER guard_seller_deletion BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.guard_deletion_writes()',t); END LOOP; END $$;
CREATE OR REPLACE FUNCTION public.finish_seller_deletion(_uid uuid,_scope text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j public.seller_deletion_jobs%ROWTYPE; pids uuid[]; cids uuid[]; email_address text; r record;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('create_order:'||_uid::text));
 SELECT * INTO j FROM public.seller_deletion_jobs WHERE user_id=_uid AND scope=_scope FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'deletion_not_prepared'; END IF;
 IF j.stage IN ('database_done','complete') THEN RETURN; END IF;
 IF EXISTS(SELECT 1 FROM storage.objects o JOIN jsonb_to_recordset(j.assets) AS a(bucket text,path text) ON o.bucket_id=a.bucket AND o.name=a.path) THEN RAISE EXCEPTION 'storage_cleanup_failed'; END IF;
 SELECT coalesce(array_agg(id),'{}') INTO pids FROM public.products WHERE vendor_id=_uid;
 SELECT coalesce(array_agg(id),'{}') INTO cids FROM public.conversations WHERE vendor_id=_uid OR (_scope='account' AND customer_id=_uid);
 DELETE FROM public.chat_audit_log WHERE conversation_id=ANY(cids) OR (_scope='account' AND actor_id=_uid);
 DELETE FROM public.conversations WHERE id=ANY(cids);
 DELETE FROM public.vendor_followers WHERE vendor_id=_uid OR (_scope='account' AND user_id=_uid);
 DELETE FROM public.vendor_ratings WHERE vendor_id=_uid OR (_scope='account' AND user_id=_uid);
 DELETE FROM public.review_replies WHERE vendor_id=_uid;
 DELETE FROM public.product_attribute_values WHERE product_id=ANY(pids);
 DELETE FROM public.showroom_items WHERE product_id=ANY(pids) OR vendor_id=_uid;
 DELETE FROM public.saved_comparisons WHERE product_ids && pids;
 DELETE FROM public.notifications WHERE related_id=ANY(pids) OR related_id IN(SELECT id FROM public.seller_applications WHERE user_id=_uid);
 DELETE FROM public.reports WHERE target_id=ANY(pids) OR (report_type::text='seller' AND target_id=_uid);
 DELETE FROM public.coupons WHERE vendor_id=_uid;
 DELETE FROM public.seller_violations WHERE vendor_id=_uid;
 DELETE FROM public.products WHERE vendor_id=_uid;
 DELETE FROM public.seller_applications WHERE user_id=_uid;
 DELETE FROM public.user_roles WHERE user_id=_uid AND role='vendor';
 IF _scope='store' THEN UPDATE public.profiles SET role='customer',updated_at=now() WHERE id=_uid;
 ELSE
 SELECT email INTO email_address FROM auth.users WHERE id=_uid;
 FOR r IN SELECT table_name,column_name,is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name NOT IN ('seller_deletion_jobs','profiles','orders','order_items','returns','payments','payment_transactions','payout_requests','coupon_redemptions','shipping_details','tracking_history','order_notes','order_status_history','order_item_status_history','return_items','return_notes','return_status_history') AND data_type='uuid' AND column_name IN ('user_id','vendor_id','customer_id','actor_id','sender_id','author_id','uploaded_by','performed_by','reporter_id','sent_by','deleted_by','resolved_by','hidden_by','reviewed_by','answered_by','created_by','updated_by','moderated_by','status_changed_by','admin_id','last_message_sender_id') LOOP
 IF r.column_name IN ('user_id','vendor_id','customer_id','sender_id','uploaded_by','reporter_id') OR r.is_nullable='NO' THEN EXECUTE format('DELETE FROM public.%I WHERE %I=$1',r.table_name,r.column_name) USING _uid;
 ELSE EXECUTE format('UPDATE public.%I SET %I=NULL WHERE %I=$1',r.table_name,r.column_name,r.column_name) USING _uid; END IF;
 END LOOP;
 FOR r IN SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' AND data_type='text' AND column_name='email' LOOP EXECUTE format('DELETE FROM public.%I WHERE lower(%I)=lower($1)',r.table_name,r.column_name) USING email_address; END LOOP;
 DELETE FROM public.admin_audit_log WHERE target_id=_uid;
 DELETE FROM public.profiles WHERE id=_uid;
 END IF;
 UPDATE public.seller_deletion_jobs SET stage='database_done',assets='[]' WHERE user_id=_uid AND scope=_scope;
END $$;
REVOKE ALL ON FUNCTION public.finish_seller_deletion(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finish_seller_deletion(uuid,text) TO service_role;
CREATE OR REPLACE FUNCTION public.own_deletion_pending() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.seller_deletion_jobs WHERE user_id=auth.uid() AND stage<>'complete') $$;
REVOKE ALL ON FUNCTION public.own_deletion_pending() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.own_deletion_pending() TO authenticated;
CREATE POLICY deletion_upload_guard ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT public.own_deletion_pending());
CREATE POLICY deletion_upload_update_guard ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated USING (NOT public.own_deletion_pending()) WITH CHECK (NOT public.own_deletion_pending());