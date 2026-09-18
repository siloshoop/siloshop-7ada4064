DROP POLICY IF EXISTS "settings_public_read" ON public.platform_settings;
CREATE POLICY "settings_admin_read" ON public.platform_settings
  FOR SELECT TO authenticated
  USING (public.has_any_admin_role(auth.uid()));
REVOKE SELECT ON public.platform_settings FROM anon;

DROP POLICY IF EXISTS "Anyone can read feature flags" ON public.feature_flags;
CREATE POLICY "feature_flags_admin_read" ON public.feature_flags
  FOR SELECT TO authenticated
  USING (public.has_any_admin_role(auth.uid()));
REVOKE SELECT ON public.feature_flags FROM anon;

CREATE OR REPLACE FUNCTION public.get_public_feature_flags()
RETURNS TABLE (key text, enabled boolean, label_ar text, description text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT f.key, f.enabled, f.label_ar, f.description
  FROM public.feature_flags AS f
  ORDER BY f.key
$$;
REVOKE ALL ON FUNCTION public.get_public_feature_flags() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_feature_flags() TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "helpful_votes_read" ON public.review_helpful_votes;
CREATE POLICY "helpful_votes_read_own" ON public.review_helpful_votes
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
REVOKE SELECT ON public.review_helpful_votes FROM anon;

CREATE OR REPLACE FUNCTION public.get_review_helpful_summary(_review_ids uuid[])
RETURNS TABLE (review_id uuid, helpful_count bigint, current_user_voted boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.review_id,
         count(*) AS helpful_count,
         bool_or(v.user_id = auth.uid()) AS current_user_voted
  FROM public.review_helpful_votes AS v
  WHERE v.review_id = ANY(_review_ids)
  GROUP BY v.review_id
$$;
REVOKE ALL ON FUNCTION public.get_review_helpful_summary(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_review_helpful_summary(uuid[]) TO anon, authenticated, service_role;