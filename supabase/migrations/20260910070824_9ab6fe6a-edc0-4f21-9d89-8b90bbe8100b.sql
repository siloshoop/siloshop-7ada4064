CREATE OR REPLACE FUNCTION public.is_phone_available(p_phone text, p_email text DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.profiles pr
    JOIN auth.users u ON u.id = pr.id
    WHERE pr.phone_normalized = NULLIF(regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g'), '')
      AND NOT (
        u.email_confirmed_at IS NULL
        AND p_email IS NOT NULL
        AND lower(u.email) = lower(btrim(p_email))
      )
  );
$$;

REVOKE ALL ON FUNCTION public.is_phone_available(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_phone_available(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_phone_available(text, text) TO service_role;