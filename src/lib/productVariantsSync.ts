import { supabase } from "@/integrations/supabase/client";
import type { VariantRow } from "@/components/seller/ProductColorsSizesEditor";

export const COLOR_ATTR = "اللون";
export const SIZE_ATTR = "المقاس";

const attrsOf = (row: VariantRow) => {
  const a: Record<string, string> = {};
  if (row.color) a[COLOR_ATTR] = row.color;
  if (row.size) a[SIZE_ATTR] = row.size;
  return a;
};

const keyOf = (a: Record<string, any>) => `${a?.[COLOR_ATTR] ?? ""}__${a?.[SIZE_ATTR] ?? ""}`;

/**
 * Syncs the color/size grid into product_variants.
 * Only variants whose attributes are color/size are touched — variants created
 * through the advanced attributes manager stay untouched.
 */
export const syncColorSizeVariants = async (productId: string, rows: VariantRow[]) => {
  const { data: existing, error } = await supabase
    .from("product_variants")
    .select("id, attributes")
    .eq("product_id", productId);
  if (error) throw error;

  const managed = (existing ?? []).filter((v: any) => {
    const keys = Object.keys((v.attributes as Record<string, string>) || {});
    return keys.length > 0 && keys.every((k) => k === COLOR_ATTR || k === SIZE_ATTR);
  });
  const byKey = new Map(managed.map((v: any) => [keyOf(v.attributes || {}), v.id as string]));

  const wanted = rows.filter((r) => r.color || r.size);
  const seen = new Set<string>();

  for (let i = 0; i < wanted.length; i++) {
    const row = wanted[i];
    const k = `${row.color}__${row.size}`;
    seen.add(k);
    const payload = {
      product_id: productId,
      attributes: attrsOf(row),
      stock_quantity: Math.max(0, parseInt(row.stock_quantity, 10) || 0),
      price: row.price.trim() ? Math.max(0, Number(row.price)) : null,
      sort_order: i,
      is_active: true,
    };
    const id = byKey.get(k);
    const q = id
      ? supabase.from("product_variants").update(payload).eq("id", id)
      : supabase.from("product_variants").insert(payload);
    const { error: wErr } = await q;
    if (wErr) throw wErr;
  }

  const stale = managed.filter((v: any) => !seen.has(keyOf(v.attributes || {}))).map((v: any) => v.id);
  if (stale.length > 0) {
    const { error: dErr } = await supabase.from("product_variants").delete().in("id", stale);
    if (dErr) throw dErr;
  }
};
