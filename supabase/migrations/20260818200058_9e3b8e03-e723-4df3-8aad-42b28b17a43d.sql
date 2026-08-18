-- Earlier revokes had no effect because EXECUTE was also granted to PUBLIC.
-- Strip the PUBLIC grant so the explicit role grants actually govern access.
DO $$
DECLARE
  f record;
  -- Signed-in-only RPCs: authenticated keeps access, anonymous loses it.
  auth_only text[] := ARRAY[
    'create_return_request','submit_report','submit_seller_application',
    'get_or_create_conversation','get_order_timeline','get_seller_performance',
    'update_own_profile','set_default_address','update_return_status'
  ];
  -- Trigger / internal / service-only functions: no client role needs EXECUTE.
  internal_only text[] := ARRAY[
    'audit_admin_change','enforce_contact_rate_limit','log_showroom_item_change',
    'log_stock_movement','notify_new_chat_message','prevent_coupon_used_count_tamper',
    'protect_conversation_moderation_fields','handle_new_user','actor_admin_role',
    'cleanup_old_rate_limits','notify_brand_followers','notify_favorites_deal_ended',
    'notify_favorites_new_deal','notify_order_status_change','notify_price_change',
    'notify_price_drop','notify_review_owner','notify_vendor_low_stock',
    'notify_vendor_new_order','notify_vendor_new_rating','send_push_to_brand_followers',
    'email_queue_dispatch','email_queue_wake','enqueue_email','read_email_batch',
    'delete_email','move_to_dlq'
  ];
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig, p.proname
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND (p.proname = ANY(auth_only) OR p.proname = ANY(internal_only))
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f.sig);
    IF f.proname = ANY(internal_only) THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', f.sig);
    ELSE
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f.sig);
    END IF;
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
  END LOOP;
END;
$$;