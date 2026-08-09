CREATE OR REPLACE FUNCTION public.notify_new_chat_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_recipient uuid;
  v_conv record;
  v_sender_name text;
  v_preview text;
BEGIN
  SELECT customer_id, vendor_id, is_blocked, is_suspended, suspended_until
    INTO v_conv
  FROM public.conversations
  WHERE id = NEW.conversation_id;

  IF v_conv IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_conv.is_blocked OR (v_conv.is_suspended AND (v_conv.suspended_until IS NULL OR v_conv.suspended_until > now())) THEN
    RETURN NEW;
  END IF;

  v_recipient := CASE WHEN NEW.sender_id = v_conv.customer_id THEN v_conv.vendor_id ELSE v_conv.customer_id END;

  IF v_recipient IS NULL OR v_recipient = NEW.sender_id THEN
    RETURN NEW;
  END IF;

  SELECT full_name INTO v_sender_name FROM public.profiles WHERE id = NEW.sender_id;

  v_preview := CASE
    WHEN NEW.message_type = 'image' THEN 'صورة'
    WHEN NEW.message_type = 'file' THEN COALESCE(NEW.file_name, 'ملف')
    ELSE left(COALESCE(NEW.content, ''), 80)
  END;

  INSERT INTO public.notifications (user_id, title, message, type, related_id)
  VALUES (
    v_recipient,
    'رسالة جديدة من ' || COALESCE(v_sender_name, 'مستخدم'),
    v_preview,
    'message',
    NEW.conversation_id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_chat_message ON public.messages;
CREATE TRIGGER trg_notify_new_chat_message
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.notify_new_chat_message();