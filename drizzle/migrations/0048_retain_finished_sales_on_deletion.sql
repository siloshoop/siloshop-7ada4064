-- Finished order history no longer blocks deletion. No table or column changes: sold products, redeemed coupons and
-- account placeholders are retained without personal details so existing order references stay valid.
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
 SELECT coalesce(jsonb_agg(jsonb_build_object('bucket',bucket_id,'path',name)),'[]') INTO a FROM storage.objects WHERE (_scope='account' AND (owner=_uid OR owner_id=_uid::text)) OR (split_part(name,'/',1)=_uid::text AND bucket_id IN ('product-images','seller-documents','store-assets')) OR (_scope='account' AND split_part(name,'/',1)=_uid::text AND bucket_id IN ('profile-images','review-images','chat-files','returns-media','documents')) OR (bucket_id='chat-files' AND EXISTS(SELECT 1 FROM public.conversations c WHERE (c.vendor_id=_uid OR (_scope='account' AND c.customer_id=_uid)) AND (split_part(name,'/',1)=c.id::text OR EXISTS(SELECT 1 FROM public.message_attachments m WHERE m.conversation_id=c.id AND m.storage_path=name)))) OR (bucket_id='review-images' AND EXISTS(SELECT 1 FROM public.reviews r JOIN public.products p ON p.id=r.product_id WHERE p.vendor_id=_uid AND (r.image_url=name OR r.image_url LIKE '%/storage/v1/object/public/review-images/'||name)));
 INSERT INTO public.seller_deletion_jobs(user_id,scope,assets) VALUES(_uid,_scope,a) ON CONFLICT(user_id,scope) DO UPDATE SET assets=EXCLUDED.assets,stage='prepared',created_at=now() RETURNING * INTO j;
 RETURN to_jsonb(j);
END $$;

