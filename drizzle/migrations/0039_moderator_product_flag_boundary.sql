-- Moderators hide through the audited moderation action, not arbitrary merchandising or platform flags.
DO $migration$
DECLARE d text;
BEGIN
  SELECT pg_get_functiondef('public.admin_set_product_flags(uuid,boolean,boolean,boolean,boolean)'::regprocedure) INTO d;
  IF strpos(d,'IF NOT public.has_any_admin_role(auth.uid())')=0 THEN RAISE EXCEPTION 'unexpected_product_flags_definition'; END IF;
  EXECUTE replace(d,'IF NOT public.has_any_admin_role(auth.uid())','IF NOT public.has_role(auth.uid(), ''admin'')');
END;
$migration$;