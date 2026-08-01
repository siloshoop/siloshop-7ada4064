CREATE OR REPLACE FUNCTION public.admin_search_showroom_vendors(_search text DEFAULT '', _limit integer DEFAULT 20)
RETURNS TABLE (
  vendor_id uuid,
  name text,
  logo_url text,
  rating numeric,
  product_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'forbidden: super_admin role required';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    COALESCE(NULLIF(sa.store_name, ''), NULLIF(p.full_name, ''), 'متجر') AS name,
    p.avatar_url,
    (SELECT ROUND(AVG(vr.rating)::numeric, 1) FROM public.vendor_ratings vr WHERE vr.vendor_id = p.id) AS rating,
    (SELECT COUNT(*) FROM public.products pr WHERE pr.vendor_id = p.id AND pr.is_active = true) AS product_count
  FROM public.profiles p
  LEFT JOIN public.seller_applications sa
    ON sa.user_id = p.id AND sa.status = 'approved'
  WHERE p.role = 'vendor'
    AND (
      COALESCE(_search, '') = ''
      OR COALESCE(sa.store_name, '') ILIKE '%' || _search || '%'
      OR COALESCE(p.full_name, '') ILIKE '%' || _search || '%'
    )
  ORDER BY product_count DESC, name ASC
  LIMIT LEAST(COALESCE(_limit, 20), 50);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_search_showroom_vendors(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_search_showroom_vendors(text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_search_showroom_products(_search text DEFAULT '', _vendor_id uuid DEFAULT NULL, _limit integer DEFAULT 20)
RETURNS TABLE (
  product_id uuid,
  name text,
  price numeric,
  discount_price numeric,
  image_url text,
  sku text,
  vendor_id uuid,
  vendor_name text,
  rating numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'forbidden: super_admin role required';
  END IF;

  RETURN QUERY
  SELECT
    pr.id,
    pr.name,
    pr.price,
    pr.discount_price,
    pr.image_url,
    pr.sku,
    pr.vendor_id,
    COALESCE(NULLIF(sa.store_name, ''), NULLIF(pf.full_name, ''), 'متجر') AS vendor_name,
    (SELECT ROUND(AVG(r.rating)::numeric, 1) FROM public.reviews r WHERE r.product_id = pr.id AND r.is_hidden = false) AS rating
  FROM public.products pr
  LEFT JOIN public.profiles pf ON pf.id = pr.vendor_id
  LEFT JOIN public.seller_applications sa ON sa.user_id = pr.vendor_id AND sa.status = 'approved'
  WHERE pr.is_active = true
    AND (_vendor_id IS NULL OR pr.vendor_id = _vendor_id)
    AND (
      COALESCE(_search, '') = ''
      OR pr.name ILIKE '%' || _search || '%'
      OR COALESCE(pr.sku, '') ILIKE '%' || _search || '%'
    )
  ORDER BY pr.created_at DESC
  LIMIT LEAST(COALESCE(_limit, 20), 50);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_search_showroom_products(text, uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_search_showroom_products(text, uuid, integer) TO authenticated;