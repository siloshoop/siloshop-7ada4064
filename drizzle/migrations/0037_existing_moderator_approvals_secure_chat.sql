-- Keep the existing role hierarchy, signatures, seller workflow and notifications.
DO $migration$
DECLARE d text; fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY['approve_seller_application','reject_seller_application'] LOOP
    SELECT pg_get_functiondef(p.oid) INTO d FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=fn;
    IF d IS NULL OR strpos(d, 'IF NOT public.has_role(auth.uid(),''admin'')') = 0 THEN RAISE EXCEPTION 'unexpected_seller_approval_definition'; END IF;
    d := replace(d, 'IF NOT public.has_role(auth.uid(),''admin'')', 'IF NOT public.has_any_admin_role(auth.uid())');
    d := replace(d, 'SELECT user_id INTO _uid FROM public.seller_applications WHERE id=_app_id;', 'SELECT user_id INTO _uid FROM public.seller_applications WHERE id=_app_id FOR UPDATE;
  IF public.actor_admin_role(auth.uid()) = ''moderator'' AND NOT EXISTS (SELECT 1 FROM public.seller_applications WHERE id=_app_id AND status IN (''pending'', ''rejected'')) THEN RAISE EXCEPTION ''not_authorized''; END IF;');
    EXECUTE d;
  END LOOP;
  SELECT pg_get_functiondef('public.admin_moderate_product(uuid,text,text,text)'::regprocedure) INTO d;
  IF strpos(d, 'IF NOT FOUND THEN RAISE EXCEPTION ''product_not_found''; END IF;') = 0 THEN RAISE EXCEPTION 'unexpected_product_moderation_definition'; END IF;
  d := replace(d, 'IF NOT FOUND THEN RAISE EXCEPTION ''product_not_found''; END IF;', 'IF NOT FOUND THEN RAISE EXCEPTION ''product_not_found''; END IF;
  IF public.actor_admin_role(auth.uid()) = ''moderator'' AND (_p.product_type IS DISTINCT FROM ''seller'' OR _action NOT IN (''approve'', ''reject'', ''hide'')) THEN RAISE EXCEPTION ''not_authorized''; END IF;');
  EXECUTE d;
END;
$migration$;
REVOKE ALL ON FUNCTION public.approve_seller_application(uuid), public.reject_seller_application(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_seller_application(uuid), public.reject_seller_application(uuid,text) TO authenticated, service_role;

-- Read-only application/document review; no moderator direct writes or role management.
CREATE POLICY moderator_review_seller_applications ON public.seller_applications FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'moderator'));
CREATE POLICY moderator_review_seller_documents ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'seller-documents' AND public.has_role(auth.uid(),'moderator') AND EXISTS (
    SELECT 1 FROM public.seller_applications sa WHERE sa.user_id::text = (storage.foldername(name))[1]
      AND (sa.identity_document_url = name OR sa.business_document_url = name)
  )
);

