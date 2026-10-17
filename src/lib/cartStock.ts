import { supabase } from "@/integrations/supabase/client";
import { OUT_OF_STOCK_LABEL } from "@/lib/stockAvailability";

export const validateCartQuantity = (quantity: number, stock: number) => {
  if (!Number.isSafeInteger(quantity) || quantity < 1) throw new Error("الكمية غير صالحة");
  if (!Number.isSafeInteger(stock) || stock <= 0) throw new Error(OUT_OF_STOCK_LABEL);
  if (quantity > stock) throw new Error(`الكمية المتاحة فقط: ${stock}`);
};

/** Read saved stock immediately before a cart mutation; database guards remain authoritative. */
export const readCartStock = async (productId: string, variantId?: string | null) => {
  if (variantId) {
    const { data, error } = await supabase.from("product_variants")
      .select("product_id, stock_quantity, is_active").eq("id", variantId).maybeSingle();
    if (error) throw error;
    return data?.product_id === productId && data.is_active ? data.stock_quantity : 0;
  }
  const { data, error } = await supabase.from("products")
    .select("stock_quantity").eq("id", productId).maybeSingle();
  if (error) throw error;
  return data?.stock_quantity ?? 0;
};

/** Hide unavailable rows only after confirming their user-owned saved deletion. */
export const removeUnavailableCartRows = async <T extends {
  id: string;
  product: { stock_quantity: number } | null;
}>(userId: string, rows: T[]) => {
  const ids = rows.filter(row => row.product && row.product.stock_quantity <= 0).map(row => row.id);
  if (!ids.length) return { rows, removedCount: 0, error: null };
  const { data, error } = await supabase.from("cart_items")
    .delete().eq("user_id", userId).in("id", ids).select("id");
  if (error) return { rows, removedCount: 0, error };
  const removed = new Set((data ?? []).map(row => row.id));
  return { rows: rows.filter(row => !removed.has(row.id)), removedCount: removed.size, error: null };
};