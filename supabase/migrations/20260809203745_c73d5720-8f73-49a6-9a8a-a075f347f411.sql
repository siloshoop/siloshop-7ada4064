CREATE TABLE IF NOT EXISTS public.vendor_followers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, vendor_id)
);

GRANT SELECT, INSERT, DELETE ON public.vendor_followers TO authenticated;
GRANT SELECT ON public.vendor_followers TO anon;
GRANT ALL ON public.vendor_followers TO service_role;

ALTER TABLE public.vendor_followers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read store followers"
  ON public.vendor_followers FOR SELECT
  USING (true);

CREATE POLICY "Users can follow stores for themselves"
  ON public.vendor_followers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unfollow their own stores"
  ON public.vendor_followers FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS vendor_followers_vendor_idx ON public.vendor_followers (vendor_id);

CREATE OR REPLACE FUNCTION public.get_store_public_profile(_vendor_id uuid)
RETURNS TABLE (
  vendor_id uuid,
  store_name text,
  owner_name text,
  description text,
  logo_url text,
  cover_image_url text,
  city text,
  governorate text,
  avatar_url text,
  rating numeric,
  review_count integer,
  product_count integer,
  follower_count integer,
  is_verified boolean,
  member_since timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    COALESCE(NULLIF(sa.store_name, ''), p.full_name, 'متجر'),
    COALESCE(NULLIF(sa.owner_name, ''), p.full_name),
    NULLIF(sa.store_description, ''),
    NULLIF(sa.logo_url, ''),
    NULLIF(sa.cover_image_url, ''),
    NULLIF(sa.city, ''),
    NULLIF(sa.governorate, ''),
    p.avatar_url,
    COALESCE((SELECT ROUND(AVG(vr.rating)::numeric, 2) FROM public.vendor_ratings vr WHERE vr.vendor_id = p.id), 0),
    COALESCE((SELECT COUNT(*)::int FROM public.vendor_ratings vr WHERE vr.vendor_id = p.id), 0),
    COALESCE((SELECT COUNT(*)::int FROM public.products pr
              WHERE pr.vendor_id = p.id AND pr.is_active = true
                AND pr.moderation_status = 'approved'), 0),
    COALESCE((SELECT COUNT(*)::int FROM public.vendor_followers vf WHERE vf.vendor_id = p.id), 0),
    COALESCE(sa.status = 'approved', false),
    p.created_at
  FROM public.profiles p
  LEFT JOIN public.seller_applications sa
    ON sa.user_id = p.id AND sa.status = 'approved'
  WHERE p.id = _vendor_id
    AND p.role = 'vendor'
    AND p.account_status = 'active'
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_store_public_profile(uuid) TO anon, authenticated;