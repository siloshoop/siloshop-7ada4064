
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_suspended boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspended_until timestamptz,
  ADD COLUMN IF NOT EXISTS moderation_reason text,
  ADD COLUMN IF NOT EXISTS moderated_by uuid,
  ADD COLUMN IF NOT EXISTS moderated_at timestamptz;

CREATE TABLE IF NOT EXISTS public.chat_moderation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  action text NOT NULL,
  reason text,
  performed_by uuid NOT NULL,
  performed_by_role text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.chat_moderation_log TO authenticated;
GRANT ALL ON public.chat_moderation_log TO service_role;
ALTER TABLE public.chat_moderation_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view chat moderation log" ON public.chat_moderation_log;
CREATE POLICY "Admins view chat moderation log"
  ON public.chat_moderation_log FOR SELECT
  TO authenticated
  USING (public.has_any_admin_role(auth.uid()));

CREATE INDEX IF NOT EXISTS chat_mod_log_conv_idx ON public.chat_moderation_log(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS conversations_moderation_idx ON public.conversations(is_blocked, is_suspended, last_message_at DESC);

DROP POLICY IF EXISTS "Admins view all conversations" ON public.conversations;
CREATE POLICY "Admins view all conversations"
  ON public.conversations FOR SELECT
  TO authenticated
  USING (public.has_any_admin_role(auth.uid()));

DROP POLICY IF EXISTS "Admins update conversations" ON public.conversations;
CREATE POLICY "Admins update conversations"
  ON public.conversations FOR UPDATE
  TO authenticated
  USING (public.has_any_admin_role(auth.uid()))
  WITH CHECK (public.has_any_admin_role(auth.uid()));

DROP POLICY IF EXISTS "Admins view all messages" ON public.messages;
CREATE POLICY "Admins view all messages"
  ON public.messages FOR SELECT
  TO authenticated
  USING (public.has_any_admin_role(auth.uid()));

DROP POLICY IF EXISTS "Users can send messages in their conversations" ON public.messages;
CREATE POLICY "Users can send messages in their conversations"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (c.customer_id = auth.uid() OR c.vendor_id = auth.uid())
        AND c.is_blocked = false
        AND (
          c.is_suspended = false
          OR (c.suspended_until IS NOT NULL AND c.suspended_until <= now())
        )
    )
  );

