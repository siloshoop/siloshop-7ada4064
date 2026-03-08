
-- Create a SECURITY DEFINER function for admin to send notifications to users
CREATE OR REPLACE FUNCTION public.send_notification(
  _target_user_id uuid,
  _title text,
  _message text,
  _type text DEFAULT 'info',
  _related_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow admins to send notifications to other users
  IF _target_user_id != auth.uid() AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can send notifications to other users';
  END IF;

  INSERT INTO public.notifications (user_id, title, message, type, related_id)
  VALUES (_target_user_id, _title, _message, _type, _related_id);
END;
$$;
