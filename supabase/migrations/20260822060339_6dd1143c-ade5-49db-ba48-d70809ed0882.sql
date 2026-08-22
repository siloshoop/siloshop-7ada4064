CREATE OR REPLACE FUNCTION public.can_access_conversation_file(_path text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_folder TEXT := (storage.foldername(_path))[1];
  v_conv UUID;
BEGIN
  IF v_folder IS NULL OR v_folder !~ '^[0-9a-fA-F-]{36}$' THEN
    RETURN FALSE;
  END IF;
  v_conv := v_folder::uuid;
  IF public.has_any_admin_role(auth.uid()) THEN
    RETURN EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = v_conv);
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = v_conv
      AND (c.customer_id = auth.uid() OR c.vendor_id = auth.uid() OR c.admin_id = auth.uid())
      AND c.is_blocked = FALSE
  );
END;
$$;