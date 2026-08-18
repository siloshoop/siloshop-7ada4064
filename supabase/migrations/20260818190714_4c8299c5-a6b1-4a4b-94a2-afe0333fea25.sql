DO $mig$
DECLARE def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO def
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='set_order_shipping_info';
  def := replace(def, 'public.has_any_admin_role(_uid)', 'public.has_role(_uid, ''admin''::public.app_role)');
  EXECUTE def;
END $mig$;