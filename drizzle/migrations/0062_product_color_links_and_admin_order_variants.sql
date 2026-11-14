-- Products listed as color alternatives of the same item share one color group.
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS color_group_id uuid;
CREATE INDEX IF NOT EXISTS products_color_group_id_idx ON public.products (color_group_id) WHERE color_group_id IS NOT NULL;
COMMENT ON COLUMN public.products.color_group_id IS 'Products sharing this id are color alternatives of each other (same owner and product type).';

-- A color group never mixes owners or seller/platform products.
CREATE OR REPLACE FUNCTION public.enforce_product_color_group()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.color_group_id IS NULL THEN RETURN NEW; END IF;
  IF EXISTS (
    SELECT 1 FROM public.products p
     WHERE p.color_group_id = NEW.color_group_id
       AND p.id <> NEW.id
       AND (p.vendor_id IS DISTINCT FROM NEW.vendor_id OR p.product_type IS DISTINCT FROM NEW.product_type)
  ) THEN
    RAISE EXCEPTION 'COLOR_GROUP_MISMATCH' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.enforce_product_color_group() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_enforce_product_color_group ON public.products;
CREATE TRIGGER trg_enforce_product_color_group
  BEFORE INSERT OR UPDATE OF color_group_id, vendor_id, product_type ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.enforce_product_color_group();

-- Replaces the full list of color alternatives linked to one product, atomically.
CREATE OR REPLACE FUNCTION public.set_product_color_links(_product_id uuid, _linked_ids uuid[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _p public.products%ROWTYPE;
  _ids uuid[];
  _group uuid;
  _old_groups uuid[];
  _g uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  SELECT * INTO _p FROM public.products WHERE id = _product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'product_not_found' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.product_can_manage(_product_id) THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501'; END IF;

  SELECT coalesce(array_agg(DISTINCT x), '{}') INTO _ids
    FROM unnest(coalesce(_linked_ids, '{}'::uuid[])) x WHERE x IS NOT NULL AND x <> _product_id;
  IF cardinality(_ids) > 20 THEN RAISE EXCEPTION 'COLOR_LINKS_TOO_MANY' USING ERRCODE = '22023'; END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(_ids) x
     WHERE NOT EXISTS (
       SELECT 1 FROM public.products q
        WHERE q.id = x AND q.vendor_id IS NOT DISTINCT FROM _p.vendor_id
          AND q.product_type IS NOT DISTINCT FROM _p.product_type
          AND public.product_can_manage(q.id)
     )
  ) THEN
    RAISE EXCEPTION 'COLOR_LINK_INVALID' USING ERRCODE = '42501';
  END IF;

  PERFORM 1 FROM public.products WHERE id = ANY(_ids) FOR UPDATE;

  SELECT coalesce(array_agg(DISTINCT color_group_id), '{}') INTO _old_groups
    FROM public.products WHERE (id = ANY(_ids) OR id = _product_id) AND color_group_id IS NOT NULL;

  IF cardinality(_ids) = 0 THEN
    UPDATE public.products SET color_group_id = NULL WHERE id = _product_id AND color_group_id IS NOT NULL;
    _group := NULL;
  ELSE
    _group := coalesce(_p.color_group_id, gen_random_uuid());
    UPDATE public.products SET color_group_id = NULL
     WHERE color_group_id = _group AND id <> _product_id AND NOT (id = ANY(_ids));
    UPDATE public.products SET color_group_id = _group
     WHERE (id = _product_id OR id = ANY(_ids)) AND color_group_id IS DISTINCT FROM _group;
  END IF;

  -- A group left with a single product is no longer a color group.
  FOREACH _g IN ARRAY _old_groups LOOP
    IF (SELECT count(*) FROM public.products WHERE color_group_id = _g) = 1 THEN
      UPDATE public.products SET color_group_id = NULL WHERE color_group_id = _g;
    END IF;
  END LOOP;

  RETURN _group;
END;
$function$;
REVOKE ALL ON FUNCTION public.set_product_color_links(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_product_color_links(uuid, uuid[]) TO authenticated, service_role;

-- Admin order details show the saved color/size and the image saved at purchase time.
CREATE OR REPLACE FUNCTION public.admin_get_order_detail(_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT jsonb_build_object(
    'order', to_jsonb(o),
    'customer', (
      SELECT jsonb_build_object(
        'full_name', cp.full_name,
        'email', (SELECT u.email::text FROM auth.users u WHERE u.id = o.customer_id),
        'account_status', cp.account_status
      )
      FROM public.profiles cp
      WHERE cp.id = o.customer_id
    ),
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', oi.id,
        'product_id', oi.product_id,
        'product_name', COALESCE(oi.product_name, pr.name),
        'product_image', COALESCE(NULLIF(oi.product_image, ''), pr.image_url, pr.images[1]),
        'variant_id', oi.variant_id,
        'variant_label', oi.variant_label,
        'quantity', oi.quantity,
        'price', oi.price,
        'vendor_id', oi.vendor_id,
        'vendor_name', vp.full_name,
        'vendor_store_name', (
          SELECT sa.store_name FROM public.seller_applications sa
           WHERE sa.user_id = oi.vendor_id AND sa.status = 'approved'
           ORDER BY sa.updated_at DESC NULLS LAST LIMIT 1
        ),
        'vendor_email', (SELECT u.email::text FROM auth.users u WHERE u.id = oi.vendor_id)
      ) ORDER BY oi.created_at)
      FROM public.order_items oi
      LEFT JOIN public.products pr ON pr.id = oi.product_id
      LEFT JOIN public.profiles vp ON vp.id = oi.vendor_id
      WHERE oi.order_id = o.id
    ), '[]'::jsonb),
    'history', COALESCE((
      SELECT jsonb_agg(to_jsonb(h) ORDER BY h.created_at)
      FROM public.order_status_history h
      WHERE h.order_id = o.id
    ), '[]'::jsonb),
    'payments', COALESCE((
      SELECT jsonb_agg(to_jsonb(p) ORDER BY p.created_at)
      FROM public.payments p
      WHERE p.order_id = o.id
    ), '[]'::jsonb),
    'notes', COALESCE((
      SELECT jsonb_agg(to_jsonb(n) ORDER BY n.created_at)
      FROM public.order_notes n
      WHERE n.order_id = o.id
    ), '[]'::jsonb)
  )
  INTO _result
  FROM public.orders o
  WHERE o.id = _order_id;

  RETURN _result;
END;
$function$;