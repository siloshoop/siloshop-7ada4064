-- 1. messages: restrict updates to marking as read (recipient) only
DROP POLICY IF EXISTS "Users can update their messages" ON public.messages;

REVOKE UPDATE ON public.messages FROM authenticated;
GRANT UPDATE (is_read) ON public.messages TO authenticated;

CREATE POLICY "Recipients can mark messages as read"
ON public.messages FOR UPDATE
TO authenticated
USING (
  sender_id <> auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = messages.conversation_id
      AND (c.customer_id = auth.uid() OR c.vendor_id = auth.uid())
  )
)
WITH CHECK (
  sender_id <> auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = messages.conversation_id
      AND (c.customer_id = auth.uid() OR c.vendor_id = auth.uid())
  )
);

-- 2. platform_payment_settings: no anonymous read
DROP POLICY IF EXISTS "Anyone can read platform payment settings" ON public.platform_payment_settings;
REVOKE SELECT ON public.platform_payment_settings FROM anon;

CREATE POLICY "Authenticated users can read platform payment settings"
ON public.platform_payment_settings FOR SELECT
TO authenticated
USING (is_active = true);