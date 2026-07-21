-- Clear external/placeholder URLs from native ads. Only internal paths (starting with /) are allowed.
UPDATE public.native_ads
SET cta_url = NULL
WHERE cta_url IS NOT NULL
  AND cta_url NOT LIKE '/%';

-- Enforce internal-path-only going forward via trigger (avoids CHECK constraint issues on ALTER)
CREATE OR REPLACE FUNCTION public.validate_native_ad_cta_url()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.cta_url IS NOT NULL AND NEW.cta_url !~ '^/' THEN
    RAISE EXCEPTION 'cta_url must be an internal path starting with /';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS validate_native_ad_cta_url_trigger ON public.native_ads;
CREATE TRIGGER validate_native_ad_cta_url_trigger
BEFORE INSERT OR UPDATE ON public.native_ads
FOR EACH ROW EXECUTE FUNCTION public.validate_native_ad_cta_url();