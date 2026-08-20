CREATE OR REPLACE FUNCTION public.check_email_registered(p_email text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_email text;
  v_hash text;
  v_recent int;
  v_confirmed timestamptz;
  v_found boolean;
BEGIN
  v_email := lower(btrim(coalesce(p_email, '')));
  IF v_email = '' OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;

  v_hash := encode(extensions.digest(v_email, 'sha256'), 'hex');

  DELETE FROM public.auth_email_checks WHERE created_at < now() - interval '2 hours';

  SELECT count(*) INTO v_recent
  FROM public.auth_email_checks
  WHERE email_hash = v_hash AND created_at > now() - interval '1 hour';

  IF v_recent >= 8 THEN
    RETURN jsonb_build_object('status', 'rate_limited');
  END IF;

  INSERT INTO public.auth_email_checks (email_hash) VALUES (v_hash);

  SELECT email_confirmed_at, true INTO v_confirmed, v_found
  FROM auth.users
  WHERE lower(email) = v_email
  LIMIT 1;

  IF NOT coalesce(v_found, false) THEN
    RETURN jsonb_build_object('status', 'not_registered');
  END IF;

  RETURN jsonb_build_object('status', 'registered', 'confirmed', v_confirmed IS NOT NULL);
END;
$function$;

CREATE OR REPLACE FUNCTION public.track_order_public(_order_id uuid, _phone text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_hash text;
  v_attempts int;
  v_order public.orders%ROWTYPE;
  v_history jsonb;
  v_phone text;
BEGIN
  v_phone := regexp_replace(coalesce(_phone, ''), '[^0-9]', '', 'g');
  IF _order_id IS NULL OR length(v_phone) < 6 THEN
    RETURN jsonb_build_object('error', 'invalid_input');
  END IF;

  v_hash := encode(extensions.digest(v_phone || '|' || _order_id::text, 'sha256'), 'hex');

  DELETE FROM public.order_track_rate_limits WHERE created_at < now() - interval '1 day';

  SELECT count(*) INTO v_attempts
  FROM public.order_track_rate_limits
  WHERE client_hash = v_hash AND created_at > now() - interval '1 hour';

  IF v_attempts >= 10 THEN
    RETURN jsonb_build_object('error', 'rate_limited');
  END IF;

  INSERT INTO public.order_track_rate_limits (client_hash) VALUES (v_hash);

  SELECT * INTO v_order FROM public.orders WHERE id = _order_id;

  IF NOT FOUND OR regexp_replace(coalesce(v_order.phone, ''), '[^0-9]', '', 'g') <> v_phone THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'status', h.status,
           'notes', h.notes,
           'created_at', h.created_at
         ) ORDER BY h.created_at), '[]'::jsonb)
  INTO v_history
  FROM public.order_status_history h
  WHERE h.order_id = v_order.id;

  RETURN jsonb_build_object(
    'id', v_order.id,
    'created_at', v_order.created_at,
    'status', v_order.status,
    'tracking_status', v_order.tracking_status,
    'courier_name', v_order.courier_name,
    'tracking_number', v_order.tracking_number,
    'estimated_delivery', v_order.estimated_delivery,
    'delivered_at', v_order.delivered_at,
    'total_amount', v_order.total_amount,
    'governorate', v_order.shipping_address,
    'history', v_history
  );
END;
$function$;