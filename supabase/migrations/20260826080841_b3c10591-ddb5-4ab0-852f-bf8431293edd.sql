-- 1. Remove duplicate empty general conversations (keep the oldest / the one holding messages)
DELETE FROM public.conversations c
WHERE c.product_id IS NULL AND c.order_id IS NULL AND c.return_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.messages m WHERE m.conversation_id = c.id)
  AND EXISTS (
    SELECT 1 FROM public.conversations o
     WHERE o.customer_id = c.customer_id AND o.vendor_id = c.vendor_id
       AND o.product_id IS NULL AND o.order_id IS NULL AND o.return_id IS NULL
       AND o.id <> c.id
       AND (o.created_at < c.created_at OR (o.created_at = c.created_at AND o.id < c.id))
  );

-- 2. Database-level duplicate prevention per context
CREATE UNIQUE INDEX IF NOT EXISTS conversations_general_uniq
  ON public.conversations (customer_id, vendor_id)
  WHERE product_id IS NULL AND order_id IS NULL AND return_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS conversations_order_uniq
  ON public.conversations (customer_id, vendor_id, order_id)
  WHERE order_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS conversations_return_uniq
  ON public.conversations (customer_id, vendor_id, return_id)
  WHERE return_id IS NOT NULL;

-- 3. Message content length guard (validated after trimming oversize test rows)
UPDATE public.messages SET content = left(content, 4000) WHERE length(content) > 4000;
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_content_len_chk;
ALTER TABLE public.messages ADD CONSTRAINT messages_content_len_chk
  CHECK (content IS NULL OR length(content) <= 4000);

-- 4. Direct API inserts may only set safe columns (blocks message_type / metadata / pin spoofing)
REVOKE INSERT ON public.messages FROM authenticated, anon;
GRANT INSERT (conversation_id, sender_id, content, reply_to_id) ON public.messages TO authenticated;

-- 5. Participants cannot escalate their own role / forge unread counts
REVOKE INSERT, UPDATE, DELETE ON public.conversation_participants FROM authenticated, anon;
REVOKE SELECT ON public.conversation_participants FROM anon;
GRANT UPDATE (is_archived, is_muted, last_seen_at) ON public.conversation_participants TO authenticated;

-- 6. Audit / moderation / attachment / status tables: read-only for users, writes via definer functions
REVOKE INSERT, UPDATE, DELETE ON public.chat_audit_log FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.chat_moderation_log FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.message_attachments FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.message_status FROM authenticated, anon;
REVOKE SELECT ON public.chat_audit_log, public.chat_moderation_log,
                 public.message_attachments, public.message_status,
                 public.conversations, public.messages FROM anon;
GRANT ALL ON public.chat_audit_log, public.chat_moderation_log, public.message_attachments,
             public.message_status, public.conversations, public.messages,
             public.conversation_participants TO service_role;

-- 7. Record actor role in audit / moderation logs
ALTER TABLE public.chat_audit_log ADD COLUMN IF NOT EXISTS actor_role text;

CREATE OR REPLACE FUNCTION public.chat_log_fill_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'chat_audit_log' THEN
    IF NEW.actor_role IS NULL THEN
      NEW.actor_role := COALESCE(
        (SELECT r.role::text FROM public.user_roles r
          WHERE r.user_id = NEW.actor_id
          ORDER BY CASE r.role::text WHEN 'super_admin' THEN 1 WHEN 'admin' THEN 2
                                     WHEN 'moderator' THEN 3 WHEN 'vendor' THEN 4 ELSE 5 END
          LIMIT 1), 'customer');
    END IF;
  ELSE
    IF NEW.performed_by_role IS NULL THEN
      NEW.performed_by_role := COALESCE(
        (SELECT r.role::text FROM public.user_roles r
          WHERE r.user_id = NEW.performed_by
          ORDER BY CASE r.role::text WHEN 'super_admin' THEN 1 WHEN 'admin' THEN 2
                                     WHEN 'moderator' THEN 3 ELSE 4 END
          LIMIT 1), 'unknown');
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_chat_audit_fill_role ON public.chat_audit_log;
CREATE TRIGGER trg_chat_audit_fill_role BEFORE INSERT ON public.chat_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.chat_log_fill_role();
DROP TRIGGER IF EXISTS trg_chat_moderation_fill_role ON public.chat_moderation_log;
CREATE TRIGGER trg_chat_moderation_fill_role BEFORE INSERT ON public.chat_moderation_log
  FOR EACH ROW EXECUTE FUNCTION public.chat_log_fill_role();

