-- Admins/Super Admins can manage platform product images stored under the `platform/` prefix
CREATE POLICY "Admins can upload platform product images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = 'platform'
  AND public.has_any_admin_role(auth.uid())
);

CREATE POLICY "Admins can update platform product images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = 'platform'
  AND public.has_any_admin_role(auth.uid())
)
WITH CHECK (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = 'platform'
  AND public.has_any_admin_role(auth.uid())
);

CREATE POLICY "Admins can delete platform product images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = 'platform'
  AND public.has_any_admin_role(auth.uid())
);

-- Store branding (logo/cover) must be readable by visitors; writes stay owner-only
CREATE POLICY "store_assets_public_read"
ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'store-assets');
