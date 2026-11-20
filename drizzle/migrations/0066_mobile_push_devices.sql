CREATE TABLE public.push_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  platform text NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT push_devices_token_length CHECK (char_length(token) BETWEEN 20 AND 4096)
);
CREATE INDEX push_devices_user_idx ON public.push_devices (user_id);

GRANT SELECT, DELETE ON public.push_devices TO authenticated;
GRANT ALL ON public.push_devices TO service_role;
ALTER TABLE public.push_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see their own push devices" ON public.push_devices
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users remove their own push devices" ON public.push_devices
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.register_push_device(_token text, _platform text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF _platform NOT IN ('android', 'ios', 'web') OR char_length(coalesce(_token, '')) NOT BETWEEN 20 AND 4096 THEN
    RAISE EXCEPTION 'invalid_push_device' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.push_devices (user_id, token, platform)
  VALUES (_uid, _token, _platform)
  ON CONFLICT (token) DO UPDATE
    SET user_id = EXCLUDED.user_id, platform = EXCLUDED.platform, last_seen_at = now();
  -- Keep the list bounded per account (oldest devices drop off).
  DELETE FROM public.push_devices d
  WHERE d.user_id = _uid
    AND d.id IN (
      SELECT id FROM public.push_devices WHERE user_id = _uid
      ORDER BY last_seen_at DESC OFFSET 10
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.unregister_push_device(_token text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.push_devices WHERE token = _token AND user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.register_push_device(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unregister_push_device(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_push_device(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unregister_push_device(text) TO authenticated;

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS push_sent_at timestamptz;

-- Which in-app alerts are also delivered as phone/browser notifications.
CREATE OR REPLACE FUNCTION public.notification_push_eligible(_type text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT coalesce(_type, '') IN (
    'new_order', 'order', 'order_status', 'order_cancelled',
    'staff_store_request', 'seller_approved',
    'product_approve', 'product_reject', 'product_suspend',
    'admin', 'warning', 'account_suspended', 'account_activated', 'announcement'
  )
$$;

CREATE OR REPLACE FUNCTION public.queue_notification_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT public.notification_push_eligible(NEW.type) THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.push_devices WHERE user_id = NEW.user_id) THEN
    RETURN NEW;
  END IF;
  BEGIN
    PERFORM net.http_post(
      url := 'https://cflrdbkvpzzilazdufmh.supabase.co/functions/v1/push-dispatch',
      body := jsonb_build_object('notification_id', NEW.id),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmbHJkYmt2cHp6aWxhemR1Zm1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3NzI4NDIsImV4cCI6MjA3OTM0ODg0Mn0.ZotegN0wKuu39LZ32T-wVusfbIp5i4Mui3lPoC53gCY'
      ),
      timeout_milliseconds := 5000
    );
  EXCEPTION WHEN others THEN
    -- Never block the in-app notification because the push queue is unavailable.
    RAISE WARNING 'queue_notification_push failed: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_queue_notification_push ON public.notifications;
CREATE TRIGGER trg_queue_notification_push
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.queue_notification_push();