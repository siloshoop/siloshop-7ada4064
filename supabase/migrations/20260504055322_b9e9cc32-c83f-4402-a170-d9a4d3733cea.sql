
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    CASE WHEN (NEW.raw_user_meta_data->>'role') = 'vendor' THEN 'vendor'::user_role ELSE 'customer'::user_role END
  );
  INSERT INTO user_roles (user_id, role)
  VALUES (
    NEW.id,
    CASE WHEN (NEW.raw_user_meta_data->>'role') = 'vendor' THEN 'vendor'::app_role ELSE 'customer'::app_role END
  );
  RETURN NEW;
END;
$function$;

DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can insert own notifications" ON public.notifications;
CREATE POLICY "Users can insert own notifications"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
