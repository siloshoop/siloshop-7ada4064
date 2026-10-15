import { supabase } from "@/integrations/supabase/client";
import { dealHasStock, dealPercent } from "@/lib/dealPricing";

export type ProductCardMeta = {
  stock_quantity: number | null;
  vendor_id?: string;
  is_featured?: boolean;
  is_trending?: boolean;
  reviews?: { rating: number }[];
  /** Saved list price and active sale percentage (same rule as server pricing). */
  price?: number;
  /** Saved product currency — authoritative over listing payloads. */
  currency?: string | null;
  deal_pct?: number;
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
      .select("id, price, currency, stock_quantity, vendor_id, is_featured, is_trending, reviews(rating)")
      .in("id", chunk);
    (data ?? []).forEach((row: any) => found.set(row.id, row));
    const nowIso = new Date().toISOString();
    const { data: deals } = await supabase
      .from("daily_deals")
      .select("product_id, discount_percentage, sale_price, sale_quantity, sold_quantity")
      .in("product_id", chunk)
      .eq("is_active", true)
      .lte("start_date", nowIso)
      .gt("end_date", nowIso);
    for (const d of (deals ?? []) as any[]) {
      const row = found.get(d.product_id);
      if (!row || !dealHasStock(d)) continue;
      row.deal_pct = Math.max(row.deal_pct ?? 0, dealPercent(d, Number(row.price)));
    }
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
