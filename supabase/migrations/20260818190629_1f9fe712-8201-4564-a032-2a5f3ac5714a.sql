-- 1. Role-hierarchy-aware admin policies (exact 'admin' string match locked super_admins out)
DROP POLICY IF EXISTS "Admins can view all activity logs" ON public.activity_logs;
CREATE POLICY "Admins can view all activity logs" ON public.activity_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can manage announcements" ON public.announcements;
CREATE POLICY "Admins can manage announcements" ON public.announcements
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.has_any_admin_role(auth.uid()));

-- 2. Financial surfaces: admin+ only (moderators are moderation-only)
DROP POLICY IF EXISTS "Admins can view all payments" ON public.payments;
CREATE POLICY "Admins can view all payments" ON public.payments
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can view all payment transactions" ON public.payment_transactions;
CREATE POLICY "Admins can view all payment transactions" ON public.payment_transactions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can view all user roles" ON public.user_roles;
CREATE POLICY "Admins can view all user roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can view audit log" ON public.admin_audit_log;
CREATE POLICY "Admins can view audit log" ON public.admin_audit_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 3. Platform products may only be managed by super_admin; seller products by owner or admin+
CREATE OR REPLACE FUNCTION public.product_can_manage(_product_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.products p
     WHERE p.id = _product_id
       AND (
         (p.product_type = 'seller' AND p.vendor_id = auth.uid())
         OR (p.product_type = 'seller' AND public.has_role(auth.uid(), 'admin'))
         OR (p.product_type = 'platform' AND public.has_role(auth.uid(), 'super_admin'))
       )
  )
$$;

-- 4. Order / payment / refund RPCs: require admin (not moderator)
DO $mig$
DECLARE
  fn text;
  def text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'admin_refund_order','update_refund_status','admin_cancel_order','admin_set_order_freeze',
    'admin_reopen_order','admin_update_order_status','admin_resolve_return_dispute',
    'set_order_shipping_info','admin_list_orders','admin_get_order_detail','admin_user_order_history'
  ]
  LOOP
    FOR def IN
      SELECT pg_get_functiondef(p.oid)
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = fn
    LOOP
      def := replace(def, 'has_any_admin_role(auth.uid())', 'has_role(auth.uid(), ''admin''::public.app_role)');
      EXECUTE def;
    END LOOP;
  END LOOP;
END
$mig$;

-- 5. Remove residual PUBLIC / anon EXECUTE on sensitive RPCs
DO $g$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND (p.proname LIKE 'admin\_%' OR p.proname IN ('log_activity','send_notification','update_refund_status','update_order_status','set_order_shipping_info','archive_product','delete_or_archive_product','approve_seller_application','reject_seller_application','suspend_seller','reactivate_seller','delete_seller_account'))
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', r.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig);
  END LOOP;
END
$g$;