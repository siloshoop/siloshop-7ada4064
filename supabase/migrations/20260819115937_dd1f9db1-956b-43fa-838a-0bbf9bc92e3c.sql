CREATE TABLE IF NOT EXISTS public.auth_email_checks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email_hash text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auth_email_checks_hash_time_idx ON public.auth_email_checks (email_hash, created_at DESC);
GRANT ALL ON public.auth_email_checks TO service_role;
ALTER TABLE public.auth_email_checks ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.check_email_registered(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  v_hash := encode(digest(v_email, 'sha256'), 'hex');

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
$$;

REVOKE ALL ON FUNCTION public.check_email_registered(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_email_registered(text) TO anon, authenticated, service_role;