-- Both current and legacy conversation entry points share the same authorization.
CREATE OR REPLACE FUNCTION public.validate_chat_target(p_vendor_id uuid, p_product_id uuid DEFAULT NULL, p_order_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $function$
DECLARE v_user uuid := auth.uid(); v_vendor uuid := p_vendor_id; v_owner uuid; v_parent uuid; v_vendors uuid[];
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE='28000'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=v_user AND account_status='active') THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501'; END IF;
  IF p_order_id IS NOT NULL THEN
    SELECT parent_order_id INTO v_parent FROM public.orders WHERE id=p_order_id AND customer_id=v_user;
    IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found' USING ERRCODE='42501'; END IF;
    SELECT array_agg(DISTINCT vendor_id) INTO v_vendors FROM (
      SELECT oi.vendor_id FROM public.order_items oi
      WHERE (oi.order_id=p_order_id OR oi.order_id IN (SELECT id FROM public.orders WHERE parent_order_id=p_order_id)
        OR (v_parent IS NOT NULL AND oi.order_id=v_parent AND oi.vendor_id=(SELECT vendor_id FROM public.orders WHERE id=p_order_id)))
        AND oi.vendor_id IS NOT NULL AND (p_product_id IS NULL OR oi.product_id=p_product_id)
      UNION SELECT o.vendor_id FROM public.orders o WHERE (o.id=p_order_id OR o.parent_order_id=p_order_id)
        AND o.vendor_id IS NOT NULL AND p_product_id IS NULL
    ) sellers;
    IF v_vendor IS NULL THEN
      IF coalesce(array_length(v_vendors,1),0) <> 1 THEN RAISE EXCEPTION 'vendor_required' USING ERRCODE='22023'; END IF;
      v_vendor := v_vendors[1];
    END IF;
    IF NOT coalesce(v_vendor = ANY(v_vendors),false) THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501'; END IF;
  ELSIF p_product_id IS NOT NULL THEN
    SELECT vendor_id INTO v_owner FROM public.products WHERE id=p_product_id AND product_type='seller' AND is_active=true AND moderation_status='approved';
    IF NOT FOUND OR v_owner IS NULL THEN RAISE EXCEPTION 'product_not_available' USING ERRCODE='42501'; END IF;
    IF v_vendor IS NOT NULL AND v_vendor <> v_owner THEN RAISE EXCEPTION 'product_vendor_mismatch' USING ERRCODE='42501'; END IF;
    v_vendor := v_owner;
  ELSE
    IF v_vendor IS NULL OR NOT EXISTS (SELECT 1 FROM public.seller_applications WHERE user_id=v_vendor AND status='approved') THEN RAISE EXCEPTION 'vendor_not_found' USING ERRCODE='42501'; END IF;
  END IF;
  IF v_vendor=v_user THEN RAISE EXCEPTION 'cannot_message_self' USING ERRCODE='22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=v_vendor AND account_status='active') OR NOT public.has_role(v_vendor,'vendor') THEN RAISE EXCEPTION 'vendor_not_found' USING ERRCODE='42501'; END IF;
  RETURN v_vendor;
END;
$function$;
REVOKE ALL ON FUNCTION public.validate_chat_target(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.validate_chat_target(uuid,uuid,uuid) TO authenticated,service_role;

DO $migration$
DECLARE d text;
BEGIN
  SELECT pg_get_functiondef('public.start_conversation(uuid,uuid,uuid,uuid)'::regprocedure) INTO d;
  IF strpos(d,'IF p_order_id IS NOT NULL THEN')=0 THEN RAISE EXCEPTION 'unexpected_chat_definition'; END IF;
  d := replace(d,'IF p_order_id IS NOT NULL THEN', 'v_vendor := public.validate_chat_target(p_vendor_id,p_product_id,p_order_id);
  IF p_order_id IS NOT NULL THEN');
  -- Parent-held items in a child order have already been ownership-checked by validate_chat_target.
  d := replace(d, 'AND oi.vendor_id = v_vendor', 'AND oi.vendor_id = v_vendor');
  -- The legacy branch duplicates older order validation; use the saved validated vendor there.
  d := replace(d, 'IF v_vendor IS NULL THEN', 'IF false THEN');
  d := replace(d, 'END IF;
    v_context := ''order'';', 'END IF;
    v_context := ''order'';');
  -- Replace only the outdated duplicate order membership block with the validated target.
  d := replace(d, 'OR oi.order_id IN (SELECT so.id FROM public.orders so WHERE so.parent_order_id = p_order_id))', 'OR oi.order_id IN (SELECT so.id FROM public.orders so WHERE so.parent_order_id = p_order_id)
                OR oi.order_id = (SELECT parent_order_id FROM public.orders WHERE id=p_order_id AND vendor_id=v_vendor))');
  EXECUTE d;
END;
$migration$;
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(p_vendor_id uuid,p_product_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path=public AS $function$
  SELECT public.start_conversation(p_vendor_id,p_product_id,NULL,NULL);
$function$;
REVOKE ALL ON FUNCTION public.start_conversation(uuid,uuid,uuid,uuid),public.get_or_create_conversation(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.start_conversation(uuid,uuid,uuid,uuid),public.get_or_create_conversation(uuid,uuid) TO authenticated,service_role;

-- Existing clients write through protected RPCs, not through broad legacy policies.
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.conversations,public.messages,public.conversation_participants FROM authenticated,anon;
GRANT SELECT ON public.conversations,public.messages,public.conversation_participants TO authenticated;
