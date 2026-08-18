-- Anonymous callers have no business invoking these: each acts on behalf of a
-- signed-in user (auth.uid()) or is internal/service-only.

-- Signed-in user actions: keep `authenticated`, drop `anon`.
REVOKE EXECUTE ON FUNCTION public.create_return_request(uuid, uuid, text, text, text[], text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.submit_report(report_type, uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_or_create_conversation(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_order_timeline(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_seller_performance(uuid) FROM anon;

-- Email queue plumbing: service_role (edge functions) only.
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_queue_wake() FROM anon, authenticated;

-- Internal maintenance / audit helpers: never called from the client.
REVOKE EXECUTE ON FUNCTION public.cleanup_old_rate_limits() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.actor_admin_role(uuid) FROM anon, authenticated;