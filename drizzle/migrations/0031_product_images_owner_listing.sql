DROP POLICY IF EXISTS "product_images_read" ON storage.objects;
CREATE POLICY "product_images_read_own" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'product-images' AND (storage.foldername(name))[1] = (select auth.uid()::text));