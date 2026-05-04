
-- 1. push_subscriptions: prevent anon reads, restrict to authenticated owner only
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON public.push_subscriptions;
CREATE POLICY "Authenticated users can view their own subscriptions"
ON public.push_subscriptions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id AND user_id IS NOT NULL);

-- Also tighten DELETE to authenticated only
DROP POLICY IF EXISTS "Users can delete their own subscriptions" ON public.push_subscriptions;
CREATE POLICY "Authenticated users can delete their own subscriptions"
ON public.push_subscriptions
FOR DELETE
TO authenticated
USING (auth.uid() = user_id AND user_id IS NOT NULL);

-- 2. realtime.messages: remove public:* wildcard, keep only user-scoped topic
DROP POLICY IF EXISTS "Users can subscribe to own user channel" ON realtime.messages;
CREATE POLICY "Users can subscribe to own user channel"
ON realtime.messages
FOR SELECT
TO authenticated
USING (realtime.topic() = ('user:' || auth.uid()::text));

-- 3. Lock down SECURITY DEFINER functions: revoke from anon, keep authenticated where needed
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_vendor_orders() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_own_profile(text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_activity(text, jsonb, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.send_notification(uuid, text, text, text, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_vendor_public_info(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.validate_coupon(text, numeric) FROM anon;

-- Rate-limit helpers should only be callable by service role / server-side
REVOKE EXECUTE ON FUNCTION public.check_contact_rate_limit(text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_contact_rate_limit(text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_rate_limits() FROM anon, authenticated;
