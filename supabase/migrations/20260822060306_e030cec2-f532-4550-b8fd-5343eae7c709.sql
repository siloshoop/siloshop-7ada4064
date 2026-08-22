-- ============ START CONVERSATION ============
CREATE OR REPLACE FUNCTION public.start_conversation(
  p_vendor_id uuid DEFAULT NULL,
  p_product_id uuid DEFAULT NULL,
  p_order_id uuid DEFAULT NULL,
  p_return_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    IF v_order_no IS NULL AND NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.id = p_order_id AND o.customer_id = v_user) THEN
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
END; $$;

-- ============ SEND MESSAGE ============
CREATE OR REPLACE FUNCTION public.send_chat_message(
  p_conversation_id uuid,
  p_content text DEFAULT NULL,
  p_message_type text DEFAULT 'text',
  p_reply_to_id uuid DEFAULT NULL,
  p_attachments jsonb DEFAULT '[]'::jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  IF v_type = 'admin_notice' AND NOT v_is_admin THEN
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
END; $$;

-- ============ EDIT / DELETE / PIN / FORWARD ============
CREATE OR REPLACE FUNCTION public.edit_chat_message(p_message_id uuid, p_content text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_m record;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE='28000'; END IF;
  SELECT * INTO v_m FROM public.messages WHERE id = p_message_id;
  IF v_m.id IS NULL THEN RAISE EXCEPTION 'message_not_found' USING ERRCODE='P0002'; END IF;
  IF v_m.sender_id <> v_user THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501'; END IF;
  IF v_m.is_deleted OR v_m.deleted_by_sender THEN RAISE EXCEPTION 'message_deleted' USING ERRCODE='42501'; END IF;
  IF v_m.message_type <> 'text' THEN RAISE EXCEPTION 'not_editable' USING ERRCODE='42501'; END IF;
  IF v_m.created_at < now() - interval '15 minutes' THEN RAISE EXCEPTION 'edit_window_expired' USING ERRCODE='42501'; END IF;
  IF p_content IS NULL OR length(trim(p_content)) = 0 OR length(p_content) > 4000 THEN
    RAISE EXCEPTION 'invalid_content' USING ERRCODE='22023'; END IF;

  UPDATE public.messages
     SET content = trim(p_content), edited_at = now(), edit_count = edit_count + 1
   WHERE id = p_message_id;

  INSERT INTO public.chat_audit_log (conversation_id, message_id, actor_id, action)
  VALUES (v_m.conversation_id, p_message_id, v_user, 'message_edited');
END; $$;

CREATE OR REPLACE FUNCTION public.delete_own_chat_message(p_message_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_m record;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE='28000'; END IF;
  SELECT * INTO v_m FROM public.messages WHERE id = p_message_id;
  IF v_m.id IS NULL THEN RAISE EXCEPTION 'message_not_found' USING ERRCODE='P0002'; END IF;
  IF v_m.sender_id <> v_user THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501'; END IF;

  UPDATE public.messages
     SET deleted_by_sender = true, deleted_at = now(), deleted_by = v_user,
         content = '[تم حذف الرسالة]', file_url = NULL, is_pinned = false
   WHERE id = p_message_id;

  INSERT INTO public.chat_audit_log (conversation_id, message_id, actor_id, action)
  VALUES (v_m.conversation_id, p_message_id, v_user, 'message_deleted');
END; $$;

CREATE OR REPLACE FUNCTION public.pin_chat_message(p_message_id uuid, p_pin boolean DEFAULT true)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_m record;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE='28000'; END IF;
  SELECT * INTO v_m FROM public.messages WHERE id = p_message_id;
  IF v_m.id IS NULL THEN RAISE EXCEPTION 'message_not_found' USING ERRCODE='P0002'; END IF;
  IF NOT (public.is_conversation_member(v_m.conversation_id, v_user) OR public.has_any_admin_role(v_user)) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501'; END IF;

  UPDATE public.messages
     SET is_pinned = p_pin,
         pinned_at = CASE WHEN p_pin THEN now() ELSE NULL END,
         pinned_by = CASE WHEN p_pin THEN v_user ELSE NULL END
   WHERE id = p_message_id;
END; $$;

CREATE OR REPLACE FUNCTION public.forward_chat_message(p_message_id uuid, p_target_conversation_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_m record; v_new uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE='28000'; END IF;
  SELECT * INTO v_m FROM public.messages WHERE id = p_message_id;
  IF v_m.id IS NULL THEN RAISE EXCEPTION 'message_not_found' USING ERRCODE='P0002'; END IF;
  IF NOT public.is_conversation_member(v_m.conversation_id, v_user) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501'; END IF;
  IF NOT public.is_conversation_member(p_target_conversation_id, v_user) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501'; END IF;
  IF v_m.is_deleted OR v_m.deleted_by_sender THEN RAISE EXCEPTION 'message_deleted' USING ERRCODE='42501'; END IF;

  INSERT INTO public.messages (conversation_id, sender_id, content, message_type, file_url, file_name, forwarded_from_id, metadata)
  VALUES (p_target_conversation_id, v_user, v_m.content, v_m.message_type, v_m.file_url, v_m.file_name, v_m.id,
          jsonb_build_object('forwarded', true))
  RETURNING id INTO v_new;

  INSERT INTO public.message_attachments (message_id, conversation_id, uploaded_by, storage_path, file_name, mime_type, size_bytes, width, height, kind)
  SELECT v_new, p_target_conversation_id, v_user, a.storage_path, a.file_name, a.mime_type, a.size_bytes, a.width, a.height, a.kind
    FROM public.message_attachments a WHERE a.message_id = v_m.id;

  RETURN v_new;
END; $$;

-- ============ READ / ARCHIVE / PRESENCE ============
CREATE OR REPLACE FUNCTION public.mark_conversation_read(p_conversation_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE='28000'; END IF;
  IF NOT public.is_conversation_member(p_conversation_id, v_user) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501'; END IF;

  UPDATE public.message_status
     SET read_at = now()
   WHERE conversation_id = p_conversation_id AND user_id = v_user AND read_at IS NULL;

  UPDATE public.messages
     SET is_read = true, read_at = COALESCE(read_at, now())
   WHERE conversation_id = p_conversation_id AND sender_id <> v_user AND is_read = false;

  UPDATE public.conversation_participants
     SET unread_count = 0, last_read_at = now(), last_seen_at = now()
   WHERE conversation_id = p_conversation_id AND user_id = v_user;
END; $$;

CREATE OR REPLACE FUNCTION public.set_conversation_archived(p_conversation_id uuid, p_archived boolean DEFAULT true)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE='28000'; END IF;
  UPDATE public.conversation_participants SET is_archived = p_archived
   WHERE conversation_id = p_conversation_id AND user_id = v_user;
END; $$;

CREATE OR REPLACE FUNCTION public.touch_conversation_presence(p_conversation_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RETURN; END IF;
  UPDATE public.conversation_participants SET last_seen_at = now()
   WHERE conversation_id = p_conversation_id AND user_id = v_user;
END; $$;

CREATE OR REPLACE FUNCTION public.chat_unread_total()
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(unread_count), 0)::int FROM public.conversation_participants
   WHERE user_id = auth.uid() AND is_archived = false;
$$;

-- ============ LISTING / SEARCH ============
CREATE OR REPLACE FUNCTION public.list_conversations(
  p_search text DEFAULT NULL,
  p_archived boolean DEFAULT false,
  p_limit integer DEFAULT 30,
  p_offset integer DEFAULT 0
) RETURNS TABLE(
  id uuid, customer_id uuid, vendor_id uuid, product_id uuid, order_id uuid, return_id uuid,
  context_type text, subject text, order_number text, return_number text,
  last_message_at timestamptz, last_message_preview text, last_message_sender_id uuid,
  is_blocked boolean, is_suspended boolean, suspended_until timestamptz,
  admin_id uuid, unread_count integer, is_archived boolean,
  peer_id uuid, peer_name text, peer_avatar text, peer_last_seen timestamptz, my_role text
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH me AS (SELECT auth.uid() AS uid)
  SELECT c.id, c.customer_id, c.vendor_id, c.product_id, c.order_id, c.return_id,
         c.context_type, c.subject, o.order_number, r.return_number,
         c.last_message_at, c.last_message_preview, c.last_message_sender_id,
         c.is_blocked, c.is_suspended, c.suspended_until,
         c.admin_id, cp.unread_count, cp.is_archived,
         peer.id, peer.full_name, peer.avatar_url, peer_cp.last_seen_at, cp.role
    FROM public.conversations c
    JOIN me ON true
    JOIN public.conversation_participants cp ON cp.conversation_id = c.id AND cp.user_id = me.uid
    LEFT JOIN public.orders o ON o.id = c.order_id
    LEFT JOIN public.returns r ON r.id = c.return_id
    LEFT JOIN public.profiles peer ON peer.id = CASE WHEN c.customer_id = me.uid THEN c.vendor_id ELSE c.customer_id END
    LEFT JOIN public.conversation_participants peer_cp ON peer_cp.conversation_id = c.id AND peer_cp.user_id = peer.id
   WHERE cp.is_archived = COALESCE(p_archived, false)
     AND (
       p_search IS NULL OR length(trim(p_search)) = 0
       OR peer.full_name ILIKE '%'||p_search||'%'
       OR o.order_number ILIKE '%'||p_search||'%'
       OR r.return_number ILIKE '%'||p_search||'%'
       OR c.subject ILIKE '%'||p_search||'%'
       OR EXISTS (SELECT 1 FROM public.messages m
                   WHERE m.conversation_id = c.id AND m.content ILIKE '%'||p_search||'%')
     )
   ORDER BY c.last_message_at DESC NULLS LAST
   LIMIT GREATEST(1, LEAST(COALESCE(p_limit,30), 100)) OFFSET GREATEST(0, COALESCE(p_offset,0));
$$;

CREATE OR REPLACE FUNCTION public.list_chat_messages(
  p_conversation_id uuid,
  p_before timestamptz DEFAULT NULL,
  p_limit integer DEFAULT 40
) RETURNS TABLE(
  id uuid, conversation_id uuid, sender_id uuid, sender_name text, sender_avatar text,
  content text, message_type text, file_url text, file_name text,
  reply_to_id uuid, reply_preview text, reply_sender_id uuid,
  forwarded_from_id uuid, edited_at timestamptz, is_pinned boolean,
  is_deleted boolean, deleted_by_sender boolean, is_read boolean, read_at timestamptz,
  created_at timestamptz, metadata jsonb, attachments jsonb
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.id, m.conversation_id, m.sender_id, p.full_name, p.avatar_url,
         m.content, m.message_type, m.file_url, m.file_name,
         m.reply_to_id,
         (SELECT left(COALESCE(rm.content,''), 120) FROM public.messages rm WHERE rm.id = m.reply_to_id),
         (SELECT rm.sender_id FROM public.messages rm WHERE rm.id = m.reply_to_id),
         m.forwarded_from_id, m.edited_at, m.is_pinned,
         m.is_deleted, m.deleted_by_sender, m.is_read, m.read_at,
         m.created_at, m.metadata,
         COALESCE((SELECT jsonb_agg(jsonb_build_object(
                     'id', a.id, 'storage_path', a.storage_path, 'file_name', a.file_name,
                     'mime_type', a.mime_type, 'size_bytes', a.size_bytes, 'kind', a.kind))
                    FROM public.message_attachments a WHERE a.message_id = m.id), '[]'::jsonb)
    FROM public.messages m
    LEFT JOIN public.profiles p ON p.id = m.sender_id
   WHERE (public.is_conversation_member(p_conversation_id, auth.uid()) OR public.has_any_admin_role(auth.uid()))
     AND m.conversation_id = p_conversation_id
     AND (p_before IS NULL OR m.created_at < p_before)
   ORDER BY m.created_at DESC
   LIMIT GREATEST(1, LEAST(COALESCE(p_limit,40), 100));
$$;

CREATE OR REPLACE FUNCTION public.search_chat_messages(
  p_query text,
  p_conversation_id uuid DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_limit integer DEFAULT 40
) RETURNS TABLE(
  message_id uuid, conversation_id uuid, sender_id uuid, sender_name text,
  content text, message_type text, created_at timestamptz,
  order_number text, return_number text, peer_name text
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH me AS (SELECT auth.uid() AS uid)
  SELECT m.id, m.conversation_id, m.sender_id, sp.full_name,
         m.content, m.message_type, m.created_at,
         o.order_number, r.return_number,
         peer.full_name
    FROM public.messages m
    JOIN me ON true
    JOIN public.conversations c ON c.id = m.conversation_id
    LEFT JOIN public.orders o ON o.id = c.order_id
    LEFT JOIN public.returns r ON r.id = c.return_id
    LEFT JOIN public.profiles sp ON sp.id = m.sender_id
    LEFT JOIN public.profiles peer ON peer.id = CASE WHEN c.customer_id = me.uid THEN c.vendor_id ELSE c.customer_id END
   WHERE (c.customer_id = me.uid OR c.vendor_id = me.uid OR c.admin_id = me.uid OR public.has_any_admin_role(me.uid))
     AND m.is_deleted = false AND m.deleted_by_sender = false
     AND (p_conversation_id IS NULL OR m.conversation_id = p_conversation_id)
     AND (p_from IS NULL OR m.created_at >= p_from)
     AND (p_to IS NULL OR m.created_at <= p_to)
     AND (
       p_query IS NULL OR length(trim(p_query)) = 0
       OR m.content ILIKE '%'||p_query||'%'
       OR o.order_number ILIKE '%'||p_query||'%'
       OR r.return_number ILIKE '%'||p_query||'%'
       OR peer.full_name ILIKE '%'||p_query||'%'
     )
   ORDER BY m.created_at DESC
   LIMIT GREATEST(1, LEAST(COALESCE(p_limit,40), 100));
$$;

-- ============ ADMIN ============
CREATE OR REPLACE FUNCTION public.admin_join_conversation(p_conversation_id uuid, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_c record;
BEGIN
  IF NOT public.has_any_admin_role(v_user) THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_c FROM public.conversations WHERE id = p_conversation_id;
  IF v_c.id IS NULL THEN RAISE EXCEPTION 'conversation_not_found' USING ERRCODE='P0002'; END IF;

  UPDATE public.conversations SET admin_id = v_user, admin_joined_at = now() WHERE id = p_conversation_id;
  INSERT INTO public.conversation_participants (conversation_id, user_id, role)
  VALUES (p_conversation_id, v_user, 'admin')
  ON CONFLICT (conversation_id, user_id) DO UPDATE SET role = 'admin';

  INSERT INTO public.messages (conversation_id, sender_id, message_type, content, metadata)
  VALUES (p_conversation_id, v_user, 'admin_notice',
          COALESCE(p_note, 'انضم فريق الدعم إلى هذه المحادثة.'),
          jsonb_build_object('system', true));

  INSERT INTO public.chat_audit_log (conversation_id, actor_id, action, metadata)
  VALUES (p_conversation_id, v_user, 'admin_intervention', jsonb_build_object('note', p_note));

  INSERT INTO public.notifications (user_id, title, message, type, related_id)
  VALUES (v_c.customer_id, 'انضم الدعم للمحادثة', 'انضم فريق الدعم لمساعدتك.', 'chat_admin_joined', p_conversation_id),
         (v_c.vendor_id,   'انضم الدعم للمحادثة', 'انضم فريق الدعم إلى المحادثة.', 'chat_admin_joined', p_conversation_id);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_broadcast_chat_announcement(p_message text, p_conversation_ids uuid[] DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_count int := 0; v_id uuid;
BEGIN
  IF NOT public.has_any_admin_role(v_user) THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501'; END IF;
  IF p_message IS NULL OR length(trim(p_message)) = 0 THEN RAISE EXCEPTION 'empty_message' USING ERRCODE='22023'; END IF;

  FOR v_id IN
    SELECT c.id FROM public.conversations c
     WHERE (p_conversation_ids IS NULL AND c.is_blocked = false) OR c.id = ANY(p_conversation_ids)
  LOOP
    INSERT INTO public.messages (conversation_id, sender_id, message_type, content, metadata)
    VALUES (v_id, v_user, 'admin_notice', trim(p_message), jsonb_build_object('system', true, 'announcement', true));
    v_count := v_count + 1;
  END LOOP;

  INSERT INTO public.chat_audit_log (actor_id, action, metadata)
  VALUES (v_user, 'admin_announcement', jsonb_build_object('count', v_count));
  RETURN v_count;
END; $$;

-- ============ GRANTS ============
REVOKE ALL ON FUNCTION public.start_conversation(uuid,uuid,uuid,uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.send_chat_message(uuid,text,text,uuid,jsonb) FROM anon, public;
REVOKE ALL ON FUNCTION public.edit_chat_message(uuid,text) FROM anon, public;
REVOKE ALL ON FUNCTION public.delete_own_chat_message(uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.pin_chat_message(uuid,boolean) FROM anon, public;
REVOKE ALL ON FUNCTION public.forward_chat_message(uuid,uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.mark_conversation_read(uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.set_conversation_archived(uuid,boolean) FROM anon, public;
REVOKE ALL ON FUNCTION public.touch_conversation_presence(uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.chat_unread_total() FROM anon, public;
REVOKE ALL ON FUNCTION public.list_conversations(text,boolean,integer,integer) FROM anon, public;
REVOKE ALL ON FUNCTION public.list_chat_messages(uuid,timestamptz,integer) FROM anon, public;
REVOKE ALL ON FUNCTION public.search_chat_messages(text,uuid,timestamptz,timestamptz,integer) FROM anon, public;
REVOKE ALL ON FUNCTION public.admin_join_conversation(uuid,text) FROM anon, public;
REVOKE ALL ON FUNCTION public.admin_broadcast_chat_announcement(text,uuid[]) FROM anon, public;
REVOKE ALL ON FUNCTION public.is_conversation_member(uuid,uuid) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.start_conversation(uuid,uuid,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_chat_message(uuid,text,text,uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.edit_chat_message(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_own_chat_message(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pin_chat_message(uuid,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.forward_chat_message(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_conversation_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_conversation_archived(uuid,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.touch_conversation_presence(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_unread_total() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_conversations(text,boolean,integer,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_chat_messages(uuid,timestamptz,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_chat_messages(text,uuid,timestamptz,timestamptz,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_join_conversation(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_broadcast_chat_announcement(text,uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_conversation_member(uuid,uuid) TO authenticated;