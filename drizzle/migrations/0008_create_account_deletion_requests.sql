CREATE TABLE public.account_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  user_id UUID,
  handled_by UUID,
  handled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_account_deletion_requests_email ON public.account_deletion_requests (lower(email));
CREATE INDEX idx_account_deletion_requests_created_at ON public.account_deletion_requests (created_at DESC);

GRANT INSERT ON public.account_deletion_requests TO anon;
GRANT INSERT, SELECT ON public.account_deletion_requests TO authenticated;
GRANT ALL ON public.account_deletion_requests TO service_role;

ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

-- Anyone (including visitors who are not signed in) may submit a request.
CREATE POLICY "Anyone can submit a deletion request"
  ON public.account_deletion_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    char_length(btrim(email)) BETWEEN 5 AND 255
    AND btrim(email) ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    AND (phone IS NULL OR char_length(btrim(phone)) <= 20)
    AND status = 'pending'
    AND notes IS NULL
    AND handled_by IS NULL
    AND handled_at IS NULL
  );

-- Only admins can read or manage submitted requests.
CREATE POLICY "Admins can view deletion requests"
  ON public.account_deletion_requests
  FOR SELECT
  TO authenticated
  USING (public.has_any_admin_role(auth.uid()));

CREATE POLICY "Admins can update deletion requests"
  ON public.account_deletion_requests
  FOR UPDATE
  TO authenticated
  USING (public.has_any_admin_role(auth.uid()))
  WITH CHECK (public.has_any_admin_role(auth.uid()));

-- Server-side rate limit: at most 3 requests per email address per hour.
CREATE OR REPLACE FUNCTION public.enforce_deletion_request_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _recent integer;
BEGIN
  NEW.email := btrim(NEW.email);
  NEW.phone := NULLIF(btrim(COALESCE(NEW.phone, '')), '');

  SELECT count(*) INTO _recent
    FROM public.account_deletion_requests r
   WHERE lower(r.email) = lower(NEW.email)
     AND r.created_at > now() - interval '1 hour';

  IF _recent >= 3 THEN
    RAISE EXCEPTION 'deletion_request_rate_limited';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_account_deletion_requests_rate_limit
  BEFORE INSERT ON public.account_deletion_requests
  FOR EACH ROW EXECUTE FUNCTION public.enforce_deletion_request_rate_limit();