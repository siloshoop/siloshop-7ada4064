-- profile-images: avatars. Owner writes own folder; any signed-in user may read.
CREATE POLICY "profile_images_read_authenticated" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'profile-images');

CREATE POLICY "profile_images_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'profile-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "profile_images_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'profile-images' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'profile-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "profile_images_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'profile-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- chat-files: first path segment is the conversation id; only its participants may read/write.
CREATE OR REPLACE FUNCTION public.can_access_conversation_file(_path TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_folder TEXT := (storage.foldername(_path))[1];
  v_conv UUID;
BEGIN
  IF v_folder IS NULL OR v_folder !~ '^[0-9a-fA-F-]{36}$' THEN
    RETURN FALSE;
  END IF;
  v_conv := v_folder::uuid;
  RETURN EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = v_conv
      AND (c.customer_id = auth.uid() OR c.vendor_id = auth.uid())
      AND c.is_blocked = FALSE
  );
END;
$$;

REVOKE ALL ON FUNCTION public.can_access_conversation_file(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_conversation_file(TEXT) TO authenticated;

CREATE POLICY "chat_files_read_participants" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'chat-files' AND public.can_access_conversation_file(name));

CREATE POLICY "chat_files_insert_participants" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-files' AND public.can_access_conversation_file(name));

CREATE POLICY "chat_files_delete_owner" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'chat-files' AND owner = auth.uid());

-- banners: admin-managed marketing imagery, readable by any signed-in user.
CREATE POLICY "banners_read_authenticated" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'banners');

CREATE POLICY "banners_admin_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'banners' AND public.has_any_admin_role(auth.uid()));

CREATE POLICY "banners_admin_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'banners' AND public.has_any_admin_role(auth.uid()))
  WITH CHECK (bucket_id = 'banners' AND public.has_any_admin_role(auth.uid()));

CREATE POLICY "banners_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'banners' AND public.has_any_admin_role(auth.uid()));

-- documents: private per-user folder, admins may read all.
CREATE POLICY "documents_read_own_or_admin" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_any_admin_role(auth.uid()))
  );

CREATE POLICY "documents_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "documents_delete_own_or_admin" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'documents'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_any_admin_role(auth.uid()))
  );