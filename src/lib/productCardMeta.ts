import { supabase } from "@/integrations/supabase/client";

export type ProductCardMeta = {
  stock_quantity: number | null;
  vendor_id?: string;
  is_featured?: boolean;
  is_trending?: boolean;
  reviews?: { rating: number }[];
};

type Waiter = (meta: ProductCardMeta | null) => void;
let pending = new Map<string, Waiter[]>();
let timer: ReturnType<typeof setTimeout> | null = null;

const flush = async () => {
  const batch = pending;
  pending = new Map();
  timer = null;
  const ids = [...batch.keys()];
  const found = new Map<string, ProductCardMeta>();
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const { data } = await supabase
      .from("products")
      .select("id, stock_quantity, vendor_id, is_featured, is_trending, reviews(rating)")
      .in("id", chunk);
    (data ?? []).forEach((row: any) => found.set(row.id, row));
  }
  batch.forEach((waiters, id) => waiters.forEach((w) => w(found.get(id) ?? null)));
};

/**
 * Fetches fresh saved stock + review/merchandising metadata for a product card.
 * Calls made in the same tick are combined into one request, so a listing of
 * 30 cards issues one query instead of 30 (same data, same freshness).
 */
export const loadProductCardMeta = (id: string) =>
  new Promise<ProductCardMeta | null>((resolve) => {
    const list = pending.get(id) ?? [];
    list.push(resolve);
    pending.set(id, list);
    if (!timer) timer = setTimeout(flush, 16);
  });
