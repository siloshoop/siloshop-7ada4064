CREATE OR REPLACE FUNCTION public.start_conversation(p_vendor_id uuid DEFAULT NULL::uuid, p_product_id uuid DEFAULT NULL::uuid, p_order_id uuid DEFAULT NULL::uuid, p_return_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_vendor uuid := p_vendor_id;
  v_conv uuid;
  v_context text := 'general';
  v_subject text;
  v_order_no text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE='28000'; END IF;

  IF p_order_id IS NOT NULL THEN
    SELECT o.order_number INTO v_order_no FROM public.orders o
     WHERE o.id = p_order_id AND o.customer_id = v_user;
    IF NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.id = p_order_id AND o.customer_id = v_user) THEN
      RAISE EXCEPTION 'order_not_found' USING ERRCODE='P0002';
    END IF;
    IF v_vendor IS NULL THEN
      SELECT oi.vendor_id INTO v_vendor FROM public.order_items oi
       WHERE (oi.order_id = p_order_id
              OR oi.order_id IN (SELECT so.id FROM public.orders so WHERE so.parent_order_id = p_order_id))
         AND oi.vendor_id IS NOT NULL
       LIMIT 1;
    ELSE
      -- The requested vendor must actually be a seller on this order (or one of its sub-orders)
      IF NOT EXISTS (
        SELECT 1 FROM public.order_items oi
         WHERE (oi.order_id = p_order_id
                OR oi.order_id IN (SELECT so.id FROM public.orders so WHERE so.parent_order_id = p_order_id))
           AND oi.vendor_id = v_vendor
      ) AND NOT EXISTS (
        SELECT 1 FROM public.orders so
         WHERE (so.id = p_order_id OR so.parent_order_id = p_order_id)
           AND so.vendor_id = v_vendor
      ) THEN
        RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';
      END IF;
    END IF;
    v_context := 'order';
    v_subject := 'الطلب ' || COALESCE(v_order_no, '');
  ELSIF p_product_id IS NOT NULL THEN
    IF v_vendor IS NULL THEN
      SELECT pr.vendor_id INTO v_vendor FROM public.products pr WHERE pr.id = p_product_id;
    END IF;
    v_context := 'product';
  END IF;

  IF v_vendor IS NULL THEN RAISE EXCEPTION 'vendor_required' USING ERRCODE='22023'; END IF;
  IF v_vendor = v_user THEN RAISE EXCEPTION 'cannot_message_self' USING ERRCODE='22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_vendor) THEN
    RAISE EXCEPTION 'vendor_not_found' USING ERRCODE='P0002';
  END IF;
  INSERT INTO public.profiles (id) VALUES (v_user) ON CONFLICT (id) DO NOTHING;

  PERFORM pg_advisory_xact_lock(hashtext(v_user::text || v_vendor::text ||
    coalesce(p_order_id::text,'') || coalesce(p_product_id::text,'')));

  SELECT id INTO v_conv FROM public.conversations
   WHERE customer_id = v_user AND vendor_id = v_vendor
     AND order_id IS NOT DISTINCT FROM p_order_id
     AND return_id IS NULL
     AND (p_order_id IS NOT NULL OR product_id IS NOT DISTINCT FROM p_product_id)
   ORDER BY created_at LIMIT 1;

  IF v_conv IS NOT NULL THEN RETURN v_conv; END IF;

  INSERT INTO public.conversations (customer_id, vendor_id, product_id, order_id, context_type, subject)
  VALUES (v_user, v_vendor, p_product_id, p_order_id, v_context, v_subject)
  RETURNING id INTO v_conv;

  IF v_subject IS NOT NULL THEN
    INSERT INTO public.messages (conversation_id, sender_id, message_type, content, metadata)
    VALUES (v_conv, v_user, 'order_update',
            'بدأت هذه المحادثة بخصوص: ' || v_subject,
            jsonb_build_object('system', true, 'order_id', p_order_id));
  END IF;

  RETURN v_conv;
END; $function$;