-- 1) Review helpful votes
CREATE TABLE IF NOT EXISTS public.review_helpful_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (review_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.review_helpful_votes TO authenticated;
GRANT SELECT ON public.review_helpful_votes TO anon;
GRANT ALL ON public.review_helpful_votes TO service_role;
ALTER TABLE public.review_helpful_votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "helpful_votes_read" ON public.review_helpful_votes;
CREATE POLICY "helpful_votes_read" ON public.review_helpful_votes FOR SELECT USING (true);
DROP POLICY IF EXISTS "helpful_votes_insert_own" ON public.review_helpful_votes;
CREATE POLICY "helpful_votes_insert_own" ON public.review_helpful_votes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "helpful_votes_delete_own" ON public.review_helpful_votes;
CREATE POLICY "helpful_votes_delete_own" ON public.review_helpful_votes FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_helpful_votes_review ON public.review_helpful_votes(review_id);

-- 2) Product questions & answers
CREATE TABLE IF NOT EXISTS public.product_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question text NOT NULL,
  answer text,
  answered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  answered_at timestamptz,
  is_hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.product_questions TO authenticated;
GRANT SELECT ON public.product_questions TO anon;
GRANT ALL ON public.product_questions TO service_role;
ALTER TABLE public.product_questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "questions_public_read" ON public.product_questions;
CREATE POLICY "questions_public_read" ON public.product_questions FOR SELECT USING (is_hidden = false);
DROP POLICY IF EXISTS "questions_insert_own" ON public.product_questions;
CREATE POLICY "questions_insert_own" ON public.product_questions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND answer IS NULL AND length(btrim(question)) BETWEEN 5 AND 500);
DROP POLICY IF EXISTS "questions_vendor_answer" ON public.product_questions;
CREATE POLICY "questions_vendor_answer" ON public.product_questions FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.vendor_id = auth.uid()) OR public.has_any_admin_role(auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.vendor_id = auth.uid()) OR public.has_any_admin_role(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_product_questions_product ON public.product_questions(product_id, created_at DESC);

-- 3) Save for later
CREATE TABLE IF NOT EXISTS public.saved_for_later (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0 AND quantity <= 999),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_for_later TO authenticated;
GRANT ALL ON public.saved_for_later TO service_role;
ALTER TABLE public.saved_for_later ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "saved_for_later_own" ON public.saved_for_later;
CREATE POLICY "saved_for_later_own" ON public.saved_for_later FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 4) Richer address fields
ALTER TABLE public.delivery_addresses
  ADD COLUMN IF NOT EXISTS governorate text,
  ADD COLUMN IF NOT EXISTS building text,
  ADD COLUMN IF NOT EXISTS apartment text,
  ADD COLUMN IF NOT EXISTS landmark text;

-- 5) Popular searches (aggregated, no PII exposed)
CREATE OR REPLACE FUNCTION public.popular_search_terms(_limit integer DEFAULT 10)
RETURNS TABLE(term text, hits bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(btrim(sh.term)) AS term, count(*) AS hits
  FROM public.search_history sh
  WHERE sh.searched_at > now() - interval '30 days'
    AND length(btrim(sh.term)) >= 2
  GROUP BY 1
  HAVING count(*) >= 1
  ORDER BY hits DESC, term ASC
  LIMIT LEAST(GREATEST(COALESCE(_limit, 10), 1), 20);
$$;
REVOKE ALL ON FUNCTION public.popular_search_terms(integer) FROM public;
GRANT EXECUTE ON FUNCTION public.popular_search_terms(integer) TO anon, authenticated;

-- 6) Sold counts for product cards (aggregate only)
CREATE OR REPLACE FUNCTION public.product_sold_counts(_product_ids uuid[])
RETURNS TABLE(product_id uuid, sold bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT oi.product_id, COALESCE(sum(oi.quantity), 0) AS sold
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  WHERE oi.product_id = ANY(_product_ids)
    AND COALESCE(o.status, '') NOT IN ('cancelled', 'pending')
  GROUP BY oi.product_id;
$$;
REVOKE ALL ON FUNCTION public.product_sold_counts(uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.product_sold_counts(uuid[]) TO anon, authenticated;

-- 7) Latest public reviews for the homepage (no emails, no PII beyond display name)
CREATE OR REPLACE FUNCTION public.latest_public_reviews(_limit integer DEFAULT 8)
RETURNS TABLE(
  id uuid, rating integer, comment text, created_at timestamptz,
  product_id uuid, product_name text, product_image text, reviewer_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.rating, r.comment, r.created_at,
         p.id, p.name, p.image_url,
         COALESCE(NULLIF(btrim(pr.full_name), ''), 'مستخدم سيلو شوب')
  FROM public.reviews r
  JOIN public.products p ON p.id = r.product_id
  LEFT JOIN public.profiles pr ON pr.id = r.user_id
  WHERE r.is_hidden = false
    AND p.is_active = true
    AND p.moderation_status = 'approved'
    AND r.comment IS NOT NULL
    AND length(btrim(r.comment)) > 5
  ORDER BY r.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(_limit, 8), 1), 20);
$$;
REVOKE ALL ON FUNCTION public.latest_public_reviews(integer) FROM public;
GRANT EXECUTE ON FUNCTION public.latest_public_reviews(integer) TO anon, authenticated;