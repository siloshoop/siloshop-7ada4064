DO $mig$
DECLARE s text;
BEGIN
  s := pg_get_functiondef('public.seller_dashboard_overview'::regproc);
  IF position('o.total_amount, o.currency,' in s) = 0 THEN
    s := replace(s, 'SELECT DISTINCT o.id, o.created_at, o.status, o.total_amount,', 'SELECT DISTINCT o.id, o.created_at, o.status, o.total_amount, o.currency,');
    EXECUTE s;
  END IF;
END
$mig$;