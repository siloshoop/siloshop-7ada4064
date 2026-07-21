/**
 * Pure helpers that mirror the invariants enforced by the `create_order`
 * Postgres function. These live client-side so we can unit-test the
 * expected favorites-sync behavior without hitting the database.
 *
 * Rules mirrored from the SQL:
 *   - Favorites are only touched when the order is created successfully
 *     (i.e. create_order returns an order id).
 *   - Cancellation / failure paths NEVER touch favorites.
 *   - Only products whose ids appear in the purchased items are removed,
 *     regardless of quantity or duplicates in the payload.
 *   - Only favorites belonging to the purchasing user are affected.
 */

export type OrderItemInput = { product_id: string; quantity: number };
export type FavoriteRow = { user_id: string; product_id: string };

export type OrderOutcome = "created" | "cancelled" | "failed";

export function purchasedProductIds(items: OrderItemInput[]): string[] {
  return Array.from(
    new Set(items.filter((i) => i.quantity > 0).map((i) => i.product_id))
  );
}

export function favoritesAfterOrder(
  favorites: FavoriteRow[],
  buyerId: string,
  items: OrderItemInput[],
  outcome: OrderOutcome
): FavoriteRow[] {
  if (outcome !== "created") return favorites;
  const removed = new Set(purchasedProductIds(items));
  return favorites.filter(
    (f) => !(f.user_id === buyerId && removed.has(f.product_id))
  );
}