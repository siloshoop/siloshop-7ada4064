CREATE OR REPLACE FUNCTION public.start_conversation(p_vendor_id uuid DEFAULT NULL,p_product_id uuid DEFAULT NULL,p_order_id uuid DEFAULT NULL,p_return_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $function$
DECLARE v_user uuid := auth.uid(); v_vendor uuid; v_conv uuid; v_context text := 'general'; v_subject text; v_order_no text;
BEGIN
  v_vendor := public.validate_chat_target(p_vendor_id,p_product_id,p_order_id);
  IF p_order_id IS NOT NULL THEN
    SELECT order_number INTO v_order_no FROM public.orders WHERE id=p_order_id AND customer_id=v_user;
    v_context := 'order'; v_subject := 'الطلب ' || coalesce(v_order_no,'');
  ELSIF p_product_id IS NOT NULL THEN v_context := 'product'; END IF;
  -- Keep the existing context and deduplication behavior; no new authentication system.
  PERFORM pg_advisory_xact_lock(hashtext(v_user::text || v_vendor::text || coalesce(p_order_id::text,'') || coalesce(p_product_id::text,'')));
  SELECT id INTO v_conv FROM public.conversations WHERE customer_id=v_user AND vendor_id=v_vendor
    AND order_id IS NOT DISTINCT FROM p_order_id AND return_id IS NULL
    AND (p_order_id IS NOT NULL OR product_id IS NOT DISTINCT FROM p_product_id)
    ORDER BY created_at LIMIT 1;
  IF v_conv IS NOT NULL THEN RETURN v_conv; END IF;
  INSERT INTO public.conversations(customer_id,vendor_id,product_id,order_id,context_type,subject)
    VALUES(v_user,v_vendor,p_product_id,p_order_id,v_context,v_subject) RETURNING id INTO v_conv;
  IF v_subject IS NOT NULL THEN
    INSERT INTO public.messages(conversation_id,sender_id,message_type,content,metadata)
    VALUES(v_conv,v_user,'order_update','بدأت هذه المحادثة بخصوص: ' || v_subject,jsonb_build_object('system',true,'order_id',p_order_id));
  END IF;
  RETURN v_conv;
END;
$function$;
-- Apply the same active-account, membership and blocked-thread guards to all message writers,
-- including forwarding. Existing administrator moderation remains intact.
CREATE OR REPLACE FUNCTION public.guard_chat_message_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $function$
DECLARE v_user uuid := auth.uid(); v_conv public.conversations%ROWTYPE;
BEGIN
  IF coalesce(auth.role(),'')='service_role' THEN RETURN NEW; END IF;
  IF v_user IS NULL OR NEW.sender_id IS DISTINCT FROM v_user THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=v_user AND account_status='active') THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501'; END IF;
  IF public.has_any_admin_role(v_user) THEN RETURN NEW; END IF;
  SELECT * INTO v_conv FROM public.conversations WHERE id=NEW.conversation_id;
  IF NOT FOUND OR (v_conv.customer_id IS DISTINCT FROM v_user AND v_conv.vendor_id IS DISTINCT FROM v_user) THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501'; END IF;
  IF v_conv.is_blocked OR (v_conv.is_suspended AND (v_conv.suspended_until IS NULL OR v_conv.suspended_until>now())) THEN RAISE EXCEPTION 'conversation_unavailable' USING ERRCODE='42501'; END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.guard_chat_message_insert() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_chat_message_insert BEFORE INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.guard_chat_message_insert();