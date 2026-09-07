CREATE TABLE public.email_verification_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX email_verification_codes_email_key ON public.email_verification_codes (lower(email));

GRANT ALL ON public.email_verification_codes TO service_role;

ALTER TABLE public.email_verification_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_verification_codes_no_client_access"
ON public.email_verification_codes
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

CREATE TRIGGER update_email_verification_codes_updated_at
BEFORE UPDATE ON public.email_verification_codes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();