import { supabase } from "@/integrations/supabase/client";

/**
 * Active "عروض اليوم" deal percentages per product. Mirrors
 * public.effective_unit_price, which create_order uses to charge the real price.
 */
export const fetchActiveDeals = async (productIds: string[]): Promise<Record<string, number>> => {
  const ids = Array.from(new Set(productIds.filter(Boolean)));
  if (ids.length === 0) return {};
  const nowIso = new Date().toISOString();
  const { data } = await supabase
    .from("daily_deals")
    .select("product_id, discount_percentage")
    .in("product_id", ids)
    .eq("is_active", true)
    .lte("start_date", nowIso)
    .gt("end_date", nowIso);
  const map: Record<string, number> = {};
  for (const d of data ?? []) {
    map[d.product_id] = Math.max(map[d.product_id] ?? 0, Number(d.discount_percentage) || 0);
  }
  return map;
};

export const applyDeal = (price: number, pct: number | undefined) =>
  pct ? Math.round(Number(price) * (1 - pct / 100) * 100) / 100 : Number(price);

/** Highest quantity tier reached for a line, as a percentage. */
export const fetchQuantityTiers = async (productIds: string[]) => {
  const ids = Array.from(new Set(productIds.filter(Boolean)));
  if (ids.length === 0) return {} as Record<string, { min_quantity: number; discount_percentage: number }[]>;
  const { data } = await supabase
    .from("quantity_discounts")
    .select("product_id, min_quantity, discount_percentage")
    .in("product_id", ids);
  const map: Record<string, { min_quantity: number; discount_percentage: number }[]> = {};
  for (const t of data ?? []) {
    if (!t.product_id) continue;
    (map[t.product_id] ||= []).push({ min_quantity: t.min_quantity, discount_percentage: Number(t.discount_percentage) });
  }
  return map;
};

export const tierPercent = (
  tiers: { min_quantity: number; discount_percentage: number }[] | undefined,
  qty: number,
) =>
  (tiers ?? [])
    .filter((t) => t.min_quantity <= qty)
    .sort((a, b) => b.min_quantity - a.min_quantity)[0]?.discount_percentage ?? 0;
