-- Storage removal requires the caller to see the object. Owner-managed ad images under platform/banners
-- had delete rights but no read rights, so removing an ad image silently did nothing. Owner only; files stay public via the bucket.
CREATE POLICY owner_read_platform_banner_images ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'product-images' AND (storage.foldername(name))[1] = 'platform' AND (storage.foldername(name))[2] = 'banners'
         AND public.has_role(auth.uid(), 'super_admin'));