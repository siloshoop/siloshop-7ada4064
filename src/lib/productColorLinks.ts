import { supabase } from "@/integrations/supabase/client";

export interface ColorAlternative {
  id: string;
  name: string;
  image_url: string | null;
  colors: string[] | null;
  stock_quantity: number | null;
}

/** Name shown for a linked color product: its single color, otherwise its name. */
export const colorAlternativeLabel = (p: Pick<ColorAlternative, "name" | "colors">) =>
  p.colors && p.colors.length === 1 && p.colors[0] ? p.colors[0] : p.name;

/** Ids of the other products linked to this one as color alternatives (manager view). */
export const loadColorLinkIds = async (productId: string): Promise<string[]> => {
  const { data: self } = await supabase.from("products").select("color_group_id").eq("id", productId).maybeSingle();
  const group = (self as { color_group_id: string | null } | null)?.color_group_id;
  if (!group) return [];
  const { data } = await supabase.from("products").select("id").eq("color_group_id", group);
  return ((data as { id: string }[] | null) ?? []).map((r) => r.id).filter((id) => id !== productId);
};

const LINK_ERRORS: Record<string, string> = {
  COLOR_LINKS_TOO_MANY: "يمكن ربط 20 لونًا كحد أقصى",
  COLOR_LINK_INVALID: "يمكن ربط منتجاتك أنت فقط من نفس النوع",
  COLOR_GROUP_MISMATCH: "يمكن ربط منتجاتك أنت فقط من نفس النوع",
  not_authorized: "غير مصرح لك بتعديل هذا المنتج",
};

/** Saves the full list of linked color products; returns an Arabic error or null. */
export const saveColorLinks = async (productId: string, linkedIds: string[]): Promise<string | null> => {
  const { error } = await supabase.rpc("set_product_color_links", { _product_id: productId, _linked_ids: linkedIds });
  if (!error) return null;
  const key = Object.keys(LINK_ERRORS).find((k) => error.message.includes(k));
  return key ? LINK_ERRORS[key] : "تعذّر حفظ ربط الألوان";
};
