import { supabase } from "@/integrations/supabase/client";
import type { VariantRow } from "@/components/seller/ProductColorsSizesEditor";
import {
  AGE_ATTR,
  COLOR_ATTR,
  SIZE_ATTR,
  variantAttributes,
  type ProductOptionMode,
} from "@/lib/productOptions";

export { COLOR_ATTR, SIZE_ATTR, AGE_ATTR };

const MANAGED_KEYS = new Set([COLOR_ATTR, SIZE_ATTR, AGE_ATTR]);

/** Identity of a managed variant: color plus whichever option (size or age) it carries. */
const keyOf = (a: Record<string, any>) => {
  const color = a?.[COLOR_ATTR] ?? "";
  if (a?.[SIZE_ATTR]) return `${color}__${SIZE_ATTR}:${a[SIZE_ATTR]}`;
  if (a?.[AGE_ATTR]) return `${color}__${AGE_ATTR}:${a[AGE_ATTR]}`;
  return `${color}__`;
};

/**
 * Syncs the color × (size | age) grid into product_variants.
 * Only variants whose attributes are color/size/age are touched — variants created
 * through the advanced attributes manager stay untouched.
 */
export const syncColorSizeVariants = async (
  productId: string,
  rows: VariantRow[],
  mode: ProductOptionMode = "size"
) => {
  const { data: existing, error } = await supabase
    .from("product_variants")
    .select("id, attributes")
    .eq("product_id", productId);
  if (error) throw error;

  const managed = (existing ?? []).filter((v: any) => {
    const keys = Object.keys((v.attributes as Record<string, string>) || {});
    return keys.length > 0 && keys.every((k) => MANAGED_KEYS.has(k));
  });
  const byKey = new Map(managed.map((v: any) => [keyOf(v.attributes || {}), v.id as string]));

  const wanted = rows
    .map((r) => ({ row: r, attributes: variantAttributes(r, mode) }))
    .filter((w) => Object.keys(w.attributes).length > 0);
  const seen = new Set(wanted.map((w) => keyOf(w.attributes)));

  // Remove options no longer offered first, so a product never keeps sizes and ages side by side.
  const stale = managed.filter((v: any) => !seen.has(keyOf(v.attributes || {}))).map((v: any) => v.id);
  if (stale.length > 0) {
    const { error: dErr } = await supabase.from("product_variants").delete().in("id", stale);
    if (dErr) throw dErr;
  }

  for (let i = 0; i < wanted.length; i++) {
    const { row, attributes } = wanted[i];
    const payload = {
      product_id: productId,
      attributes,
      stock_quantity: Math.max(0, parseInt(row.stock_quantity, 10) || 0),
      price: row.price.trim() ? Math.max(0, Number(row.price)) : null,
      sort_order: i,
      is_active: true,
    };
    const id = byKey.get(keyOf(attributes));
    const q = id
      ? supabase.from("product_variants").update(payload).eq("id", id)
      : supabase.from("product_variants").insert(payload);
    const { error: wErr } = await q;
    if (wErr) throw wErr;
  }
};
