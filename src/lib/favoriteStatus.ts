import { supabase } from "@/integrations/supabase/client";

// Coalesces favorite-status checks issued in the same tick (one per product
// card) into a single request per user. Nothing is cached after completion, so
// every mount and sync event still reads the saved state.
type Pending = { ids: Set<string>; promise: Promise<Set<string>> };
const pending = new Map<string, Pending>();

export function isFavorited(userId: string, productId: string): Promise<boolean> {
  let batch = pending.get(userId);
  if (!batch) {
    const ids = new Set<string>();
    const promise = Promise.resolve().then(async () => {
      pending.delete(userId);
      const list = [...ids];
      const found = new Set<string>();
      for (let i = 0; i < list.length; i += 200) {
        const { data, error } = await supabase
          .from("favorites")
          .select("product_id")
          .eq("user_id", userId)
          .in("product_id", list.slice(i, i + 200));
        if (error) throw error;
        data?.forEach((row) => found.add(row.product_id));
      }
      return found;
    });
    batch = { ids, promise };
    pending.set(userId, batch);
  }
  batch.ids.add(productId);
  return batch.promise.then((found) => found.has(productId));
}
