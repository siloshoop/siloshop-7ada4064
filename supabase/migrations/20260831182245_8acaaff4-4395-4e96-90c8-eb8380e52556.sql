-- product-images is a public bucket (objects are already readable via the public URL),
-- but the delete/update API path needs a SELECT policy to resolve the object row.
CREATE POLICY "product_images_read"
ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'product-images');
