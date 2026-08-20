-- ===== Content management: FAQ items =====
CREATE TABLE public.faq_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  question text NOT NULL,
  answer text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.faq_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.faq_items TO authenticated;
GRANT ALL ON public.faq_items TO service_role;
ALTER TABLE public.faq_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "faq_public_read_active" ON public.faq_items
  FOR SELECT USING (is_active = true OR public.has_any_admin_role(auth.uid()));
CREATE POLICY "faq_admin_manage" ON public.faq_items
  FOR ALL TO authenticated
  USING (public.has_any_admin_role(auth.uid()))
  WITH CHECK (public.has_any_admin_role(auth.uid()));

-- ===== Content management: static pages (policies, terms...) =====
CREATE TABLE public.content_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  is_published boolean NOT NULL DEFAULT true,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.content_pages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_pages TO authenticated;
GRANT ALL ON public.content_pages TO service_role;
ALTER TABLE public.content_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pages_public_read_published" ON public.content_pages
  FOR SELECT USING (is_published = true OR public.has_any_admin_role(auth.uid()));
CREATE POLICY "pages_admin_manage" ON public.content_pages
  FOR ALL TO authenticated
  USING (public.has_any_admin_role(auth.uid()))
  WITH CHECK (public.has_any_admin_role(auth.uid()));

-- ===== Platform settings (single row) =====
CREATE TABLE public.platform_settings (
  id integer PRIMARY KEY DEFAULT 1,
  store_name text NOT NULL DEFAULT 'SiloShop',
  support_email text,
  support_phone text,
  maintenance_mode boolean NOT NULL DEFAULT false,
  maintenance_message text,
  min_order_amount numeric NOT NULL DEFAULT 0,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_settings_single_row CHECK (id = 1)
);
GRANT SELECT ON public.platform_settings TO anon;
GRANT SELECT, UPDATE ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_public_read" ON public.platform_settings FOR SELECT USING (true);
CREATE POLICY "settings_admin_update" ON public.platform_settings
  FOR UPDATE TO authenticated
  USING (public.has_any_admin_role(auth.uid()))
  WITH CHECK (public.has_any_admin_role(auth.uid()));
INSERT INTO public.platform_settings (id) VALUES (1);

CREATE TRIGGER faq_items_updated_at BEFORE UPDATE ON public.faq_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER content_pages_updated_at BEFORE UPDATE ON public.content_pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== Admin oversight RPCs =====
CREATE OR REPLACE FUNCTION public.admin_list_coupons(_search text DEFAULT NULL, _limit integer DEFAULT 200)
RETURNS TABLE (
  id uuid, code text, vendor_id uuid, vendor_name text, discount_type text,
  discount_value numeric, min_purchase numeric, max_uses integer, used_count integer,
  expires_at timestamptz, is_active boolean, created_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_any_admin_role(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  RETURN QUERY
  SELECT c.id, c.code, c.vendor_id, p.full_name, c.discount_type, c.discount_value,
         c.min_purchase, c.max_uses, c.used_count, c.expires_at, c.is_active, c.created_at
  FROM public.coupons c
  LEFT JOIN public.profiles p ON p.id = c.vendor_id
  WHERE _search IS NULL OR _search = ''
     OR c.code ILIKE '%' || _search || '%'
     OR COALESCE(p.full_name,'') ILIKE '%' || _search || '%'
  ORDER BY c.created_at DESC
  LIMIT LEAST(COALESCE(_limit, 200), 500);
END; $$;
REVOKE ALL ON FUNCTION public.admin_list_coupons(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_coupons(text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_coupon_active(_coupon_id uuid, _is_active boolean, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _old boolean;
BEGIN
  IF NOT public.has_any_admin_role(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  SELECT is_active INTO _old FROM public.coupons WHERE id = _coupon_id FOR UPDATE;
  IF _old IS NULL THEN RAISE EXCEPTION 'coupon_not_found'; END IF;
  UPDATE public.coupons SET is_active = _is_active, updated_at = now() WHERE id = _coupon_id;
  PERFORM public.log_admin_action('coupon_set_active', 'coupon', _coupon_id,
    jsonb_build_object('is_active', _old), jsonb_build_object('is_active', _is_active), _reason);
END; $$;
REVOKE ALL ON FUNCTION public.admin_set_coupon_active(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_coupon_active(uuid, boolean, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_reviews(_status text DEFAULT 'all', _search text DEFAULT NULL, _limit integer DEFAULT 200)
RETURNS TABLE (
  id uuid, product_id uuid, product_name text, user_id uuid, author_name text,
  rating integer, comment text, image_url text, is_hidden boolean,
  hidden_reason text, created_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_any_admin_role(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  RETURN QUERY
  SELECT r.id, r.product_id, pr.name, r.user_id, pf.full_name, r.rating, r.comment,
         r.image_url, r.is_hidden, r.hidden_reason, r.created_at
  FROM public.reviews r
  LEFT JOIN public.products pr ON pr.id = r.product_id
  LEFT JOIN public.profiles pf ON pf.id = r.user_id
  WHERE (_status = 'all'
         OR (_status = 'hidden' AND r.is_hidden)
         OR (_status = 'visible' AND NOT r.is_hidden))
    AND (_search IS NULL OR _search = ''
         OR COALESCE(r.comment,'') ILIKE '%' || _search || '%'
         OR COALESCE(pr.name,'') ILIKE '%' || _search || '%'
         OR COALESCE(pf.full_name,'') ILIKE '%' || _search || '%')
  ORDER BY r.created_at DESC
  LIMIT LEAST(COALESCE(_limit, 200), 500);
END; $$;
REVOKE ALL ON FUNCTION public.admin_list_reviews(text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_reviews(text, text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_inventory_overview(_threshold integer DEFAULT 5, _limit integer DEFAULT 200)
RETURNS TABLE (
  id uuid, name text, vendor_id uuid, vendor_name text, stock_quantity integer,
  price numeric, is_active boolean, moderation_status text, image_url text, updated_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_any_admin_role(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  RETURN QUERY
  SELECT p.id, p.name, p.vendor_id, pf.full_name, COALESCE(p.stock_quantity, 0),
         p.price, p.is_active, p.moderation_status, p.image_url, p.updated_at
  FROM public.products p
  LEFT JOIN public.profiles pf ON pf.id = p.vendor_id
  WHERE COALESCE(p.stock_quantity, 0) <= GREATEST(COALESCE(_threshold, 5), 0)
  ORDER BY COALESCE(p.stock_quantity, 0) ASC, p.updated_at DESC
  LIMIT LEAST(COALESCE(_limit, 200), 500);
END; $$;
REVOKE ALL ON FUNCTION public.admin_inventory_overview(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_inventory_overview(integer, integer) TO authenticated;