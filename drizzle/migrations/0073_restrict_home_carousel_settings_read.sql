DROP POLICY IF EXISTS home_carousel_settings_read ON public.home_carousel_settings;
CREATE POLICY home_carousel_settings_read ON public.home_carousel_settings
  FOR SELECT TO anon, authenticated USING (id = 1);
REVOKE SELECT ON public.home_carousel_settings FROM anon, authenticated;
GRANT SELECT (id, autoplay, slide_duration_ms, updated_at) ON public.home_carousel_settings TO anon, authenticated;