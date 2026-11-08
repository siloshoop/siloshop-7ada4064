-- Read-only: returns the best-selling value of one attribute (e.g. color) for a publicly visible product,
-- counted from already-recorded order lines (variant_id), excluding cancelled/refunded orders like sold_count.
-- Returns only the value (never counts), and NULL when there are no sales, a tie, or fewer than two options.
CREATE OR REPLACE FUNCTION public.get_popular_variant_option(p_product_id uuid, p_attribute text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH visible AS (
    SELECT p.id FROM public.products p
    WHERE p.id = p_product_id AND p.is_active = true AND p.moderation_status = 'approved'
      AND (p.product_type <> 'platform' OR public.is_feature_enabled('platform_marketplace'))
  ), options AS (
    SELECT DISTINCT v.attributes->>p_attribute AS val
    FROM public.product_variants v JOIN visible ON visible.id = v.product_id
    WHERE v.is_active IS TRUE AND COALESCE(v.attributes->>p_attribute, '') <> ''
  ), sales AS (
    SELECT v.attributes->>p_attribute AS val, SUM(oi.quantity)::bigint AS qty
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    JOIN public.product_variants v ON v.id = oi.variant_id
    JOIN visible ON visible.id = oi.product_id
    WHERE o.status NOT IN ('cancelled', 'refunded') AND v.product_id = oi.product_id
      AND COALESCE(v.attributes->>p_attribute, '') <> ''
    GROUP BY 1
  ), ranked AS (
    SELECT s.val, s.qty, rank() OVER (ORDER BY s.qty DESC) AS r
    FROM sales s JOIN options ON options.val = s.val
    WHERE s.qty > 0
  )
  SELECT CASE WHEN (SELECT count(*) FROM options) >= 2 AND (SELECT count(*) FROM ranked WHERE r = 1) = 1
              THEN (SELECT val FROM ranked WHERE r = 1) END;
$$;

REVOKE ALL ON FUNCTION public.get_popular_variant_option(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_popular_variant_option(uuid, text) TO anon, authenticated, service_role;