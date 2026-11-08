-- Homepage ad carousel: reuses native_ads (placement 'home_carousel') and ad_analytics; only the platform owner manages it.
ALTER TABLE public.native_ads ADD COLUMN IF NOT EXISTS price numeric(14,2), ADD COLUMN IF NOT EXISTS currency text;
ALTER TABLE public.native_ads ADD CONSTRAINT native_ads_price_nonnegative CHECK (price IS NULL OR price >= 0);
ALTER TABLE public.native_ads ADD CONSTRAINT native_ads_price_currency CHECK ((price IS NULL AND currency IS NULL) OR (price IS NOT NULL AND currency IN ('USD','SYP')));
COMMENT ON COLUMN public.native_ads.price IS 'Optional advertised price shown on homepage carousel ads; always paired with currency';

CREATE OR REPLACE FUNCTION public.validate_admin_ad() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN IF NEW.placement NOT IN ('home','category','search','product','home_carousel') THEN RAISE EXCEPTION 'invalid_ad_placement'; END IF; IF NEW.start_date IS NOT NULL AND NEW.end_date IS NOT NULL AND NEW.end_date<=NEW.start_date THEN RAISE EXCEPTION 'invalid_ad_dates'; END IF; IF NEW.cta_url IS NOT NULL AND (NEW.cta_url !~ '^/[^/\\]' AND NEW.cta_url<>'/' OR NEW.cta_url ~ '[[:cntrl:]\\]') THEN RAISE EXCEPTION 'invalid_ad_destination'; END IF; RETURN NEW; END $$;

-- Restrictive guards: carousel rows are owner-only regardless of delegated ad permissions; shoppers only see live ones.
CREATE POLICY home_carousel_guard_select ON public.native_ads AS RESTRICTIVE FOR SELECT TO public
  USING (placement <> 'home_carousel' OR (is_active AND (start_date IS NULL OR start_date <= now()) AND (end_date IS NULL OR end_date > now())) OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY home_carousel_guard_insert ON public.native_ads AS RESTRICTIVE FOR INSERT TO public
  WITH CHECK (placement <> 'home_carousel' OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY home_carousel_guard_update ON public.native_ads AS RESTRICTIVE FOR UPDATE TO public
  USING (placement <> 'home_carousel' OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (placement <> 'home_carousel' OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY home_carousel_guard_delete ON public.native_ads AS RESTRICTIVE FOR DELETE TO public
  USING (placement <> 'home_carousel' OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY home_carousel_owner_manage ON public.native_ads FOR ALL TO authenticated
  USING (placement = 'home_carousel' AND public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (placement = 'home_carousel' AND public.has_role(auth.uid(),'super_admin'));

CREATE TABLE public.home_carousel_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  autoplay boolean NOT NULL DEFAULT true,
  slide_duration_ms integer NOT NULL DEFAULT 4500 CHECK (slide_duration_ms BETWEEN 2000 AND 20000),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.home_carousel_settings TO anon, authenticated;
GRANT INSERT, UPDATE ON public.home_carousel_settings TO authenticated;
GRANT ALL ON public.home_carousel_settings TO service_role;
ALTER TABLE public.home_carousel_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY home_carousel_settings_read ON public.home_carousel_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY home_carousel_settings_owner_insert ON public.home_carousel_settings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY home_carousel_settings_owner_update ON public.home_carousel_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE FUNCTION public.stamp_home_carousel_settings() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN NEW.updated_at := now(); NEW.updated_by := auth.uid(); RETURN NEW; END $$;
CREATE TRIGGER stamp_home_carousel_settings BEFORE INSERT OR UPDATE ON public.home_carousel_settings FOR EACH ROW EXECUTE FUNCTION public.stamp_home_carousel_settings();

CREATE INDEX IF NOT EXISTS ad_analytics_slot_event_idx ON public.ad_analytics (ad_slot, event_type);
CREATE FUNCTION public.admin_home_carousel_ad_stats() RETURNS TABLE(ad_id uuid, impressions bigint, clicks bigint, last_event_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'super_admin') THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501'; END IF;
  RETURN QUERY SELECT a.id, count(e.id) FILTER (WHERE e.event_type='impression'), count(e.id) FILTER (WHERE e.event_type='click'), max(e.created_at)
    FROM public.native_ads a LEFT JOIN public.ad_analytics e ON e.ad_slot = 'home-carousel-' || a.id::text
    WHERE a.placement = 'home_carousel' GROUP BY a.id;
END $$;
REVOKE ALL ON FUNCTION public.admin_home_carousel_ad_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_home_carousel_ad_stats() TO authenticated;