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
const inFlight = new Map<string, Promise<ProductCardMeta | null>>();

const flush = async () => {
  const batch = pending;
  pending = new Map();
  timer = null;
  const ids = [...batch.keys()];
  const found = new Map<string, ProductCardMeta>();
  try {
    for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const { data } = await supabase
      .from("products")
      .select("id, stock_quantity, vendor_id, is_featured, is_trending, reviews(rating)")
      .in("id", chunk);
    (data ?? []).forEach((row: any) => found.set(row.id, row));
    }
  } catch {
    // A failed metadata request must settle callers, not leave cards waiting.
  } finally {
    batch.forEach((waiters, id) => {
      inFlight.delete(id);
      waiters.forEach((w) => w(found.get(id) ?? null));
    });
  }
};

/**
 * Fetches fresh saved stock + review/merchandising metadata for a product card.
 * Calls made in the same tick are combined into one request, so a listing of
 * 30 cards issues one query instead of 30 (same data, same freshness).
 */
export const loadProductCardMeta = (id: string) => {
  const existing = inFlight.get(id);
  if (existing) return existing;
  const request = new Promise<ProductCardMeta | null>((resolve) => {
    const list = pending.get(id) ?? [];
    list.push(resolve);
    pending.set(id, list);
    if (!timer) timer = setTimeout(flush, 16);
  });
  inFlight.set(id, request);
  return request;
};