CREATE OR REPLACE FUNCTION public.admin_delete_message(_message_id uuid, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _conv_id uuid; _sender uuid;
BEGIN
  IF NOT public.has_any_admin_role(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  SELECT conversation_id, sender_id INTO _conv_id, _sender FROM public.messages WHERE id = _message_id;
  IF _conv_id IS NULL THEN RAISE EXCEPTION 'message_not_found'; END IF;

  UPDATE public.messages
     SET is_deleted = true, deleted_by = auth.uid(), deleted_at = now(),
         content = '[تم حذف الرسالة من قبل الإدارة]'
   WHERE id = _message_id;

  INSERT INTO public.chat_moderation_log (conversation_id, message_id, action, reason, performed_by, metadata)
  VALUES (_conv_id, _message_id, 'delete_message', _reason, auth.uid(),
          jsonb_build_object('sender_id', _sender));
END; $$;

CREATE OR REPLACE FUNCTION public.admin_block_conversation(_conversation_id uuid, _reason text, _block boolean DEFAULT true)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _customer uuid; _vendor uuid;
BEGIN
  IF NOT public.has_any_admin_role(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  UPDATE public.conversations
     SET is_blocked = _block,
         moderation_reason = CASE WHEN _block THEN _reason ELSE NULL END,
         moderated_by = auth.uid(), moderated_at = now()
   WHERE id = _conversation_id
   RETURNING customer_id, vendor_id INTO _customer, _vendor;
  IF _customer IS NULL THEN RAISE EXCEPTION 'conversation_not_found'; END IF;

  INSERT INTO public.chat_moderation_log (conversation_id, action, reason, performed_by)
  VALUES (_conversation_id, CASE WHEN _block THEN 'block' ELSE 'unblock' END, _reason, auth.uid());

  IF _block THEN
    INSERT INTO public.notifications (user_id, title, message, type, related_id)
    VALUES
      (_customer, 'تم حظر المحادثة', COALESCE('تم حظر المحادثة من قبل الإدارة: '||_reason,'تم حظر المحادثة من قبل الإدارة.'), 'chat_blocked', _conversation_id),
      (_vendor,   'تم حظر المحادثة', COALESCE('تم حظر المحادثة من قبل الإدارة: '||_reason,'تم حظر المحادثة من قبل الإدارة.'), 'chat_blocked', _conversation_id);
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_suspend_conversation(_conversation_id uuid, _reason text, _until timestamptz DEFAULT NULL, _suspend boolean DEFAULT true)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _customer uuid; _vendor uuid;
BEGIN
  IF NOT public.has_any_admin_role(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  UPDATE public.conversations
     SET is_suspended = _suspend,
         suspended_until = CASE WHEN _suspend THEN _until ELSE NULL END,
         moderation_reason = CASE WHEN _suspend THEN _reason ELSE moderation_reason END,
         moderated_by = auth.uid(), moderated_at = now()
   WHERE id = _conversation_id
   RETURNING customer_id, vendor_id INTO _customer, _vendor;
  IF _customer IS NULL THEN RAISE EXCEPTION 'conversation_not_found'; END IF;

  INSERT INTO public.chat_moderation_log (conversation_id, action, reason, performed_by, metadata)
  VALUES (_conversation_id, CASE WHEN _suspend THEN 'suspend' ELSE 'unsuspend' END, _reason, auth.uid(),
          jsonb_build_object('until', _until));

  IF _suspend THEN
    INSERT INTO public.notifications (user_id, title, message, type, related_id)
    VALUES
      (_customer, 'تم تعليق المحادثة', COALESCE('تم تعليق المحادثة مؤقتاً: '||_reason,'تم تعليق المحادثة مؤقتاً.'), 'chat_suspended', _conversation_id),
      (_vendor,   'تم تعليق المحادثة', COALESCE('تم تعليق المحادثة مؤقتاً: '||_reason,'تم تعليق المحادثة مؤقتاً.'), 'chat_suspended', _conversation_id);
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_list_conversations(
  _search text DEFAULT NULL,
  _filter text DEFAULT 'all',
  _limit int DEFAULT 50,
  _offset int DEFAULT 0
) RETURNS TABLE(
  id uuid, customer_id uuid, vendor_id uuid, product_id uuid,
  customer_name text, vendor_name text,
  last_message_at timestamptz, created_at timestamptz,
  is_blocked boolean, is_suspended boolean, suspended_until timestamptz,
  moderation_reason text, last_message text,
  message_count bigint, reported_count bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.id, c.customer_id, c.vendor_id, c.product_id,
         cp.full_name, vp.full_name,
         c.last_message_at, c.created_at,
         c.is_blocked, c.is_suspended, c.suspended_until, c.moderation_reason,
         (SELECT CASE WHEN m.is_deleted THEN '[محذوفة]' WHEN m.message_type='text' THEN m.content ELSE '📎 مرفق' END
            FROM public.messages m WHERE m.conversation_id = c.id
            ORDER BY m.created_at DESC LIMIT 1),
         (SELECT count(*) FROM public.messages m WHERE m.conversation_id = c.id),
         (SELECT count(*) FROM public.reports r
           WHERE r.report_type::text = 'message'
             AND r.target_id IN (SELECT id FROM public.messages WHERE conversation_id = c.id))
  FROM public.conversations c
  LEFT JOIN public.profiles cp ON cp.id = c.customer_id
  LEFT JOIN public.profiles vp ON vp.id = c.vendor_id
  WHERE public.has_any_admin_role(auth.uid())
    AND (
      _filter = 'all'
      OR (_filter = 'active'    AND c.is_blocked = false AND (c.is_suspended = false OR (c.suspended_until IS NOT NULL AND c.suspended_until <= now())))
      OR (_filter = 'blocked'   AND c.is_blocked = true)
      OR (_filter = 'suspended' AND c.is_suspended = true AND (c.suspended_until IS NULL OR c.suspended_until > now()))
      OR (_filter = 'reported'  AND EXISTS (
            SELECT 1 FROM public.reports r
             WHERE r.report_type::text = 'message'
               AND r.target_id IN (SELECT id FROM public.messages WHERE conversation_id = c.id)))
    )
    AND (
      _search IS NULL OR length(trim(_search)) = 0
      OR cp.full_name ILIKE '%'||_search||'%'
      OR vp.full_name ILIKE '%'||_search||'%'
      OR EXISTS (SELECT 1 FROM public.messages m WHERE m.conversation_id = c.id AND m.content ILIKE '%'||_search||'%')
    )
  ORDER BY c.last_message_at DESC NULLS LAST
  LIMIT GREATEST(1, LEAST(_limit, 200)) OFFSET GREATEST(0, _offset);
$$;

CREATE OR REPLACE FUNCTION public.admin_get_conversation_messages(_conversation_id uuid)
RETURNS TABLE(
  id uuid, conversation_id uuid, sender_id uuid, sender_name text,
  content text, message_type text, file_url text, file_name text,
  is_deleted boolean, deleted_by uuid, deleted_at timestamptz,
  created_at timestamptz, report_count bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT m.id, m.conversation_id, m.sender_id, p.full_name,
         m.content, m.message_type, m.file_url, m.file_name,
         m.is_deleted, m.deleted_by, m.deleted_at, m.created_at,
         (SELECT count(*) FROM public.reports r
           WHERE r.report_type::text='message' AND r.target_id = m.id)
  FROM public.messages m
  LEFT JOIN public.profiles p ON p.id = m.sender_id
  WHERE public.has_any_admin_role(auth.uid())
    AND m.conversation_id = _conversation_id
  ORDER BY m.created_at ASC;
$$;
