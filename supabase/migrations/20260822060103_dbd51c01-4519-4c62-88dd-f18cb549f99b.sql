-- ============ CONVERSATIONS ============
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS return_id uuid REFERENCES public.returns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS context_type text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS last_message_preview text,
  ADD COLUMN IF NOT EXISTS last_message_sender_id uuid,
  ADD COLUMN IF NOT EXISTS admin_id uuid,
  ADD COLUMN IF NOT EXISTS admin_joined_at timestamptz;

-- ============ MESSAGES ============
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS forwarded_from_id uuid,
  ADD COLUMN IF NOT EXISTS edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS edit_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pinned_at timestamptz,
  ADD COLUMN IF NOT EXISTS pinned_by uuid,
  ADD COLUMN IF NOT EXISTS deleted_by_sender boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS read_at timestamptz,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ============ PARTICIPANTS ============
CREATE TABLE IF NOT EXISTS public.conversation_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'customer',
  unread_count integer NOT NULL DEFAULT 0,
  last_read_at timestamptz,
  last_seen_at timestamptz,
  is_archived boolean NOT NULL DEFAULT false,
  is_muted boolean NOT NULL DEFAULT false,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, user_id)
);
GRANT SELECT, UPDATE ON public.conversation_participants TO authenticated;
GRANT ALL ON public.conversation_participants TO service_role;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_conversation_member(_conversation_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversations c
     WHERE c.id = _conversation_id
       AND (c.customer_id = _user_id OR c.vendor_id = _user_id OR c.admin_id = _user_id)
  );
$$;

DROP POLICY IF EXISTS "Members view participants" ON public.conversation_participants;
CREATE POLICY "Members view participants" ON public.conversation_participants
  FOR SELECT TO authenticated
  USING (public.is_conversation_member(conversation_id, auth.uid()) OR public.has_any_admin_role(auth.uid()));

DROP POLICY IF EXISTS "Users update own participant row" ON public.conversation_participants;
CREATE POLICY "Users update own participant row" ON public.conversation_participants
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Backfill participants from existing conversations
INSERT INTO public.conversation_participants (conversation_id, user_id, role)
SELECT c.id, c.customer_id, 'customer' FROM public.conversations c
ON CONFLICT (conversation_id, user_id) DO NOTHING;
INSERT INTO public.conversation_participants (conversation_id, user_id, role)
SELECT c.id, c.vendor_id, 'vendor' FROM public.conversations c
ON CONFLICT (conversation_id, user_id) DO NOTHING;

-- ============ ATTACHMENTS ============
CREATE TABLE IF NOT EXISTS public.message_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL DEFAULT 0,
  width integer,
  height integer,
  kind text NOT NULL DEFAULT 'file',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.message_attachments TO authenticated;
GRANT ALL ON public.message_attachments TO service_role;
ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members view attachments" ON public.message_attachments;
CREATE POLICY "Members view attachments" ON public.message_attachments
  FOR SELECT TO authenticated
  USING (public.is_conversation_member(conversation_id, auth.uid()) OR public.has_any_admin_role(auth.uid()));

-- ============ MESSAGE STATUS ============
CREATE TABLE IF NOT EXISTS public.message_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  delivered_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  UNIQUE (message_id, user_id)
);
GRANT SELECT ON public.message_status TO authenticated;
GRANT ALL ON public.message_status TO service_role;
ALTER TABLE public.message_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members view message status" ON public.message_status;
CREATE POLICY "Members view message status" ON public.message_status
  FOR SELECT TO authenticated
  USING (public.is_conversation_member(conversation_id, auth.uid()) OR public.has_any_admin_role(auth.uid()));

-- ============ AUDIT LOG ============
CREATE TABLE IF NOT EXISTS public.chat_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid,
  message_id uuid,
  actor_id uuid,
  action text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.chat_audit_log TO authenticated;
GRANT ALL ON public.chat_audit_log TO service_role;
ALTER TABLE public.chat_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view chat audit" ON public.chat_audit_log;
CREATE POLICY "Admins view chat audit" ON public.chat_audit_log
  FOR SELECT TO authenticated USING (public.has_any_admin_role(auth.uid()));

-- ============ TRIGGERS ============
CREATE OR REPLACE FUNCTION public.chat_after_message_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_preview text;
BEGIN
  v_preview := CASE
    WHEN NEW.message_type = 'image' THEN '📷 صورة'
    WHEN NEW.message_type = 'file' THEN COALESCE(NEW.file_name, '📎 ملف')
    ELSE left(COALESCE(NEW.content, ''), 120)
  END;

  UPDATE public.conversations
     SET last_message_at = NEW.created_at,
         last_message_preview = v_preview,
         last_message_sender_id = NEW.sender_id
   WHERE id = NEW.conversation_id;

  INSERT INTO public.message_status (message_id, conversation_id, user_id)
  SELECT NEW.id, NEW.conversation_id, cp.user_id
    FROM public.conversation_participants cp
   WHERE cp.conversation_id = NEW.conversation_id
     AND cp.user_id <> NEW.sender_id
  ON CONFLICT (message_id, user_id) DO NOTHING;

  UPDATE public.conversation_participants
     SET unread_count = unread_count + 1,
         is_archived = false
   WHERE conversation_id = NEW.conversation_id
     AND user_id <> NEW.sender_id;

  INSERT INTO public.chat_audit_log (conversation_id, message_id, actor_id, action, metadata)
  VALUES (NEW.conversation_id, NEW.id, NEW.sender_id, 'message_sent',
          jsonb_build_object('type', NEW.message_type));

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_chat_after_message_insert ON public.messages;
CREATE TRIGGER trg_chat_after_message_insert
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.chat_after_message_insert();

CREATE OR REPLACE FUNCTION public.chat_after_conversation_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.conversation_participants (conversation_id, user_id, role)
  VALUES (NEW.id, NEW.customer_id, 'customer'), (NEW.id, NEW.vendor_id, 'vendor')
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  INSERT INTO public.chat_audit_log (conversation_id, actor_id, action, metadata)
  VALUES (NEW.id, NEW.customer_id, 'conversation_created',
          jsonb_build_object('context', NEW.context_type, 'order_id', NEW.order_id, 'return_id', NEW.return_id));
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_chat_after_conversation_insert ON public.conversations;
CREATE TRIGGER trg_chat_after_conversation_insert
AFTER INSERT ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.chat_after_conversation_insert();

-- ============ INDEXES ============
CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON public.messages (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_pinned ON public.messages (conversation_id) WHERE is_pinned;
CREATE INDEX IF NOT EXISTS idx_conv_participants_user ON public.conversation_participants (user_id, is_archived);
CREATE INDEX IF NOT EXISTS idx_conversations_order ON public.conversations (order_id);
CREATE INDEX IF NOT EXISTS idx_conversations_return ON public.conversations (return_id);
CREATE INDEX IF NOT EXISTS idx_message_status_user ON public.message_status (user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_message_attachments_msg ON public.message_attachments (message_id);

-- ============ REALTIME ============
ALTER TABLE public.conversations REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.conversation_participants REPLICA IDENTITY FULL;
ALTER TABLE public.message_status REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.messages; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.message_status; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;