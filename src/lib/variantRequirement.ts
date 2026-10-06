import { supabase } from "@/integrations/supabase/client";

/** True when the product has active color/size options the shopper must pick. */
export async function productRequiresOptions(productId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from("product_variants")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId)
    .eq("is_active", true);
  if (error) return false;
  return (count ?? 0) > 0;
}

/** "اللون: أحمر / المقاس: L" — keeps option names visible in cart and checkout. */
export function formatVariantLabel(attrs: Record<string, string> | null | undefined): string {
  return Object.entries(attrs || {})
    .filter(([, v]) => Boolean(v))
    .map(([k, v]) => `${k}: ${v}`)
    .join(" / ");
}