-- 8. send_chat_message: only admins may emit system-style message types
CREATE OR REPLACE FUNCTION public.send_chat_message(p_conversation_id uuid, p_content text DEFAULT NULL::text, p_message_type text DEFAULT 'text'::text, p_reply_to_id uuid DEFAULT NULL::uuid, p_attachments jsonb DEFAULT '[]'::jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_conv record;
  v_msg uuid;
  v_att jsonb;
  v_is_admin boolean;
  v_type text := lower(coalesce(p_message_type,'text'));
  v_first_url text;
  v_first_name text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE='28000'; END IF;
  IF v_type NOT IN ('text','image','file','system','order_update','return_update','admin_notice') THEN
    RAISE EXCEPTION 'invalid_message_type' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_conv FROM public.conversations WHERE id = p_conversation_id;
  IF v_conv.id IS NULL THEN RAISE EXCEPTION 'conversation_not_found' USING ERRCODE='P0002'; END IF;

  v_is_admin := public.has_any_admin_role(v_user);
  IF NOT (v_conv.customer_id = v_user OR v_conv.vendor_id = v_user OR v_is_admin) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';
  END IF;
  IF v_type IN ('system','order_update','return_update','admin_notice') AND NOT v_is_admin THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';
  END IF;

  IF NOT v_is_admin AND (v_conv.is_blocked
      OR (v_conv.is_suspended AND (v_conv.suspended_until IS NULL OR v_conv.suspended_until > now()))) THEN
    RAISE EXCEPTION 'conversation_unavailable' USING ERRCODE='42501';
  END IF;

  IF (p_content IS NULL OR length(trim(p_content)) = 0)
     AND jsonb_array_length(coalesce(p_attachments,'[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'empty_message' USING ERRCODE='22023';
  END IF;
  IF p_content IS NOT NULL AND length(p_content) > 4000 THEN
    RAISE EXCEPTION 'message_too_long' USING ERRCODE='22023';
  END IF;
  IF p_reply_to_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.messages WHERE id = p_reply_to_id AND conversation_id = p_conversation_id) THEN
    RAISE EXCEPTION 'invalid_reply' USING ERRCODE='22023';
  END IF;

  IF jsonb_array_length(coalesce(p_attachments,'[]'::jsonb)) > 0 THEN
    v_att := p_attachments -> 0;
    v_first_url := v_att ->> 'storage_path';
    v_first_name := v_att ->> 'file_name';
  END IF;

  IF v_is_admin AND NOT (v_conv.customer_id = v_user OR v_conv.vendor_id = v_user) THEN
    UPDATE public.conversations
       SET admin_id = COALESCE(admin_id, v_user), admin_joined_at = COALESCE(admin_joined_at, now())
     WHERE id = p_conversation_id;
    INSERT INTO public.conversation_participants (conversation_id, user_id, role)
    VALUES (p_conversation_id, v_user, 'admin') ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO public.messages (conversation_id, sender_id, content, message_type, reply_to_id, file_url, file_name, metadata)
  VALUES (p_conversation_id, v_user, nullif(trim(coalesce(p_content,'')),''), v_type, p_reply_to_id,
          v_first_url, v_first_name,
          jsonb_build_object('attachment_count', jsonb_array_length(coalesce(p_attachments,'[]'::jsonb))))
  RETURNING id INTO v_msg;

  IF jsonb_array_length(coalesce(p_attachments,'[]'::jsonb)) > 0 THEN
    INSERT INTO public.message_attachments
      (message_id, conversation_id, uploaded_by, storage_path, file_name, mime_type, size_bytes, width, height, kind)
    SELECT v_msg, p_conversation_id, v_user,
           a ->> 'storage_path', coalesce(a ->> 'file_name','file'),
           coalesce(a ->> 'mime_type','application/octet-stream'),
           coalesce((a ->> 'size_bytes')::bigint, 0),
           nullif(a ->> 'width','')::int, nullif(a ->> 'height','')::int,
           CASE WHEN coalesce(a ->> 'mime_type','') LIKE 'image/%' THEN 'image' ELSE 'file' END
      FROM jsonb_array_elements(p_attachments) a;

    INSERT INTO public.chat_audit_log (conversation_id, message_id, actor_id, action, metadata)
    VALUES (p_conversation_id, v_msg, v_user, 'attachment_uploaded',
            jsonb_build_object('count', jsonb_array_length(p_attachments)));
  END IF;

  RETURN v_msg;
END; $function$;

-- 9. start_conversation: serialize creation to avoid duplicate races
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
  v_return_no text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE='28000'; END IF;

  IF p_return_id IS NOT NULL THEN
    SELECT r.vendor_id, r.return_number INTO v_vendor, v_return_no
      FROM public.returns r WHERE r.id = p_return_id AND r.customer_id = v_user;
    IF v_vendor IS NULL THEN RAISE EXCEPTION 'return_not_found' USING ERRCODE='P0002'; END IF;
    v_context := 'return';
    v_subject := 'طلب إرجاع ' || COALESCE(v_return_no, '');
  ELSIF p_order_id IS NOT NULL THEN
    SELECT o.order_number INTO v_order_no FROM public.orders o
     WHERE o.id = p_order_id AND o.customer_id = v_user;
    IF NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.id = p_order_id AND o.customer_id = v_user) THEN
      RAISE EXCEPTION 'order_not_found' USING ERRCODE='P0002';
    END IF;
    IF v_vendor IS NULL THEN
      SELECT oi.vendor_id INTO v_vendor FROM public.order_items oi
       WHERE oi.order_id = p_order_id AND oi.vendor_id IS NOT NULL LIMIT 1;
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
    coalesce(p_order_id::text,'') || coalesce(p_return_id::text,'') || coalesce(p_product_id::text,'')));

  SELECT id INTO v_conv FROM public.conversations
   WHERE customer_id = v_user AND vendor_id = v_vendor
     AND order_id IS NOT DISTINCT FROM p_order_id
     AND return_id IS NOT DISTINCT FROM p_return_id
     AND (p_order_id IS NOT NULL OR p_return_id IS NOT NULL
          OR product_id IS NOT DISTINCT FROM p_product_id)
   ORDER BY created_at LIMIT 1;

  IF v_conv IS NOT NULL THEN RETURN v_conv; END IF;

  INSERT INTO public.conversations (customer_id, vendor_id, product_id, order_id, return_id, context_type, subject)
  VALUES (v_user, v_vendor, p_product_id, p_order_id, p_return_id, v_context, v_subject)
  RETURNING id INTO v_conv;

  IF v_subject IS NOT NULL THEN
    INSERT INTO public.messages (conversation_id, sender_id, message_type, content, metadata)
    VALUES (v_conv, v_user,
            CASE WHEN v_context = 'return' THEN 'return_update' ELSE 'order_update' END,
            'بدأت هذه المحادثة بخصوص: ' || v_subject,
            jsonb_build_object('system', true, 'order_id', p_order_id, 'return_id', p_return_id));
  END IF;

  RETURN v_conv;
END; $function$;

-- 10. No anonymous access to chat functions
REVOKE EXECUTE ON FUNCTION public.return_send_message(uuid, text, text[]) FROM anon;
