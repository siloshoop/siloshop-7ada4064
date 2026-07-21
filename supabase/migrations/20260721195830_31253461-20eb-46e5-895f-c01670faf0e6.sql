
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(
  p_vendor_id uuid,
  p_product_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_conv_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF p_vendor_id IS NULL THEN
    RAISE EXCEPTION 'Vendor is required' USING ERRCODE = '22023';
  END IF;

  IF p_vendor_id = v_user THEN
    RAISE EXCEPTION 'Cannot start a conversation with yourself' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_vendor_id) THEN
    RAISE EXCEPTION 'Vendor not found' USING ERRCODE = 'P0002';
  END IF;

  -- Ensure caller has a profile row (FK requirement)
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user) THEN
    INSERT INTO public.profiles (id) VALUES (v_user)
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- Null-safe match on product_id
  SELECT id INTO v_conv_id
  FROM public.conversations
  WHERE customer_id = v_user
    AND vendor_id = p_vendor_id
    AND product_id IS NOT DISTINCT FROM p_product_id
  LIMIT 1;

  IF v_conv_id IS NOT NULL THEN
    RETURN v_conv_id;
  END IF;

  INSERT INTO public.conversations (customer_id, vendor_id, product_id)
  VALUES (v_user, p_vendor_id, p_product_id)
  RETURNING id INTO v_conv_id;

  RETURN v_conv_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_conversation(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_or_create_conversation(uuid, uuid) TO authenticated;
