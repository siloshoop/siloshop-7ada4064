CREATE OR REPLACE FUNCTION public.create_order(
  _items jsonb,
  _phone text,
  _shipping_address text,
  _notes text DEFAULT NULL,
  _coupon_code text DEFAULT NULL,
  _payment_method text DEFAULT 'cash_on_delivery',
  _pickup_center_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _src text;
BEGIN
  RAISE EXCEPTION 'placeholder';
END;
$function$;