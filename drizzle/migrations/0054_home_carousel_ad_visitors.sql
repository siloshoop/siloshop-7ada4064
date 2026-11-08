-- Ad visitor history (owner only). Carousel view events now carry the signed-in account,
-- set by the server (never trusted from the browser), plus a random per-browser visitor id
-- sent by the app for counting unique guests. No IP, device or fingerprint data is stored.
CREATE OR REPLACE FUNCTION public.ad_analytics_attach_visitor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.ad_slot LIKE 'home-carousel-%' THEN
    NEW.user_id := auth.uid();
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.ad_analytics_attach_visitor() FROM PUBLIC;

DROP TRIGGER IF EXISTS ad_analytics_attach_visitor ON public.ad_analytics;
CREATE TRIGGER ad_analytics_attach_visitor BEFORE INSERT ON public.ad_analytics
  FOR EACH ROW EXECUTE FUNCTION public.ad_analytics_attach_visitor();

CREATE INDEX IF NOT EXISTS idx_ad_analytics_slot_event_created ON public.ad_analytics (ad_slot, event_type, created_at DESC);

-- p_to is exclusive. Visits are views (impressions); older views recorded before visitor
-- details existed are counted separately and not listed.
CREATE OR REPLACE FUNCTION public.admin_home_carousel_ad_visitors(
  p_ad_id uuid, p_from timestamptz DEFAULT NULL, p_to timestamptz DEFAULT NULL,
  p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slot text := 'home-carousel-' || p_ad_id::text;
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
  v_offset integer := GREATEST(COALESCE(p_offset, 0), 0);
  v_summary jsonb;
  v_rows jsonb;
  v_tracked bigint;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.native_ads WHERE id = p_ad_id AND placement = 'home_carousel') THEN
    RAISE EXCEPTION 'ad_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT jsonb_build_object(
      'total_views', count(*),
      'signed_in_visitors', count(DISTINCT e.user_id),
      'guest_visitors', count(DISTINCT e.session_id) FILTER (WHERE e.user_id IS NULL),
      'untracked_views', count(*) FILTER (WHERE e.user_id IS NULL AND e.session_id IS NULL)),
    count(*) FILTER (WHERE e.user_id IS NOT NULL OR e.session_id IS NOT NULL)
  INTO v_summary, v_tracked
  FROM public.ad_analytics e
  WHERE e.ad_slot = v_slot AND e.event_type = 'impression'
    AND (p_from IS NULL OR e.created_at >= p_from) AND (p_to IS NULL OR e.created_at < p_to);

  v_summary := v_summary || jsonb_build_object('unique_visitors',
    (v_summary->>'signed_in_visitors')::bigint + (v_summary->>'guest_visitors')::bigint);

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'visited_at', x.created_at,
      'is_guest', x.user_id IS NULL,
      'full_name', CASE WHEN x.user_id IS NULL THEN NULL ELSE NULLIF(btrim(p.full_name), '') END,
      'avatar_url', CASE WHEN x.user_id IS NULL THEN NULL ELSE NULLIF(btrim(p.avatar_url), '') END,
      'account_missing', x.user_id IS NOT NULL AND p.id IS NULL)
    ORDER BY x.created_at DESC, x.id DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT e.id, e.user_id, e.created_at
    FROM public.ad_analytics e
    WHERE e.ad_slot = v_slot AND e.event_type = 'impression'
      AND (e.user_id IS NOT NULL OR e.session_id IS NOT NULL)
      AND (p_from IS NULL OR e.created_at >= p_from) AND (p_to IS NULL OR e.created_at < p_to)
    ORDER BY e.created_at DESC, e.id DESC
    LIMIT v_limit OFFSET v_offset
  ) x
  LEFT JOIN public.profiles p ON p.id = x.user_id;

  RETURN jsonb_build_object('summary', v_summary, 'visits', v_rows,
    'has_more', v_offset + v_limit < v_tracked);
END $$;

REVOKE ALL ON FUNCTION public.admin_home_carousel_ad_visitors(uuid, timestamptz, timestamptz, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_home_carousel_ad_visitors(uuid, timestamptz, timestamptz, integer, integer) TO authenticated, service_role;