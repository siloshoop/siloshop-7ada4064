
-- Prevent chat participants from clearing moderation flags on conversations.
DROP POLICY IF EXISTS "Users can update their conversations" ON public.conversations;

CREATE POLICY "Participants update non-moderation fields"
  ON public.conversations
  FOR UPDATE
  TO authenticated
  USING (
    (customer_id = auth.uid() OR vendor_id = auth.uid())
    AND NOT public.has_any_admin_role(auth.uid())
  )
  WITH CHECK (
    (customer_id = auth.uid() OR vendor_id = auth.uid())
  );

CREATE OR REPLACE FUNCTION public.protect_conversation_moderation_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_any_admin_role(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF NEW.is_blocked        IS DISTINCT FROM OLD.is_blocked
     OR NEW.is_suspended    IS DISTINCT FROM OLD.is_suspended
     OR NEW.suspended_until IS DISTINCT FROM OLD.suspended_until
     OR NEW.moderation_reason IS DISTINCT FROM OLD.moderation_reason
     OR NEW.moderated_by    IS DISTINCT FROM OLD.moderated_by
     OR NEW.moderated_at    IS DISTINCT FROM OLD.moderated_at
     OR NEW.customer_id     IS DISTINCT FROM OLD.customer_id
     OR NEW.vendor_id       IS DISTINCT FROM OLD.vendor_id
  THEN
    RAISE EXCEPTION 'not_authorized_to_modify_moderation_fields';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_conversation_moderation_fields ON public.conversations;
CREATE TRIGGER protect_conversation_moderation_fields
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.protect_conversation_moderation_fields();

-- pgmq wrappers: lock search_path
CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name text, payload jsonb)
 RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER
 SET search_path = public, pgmq
AS $function$
BEGIN
  RETURN pgmq.send(queue_name, payload);
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN pgmq.send(queue_name, payload);
END;
$function$;

CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name text, batch_size integer, vt integer)
 RETURNS TABLE(msg_id bigint, read_ct integer, message jsonb)
 LANGUAGE plpgsql SECURITY DEFINER
 SET search_path = public, pgmq
AS $function$
BEGIN
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.message FROM pgmq.read(queue_name, vt, batch_size) r;
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_email(queue_name text, message_id bigint)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
 SET search_path = public, pgmq
AS $function$
BEGIN
  RETURN pgmq.delete(queue_name, message_id);
EXCEPTION WHEN undefined_table THEN
  RETURN FALSE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb)
 RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER
 SET search_path = public, pgmq
AS $function$
DECLARE new_id BIGINT;
BEGIN
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  PERFORM pgmq.delete(source_queue, message_id);
  RETURN new_id;
EXCEPTION WHEN undefined_table THEN
  BEGIN
    PERFORM pgmq.create(dlq_name);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  BEGIN
    PERFORM pgmq.delete(source_queue, message_id);
  EXCEPTION WHEN undefined_table THEN NULL;
  END;
  RETURN new_id;
END;
$function$;
