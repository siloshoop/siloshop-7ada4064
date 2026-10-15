DO $mig$
DECLARE s text;
BEGIN
  s := pg_get_functiondef('public.track_order_public(uuid,text)'::regprocedure);
  IF position('''currency'', v_order.currency' in s) = 0 THEN
    s := replace(s, '''total_amount'', v_order.total_amount,', '''total_amount'', v_order.total_amount, ''currency'', v_order.currency,');
    EXECUTE s;
  END IF;
END
$mig$;