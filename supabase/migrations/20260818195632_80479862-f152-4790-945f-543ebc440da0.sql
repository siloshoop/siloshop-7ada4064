-- 1. Store-follow privacy: restrict who can read vendor_followers rows.
DROP POLICY IF EXISTS "Anyone can read store followers" ON public.vendor_followers;

CREATE POLICY "Users can read their own store follows"
  ON public.vendor_followers FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Vendors can read their own followers"
  ON public.vendor_followers FOR SELECT
  TO authenticated
  USING (auth.uid() = vendor_id);

CREATE POLICY "Admins can read store follows"
  ON public.vendor_followers FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Public follower counts come from get_store_public_profile() (SECURITY DEFINER),
-- so anonymous visitors no longer need direct table access.
REVOKE SELECT ON public.vendor_followers FROM anon;

-- 2. Review image uploads: enforce image-only, size-capped uploads server-side.
DROP POLICY IF EXISTS "Authenticated can upload review images" ON storage.objects;

CREATE POLICY "Authenticated can upload review images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'review-images'
    AND (auth.uid())::text = (storage.foldername(name))[1]
    AND lower(coalesce(metadata->>'mimetype', '')) IN ('image/jpeg','image/jpg','image/png','image/webp','image/gif')
    AND coalesce((metadata->>'size')::bigint, 0) <= 5242880
  );