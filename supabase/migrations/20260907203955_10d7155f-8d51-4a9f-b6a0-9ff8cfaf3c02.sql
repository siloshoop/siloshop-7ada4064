CREATE TABLE public.otp_verify_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX otp_verify_attempts_ip_created_idx ON public.otp_verify_attempts (ip, created_at DESC);

GRANT ALL ON public.otp_verify_attempts TO service_role;

ALTER TABLE public.otp_verify_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "otp_verify_attempts_no_client_access"
ON public.otp_verify_attempts
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);