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