ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone_normalized text
  GENERATED ALWAYS AS (NULLIF(regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g'), '')) STORED;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_normalized_key
  ON public.profiles (phone_normalized)
  WHERE phone_normalized IS NOT NULL;

CREATE OR REPLACE FUNCTION public.is_phone_available(p_phone text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE phone_normalized = NULLIF(regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g'), '')
  );
$$;

REVOKE ALL ON FUNCTION public.is_phone_available(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_phone_available(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_phone text;
  v_norm text;
BEGIN
  v_phone := NULLIF(NEW.raw_user_meta_data->>'phone', '');
  v_norm := NULLIF(regexp_replace(COALESCE(v_phone, ''), '[^0-9]', '', 'g'), '');

  IF v_norm IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles WHERE phone_normalized = v_norm
  ) THEN
    RAISE EXCEPTION 'PHONE_ALREADY_REGISTERED';
  END IF;

  INSERT INTO profiles (id, full_name, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    v_phone,
    'customer'::user_role
  );

  INSERT INTO user_roles (user_id, role) VALUES (NEW.id, 'customer'::app_role)
    ON CONFLICT DO NOTHING;

  RETURN NEW;
END; $function$;