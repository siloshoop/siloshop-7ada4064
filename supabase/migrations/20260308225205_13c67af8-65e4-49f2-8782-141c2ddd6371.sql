
-- Fix: Restrict profile updates to safe columns only
-- Drop the existing permissive policy
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Create a SECURITY DEFINER function for safe profile updates
CREATE OR REPLACE FUNCTION public.update_own_profile(
  _full_name text DEFAULT NULL,
  _phone text DEFAULT NULL,
  _avatar_url text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET
    full_name = COALESCE(_full_name, full_name),
    phone = COALESCE(_phone, phone),
    avatar_url = COALESCE(_avatar_url, avatar_url),
    updated_at = now()
  WHERE id = auth.uid();
END;
$$;

-- Re-create update policy that prevents changing sensitive columns
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
    AND is_banned = (SELECT is_banned FROM public.profiles WHERE id = auth.uid())
    AND ban_reason IS NOT DISTINCT FROM (SELECT ban_reason FROM public.profiles WHERE id = auth.uid())
    AND banned_at IS NOT DISTINCT FROM (SELECT banned_at FROM public.profiles WHERE id = auth.uid())
  );
