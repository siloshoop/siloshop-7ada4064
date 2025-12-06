-- Create a table for contact form rate limiting
CREATE TABLE public.contact_rate_limits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_hash text NOT NULL,
  email_hash text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contact_rate_limits ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (for rate limit tracking)
CREATE POLICY "Anyone can insert rate limit records"
ON public.contact_rate_limits
FOR INSERT
WITH CHECK (true);

-- Allow anyone to select their own rate limit records for checking
CREATE POLICY "Anyone can check rate limits"
ON public.contact_rate_limits
FOR SELECT
USING (true);

-- Create index for faster lookups
CREATE INDEX idx_contact_rate_limits_email_hash ON public.contact_rate_limits(email_hash);
CREATE INDEX idx_contact_rate_limits_created_at ON public.contact_rate_limits(created_at);

-- Create function to clean old rate limit records (older than 1 hour)
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.contact_rate_limits
  WHERE created_at < NOW() - INTERVAL '1 hour';
END;
$$;

-- Create function to check rate limit (max 3 submissions per hour per email)
CREATE OR REPLACE FUNCTION public.check_contact_rate_limit(p_email_hash text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*) < 3
  FROM public.contact_rate_limits
  WHERE email_hash = p_email_hash
    AND created_at > NOW() - INTERVAL '1 hour'
$$;