REVOKE ALL ON FUNCTION public.prepare_seller_deletion(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_seller_deletion(uuid,text) TO service_role;
CREATE OR REPLACE FUNCTION public.finish_seller_deletion(_uid uuid,_scope text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j public.seller_deletion_jobs%ROWTYPE; pids uuid[]; kept uuid[]; cids uuid[]; email_address text; r record;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('create_order:'||_uid::text));
 SELECT * INTO j FROM public.seller_deletion_jobs WHERE user_id=_uid AND scope=_scope FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'deletion_not_prepared'; END IF;
 IF j.stage IN ('database_done','complete') THEN RETURN; END IF;
 PERFORM set_config('siloshop.deletion_cleanup','on',true);
 IF current_setting('siloshop.deletion_preview',true) IS DISTINCT FROM 'on' AND EXISTS(SELECT 1 FROM storage.objects o JOIN jsonb_to_recordset(j.assets) AS a(bucket text,path text) ON o.bucket_id=a.bucket AND o.name=a.path) THEN RAISE EXCEPTION 'storage_cleanup_failed'; END IF;
 SELECT coalesce(array_agg(id),'{}') INTO pids FROM public.products WHERE vendor_id=_uid;
 SELECT coalesce(array_agg(id),'{}') INTO cids FROM public.conversations WHERE vendor_id=_uid OR (_scope='account' AND customer_id=_uid);
 DELETE FROM public.chat_audit_log WHERE conversation_id=ANY(cids) OR (_scope='account' AND actor_id=_uid);
 DELETE FROM public.conversations WHERE id=ANY(cids);
 DELETE FROM public.vendor_followers WHERE vendor_id=_uid OR (_scope='account' AND user_id=_uid);
 DELETE FROM public.vendor_ratings WHERE vendor_id=_uid OR (_scope='account' AND user_id=_uid);
 DELETE FROM public.review_replies WHERE vendor_id=_uid;
 DELETE FROM public.showroom_items WHERE product_id=ANY(pids) OR vendor_id=_uid;
 UPDATE public.saved_comparisons SET product_ids=ARRAY(SELECT x FROM unnest(product_ids) x WHERE NOT x=ANY(pids)) WHERE product_ids && pids;
 DELETE FROM public.notifications WHERE related_id=ANY(pids) OR related_id IN(SELECT id FROM public.seller_applications WHERE user_id=_uid);
 DELETE FROM public.reports WHERE target_id=ANY(pids) OR (report_type::text='seller' AND target_id=_uid);
 -- Finished sales are retained: redeemed coupons and sold products stay only as hidden references for past orders.
 DELETE FROM public.coupons c WHERE c.vendor_id=_uid AND NOT EXISTS(SELECT 1 FROM public.coupon_redemptions cr WHERE cr.coupon_id=c.id);
 UPDATE public.coupons SET is_active=false,updated_at=now() WHERE vendor_id=_uid AND is_active;
 DELETE FROM public.seller_violations WHERE vendor_id=_uid;
 SELECT coalesce(array_agg(p.id),'{}') INTO kept FROM public.products p WHERE p.vendor_id=_uid AND EXISTS(SELECT 1 FROM public.order_items oi WHERE oi.product_id=p.id);
 DELETE FROM public.products WHERE vendor_id=_uid AND NOT id=ANY(kept);
 DELETE FROM public.cart_items WHERE product_id=ANY(kept);
 DELETE FROM public.favorites WHERE product_id=ANY(kept);
 DELETE FROM public.compare_items WHERE product_id=ANY(kept);
 DELETE FROM public.saved_for_later WHERE product_id=ANY(kept);
 DELETE FROM public.recently_viewed WHERE product_id=ANY(kept);
 DELETE FROM public.wishlist_items WHERE product_id=ANY(kept);
 DELETE FROM public.daily_deals WHERE product_id=ANY(kept);
 DELETE FROM public.quantity_discounts WHERE product_id=ANY(kept);
 DELETE FROM public.product_questions WHERE product_id=ANY(kept);
 DELETE FROM public.reviews WHERE product_id=ANY(kept);
 UPDATE public.products SET moderation_status='archived',is_active=false,description=NULL,short_description=NULL,image_url=NULL,images='{}',video_url=NULL,seo_title=NULL,seo_description=NULL,seo_keywords=NULL,tags='{}',updated_at=now() WHERE id=ANY(kept);
 DELETE FROM public.seller_applications WHERE user_id=_uid;
 DELETE FROM public.user_roles WHERE user_id=_uid AND role='vendor';
 IF _scope='store' THEN UPDATE public.profiles SET role='customer',updated_at=now() WHERE id=_uid;
 ELSE
 SELECT email INTO email_address FROM auth.users WHERE id=_uid;
 FOR r IN SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='user_id' AND table_name IN ('activity_logs','ad_analytics','brand_followers','cart_items','compare_items','conversation_participants','delivery_addresses','favorites','message_status','notifications','notification_preferences','push_subscriptions','recently_viewed','review_helpful_votes','saved_comparisons','saved_for_later','search_history','user_roles','account_deletion_requests') LOOP
 EXECUTE format('DELETE FROM public.%I WHERE user_id=$1',r.table_name) USING _uid;
 END LOOP;
 DELETE FROM public.message_attachments WHERE uploaded_by=_uid;
 DELETE FROM public.messages WHERE sender_id=_uid;
 UPDATE public.messages SET deleted_by=NULL WHERE deleted_by=_uid;
 DELETE FROM public.product_questions WHERE user_id=_uid;
 UPDATE public.product_questions SET answered_by=NULL WHERE answered_by=_uid;
 DELETE FROM public.reviews WHERE user_id=_uid;
 UPDATE public.reviews SET hidden_by=NULL WHERE hidden_by=_uid;
 DELETE FROM public.reports WHERE reporter_id=_uid;
 UPDATE public.reports SET resolved_by=NULL WHERE resolved_by=_uid;
 UPDATE public.seller_applications SET reviewed_by=NULL WHERE reviewed_by=_uid;
 UPDATE public.conversations SET last_message_sender_id=NULL WHERE last_message_sender_id=_uid;
 FOR r IN SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='email' AND table_name IN ('contact_messages','newsletter_subscriptions','email_unsubscribe_tokens','email_verification_codes','account_deletion_requests') LOOP
 EXECUTE format('DELETE FROM public.%I WHERE lower(email)=lower($1)',r.table_name) USING email_address;
 END LOOP;
 DELETE FROM public.admin_audit_log WHERE target_id=_uid;
 -- Retained orders keep amounts and product snapshots, never the deleted person's contact details.
 UPDATE public.orders SET phone=NULL,shipping_address=NULL,notes=NULL,delivery_lat=NULL,delivery_lng=NULL WHERE customer_id=_uid;
 UPDATE public.payout_requests SET details=NULL WHERE vendor_id=_uid;
 IF EXISTS(SELECT 1 FROM public.orders WHERE customer_id=_uid OR vendor_id=_uid) OR EXISTS(SELECT 1 FROM public.order_items WHERE vendor_id=_uid) OR EXISTS(SELECT 1 FROM public.products WHERE vendor_id=_uid) OR EXISTS(SELECT 1 FROM public.coupons WHERE vendor_id=_uid) THEN
  -- Anonymous placeholder keeps retained sales linked; the server soft-deletes the login so it can never sign in again.
  UPDATE public.profiles SET full_name='حساب محذوف',phone=NULL,phone_normalized=NULL,avatar_url=NULL,role='customer',account_status='suspended',status_reason='account_deleted',status_changed_at=now(),status_changed_by=NULL,is_banned=false,banned_at=NULL,ban_reason=NULL,updated_at=now() WHERE id=_uid;
 ELSE
  DELETE FROM public.profiles WHERE id=_uid;
 END IF;
 END IF;
 UPDATE public.seller_deletion_jobs SET stage='database_done',assets='[]' WHERE user_id=_uid AND scope=_scope;
 PERFORM set_config('siloshop.deletion_cleanup','off',true);
END $$;

REVOKE ALL ON FUNCTION public.finish_seller_deletion(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finish_seller_deletion(uuid,text) TO service_role;