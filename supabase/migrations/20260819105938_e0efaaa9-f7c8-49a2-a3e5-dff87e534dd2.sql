
-- Defense in depth 1: column-level UPDATE privileges
REVOKE UPDATE ON public.conversations FROM authenticated;
REVOKE UPDATE ON public.conversations FROM anon;
GRANT UPDATE (last_message_at) ON public.conversations TO authenticated;

-- Defense in depth 2: policy-level immutability of moderation columns
DROP POLICY IF EXISTS "Participants update non-moderation fields" ON public.conversations;
CREATE POLICY "Participants update non-moderation fields"
ON public.conversations
FOR UPDATE
TO authenticated
USING (
  ((customer_id = auth.uid()) OR (vendor_id = auth.uid()))
  AND NOT public.has_any_admin_role(auth.uid())
)
WITH CHECK (
  ((customer_id = auth.uid()) OR (vendor_id = auth.uid()))
  AND NOT public.has_any_admin_role(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversations.id
      AND c.customer_id       IS NOT DISTINCT FROM conversations.customer_id
      AND c.vendor_id         IS NOT DISTINCT FROM conversations.vendor_id
      AND c.is_blocked        IS NOT DISTINCT FROM conversations.is_blocked
      AND c.is_suspended      IS NOT DISTINCT FROM conversations.is_suspended
      AND c.suspended_until   IS NOT DISTINCT FROM conversations.suspended_until
      AND c.moderation_reason IS NOT DISTINCT FROM conversations.moderation_reason
      AND c.moderated_by      IS NOT DISTINCT FROM conversations.moderated_by
      AND c.moderated_at      IS NOT DISTINCT FROM conversations.moderated_at
  )
);
