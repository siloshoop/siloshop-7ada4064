
-- 1. FIX: notifications INSERT policy - restrict to authenticated users inserting for themselves only
-- (System/trigger inserts use SECURITY DEFINER which bypasses RLS)
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "Users can insert own notifications" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 2. FIX: activity_logs INSERT - create SECURITY DEFINER function and restrict direct inserts
DROP POLICY IF EXISTS "System can insert activity logs" ON public.activity_logs;

-- Create a secure function for logging activity
CREATE OR REPLACE FUNCTION public.log_activity(
  _action_type text,
  _action_details jsonb DEFAULT '{}'::jsonb,
  _user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.activity_logs (user_id, action_type, action_details, user_agent)
  VALUES (auth.uid(), _action_type, _action_details, _user_agent);
END;
$$;

-- 3. FIX: contact_rate_limits - create SECURITY DEFINER function for inserts and remove public policies
DROP POLICY IF EXISTS "Anyone can check rate limits" ON public.contact_rate_limits;
DROP POLICY IF EXISTS "Anyone can insert rate limit records" ON public.contact_rate_limits;

-- Create a secure function for recording rate limit entries
CREATE OR REPLACE FUNCTION public.record_contact_rate_limit(
  _email_hash text,
  _ip_hash text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.contact_rate_limits (email_hash, ip_hash)
  VALUES (_email_hash, _ip_hash);
END;
$$;
