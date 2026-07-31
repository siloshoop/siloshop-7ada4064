CREATE TABLE public.showroom_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type text NOT NULL CHECK (item_type IN ('store','product')),
  title text NOT NULL,
  subtitle text,
  cover_image_url text,
  logo_url text,
  rating numeric,
  is_verified boolean NOT NULL DEFAULT false,
  badge_label text,
  vendor_id uuid,
  product_id uuid,
  link_url text,
  display_order integer NOT NULL DEFAULT 0,
  is_pinned boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  start_date timestamptz,
  end_date timestamptz,
  campaign_type text NOT NULL DEFAULT 'editorial',
  sponsor_name text,
  priority integer NOT NULL DEFAULT 0,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.showroom_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.showroom_items TO authenticated;
GRANT ALL ON public.showroom_items TO service_role;

ALTER TABLE public.showroom_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view live showroom items"
ON public.showroom_items FOR SELECT
USING (
  is_active = true
  AND (start_date IS NULL OR start_date <= now())
  AND (end_date IS NULL OR end_date >= now())
);

CREATE POLICY "Super admins can view all showroom items"
ON public.showroom_items FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can insert showroom items"
ON public.showroom_items FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can update showroom items"
ON public.showroom_items FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can delete showroom items"
ON public.showroom_items FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX idx_showroom_items_order ON public.showroom_items (is_pinned DESC, display_order ASC, created_at DESC);

CREATE TRIGGER update_showroom_items_updated_at
BEFORE UPDATE ON public.showroom_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();