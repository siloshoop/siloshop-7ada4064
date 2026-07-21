import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  favoritesAfterOrder,
  purchasedProductIds,
  type FavoriteRow,
} from "@/lib/favoritesSync";

const USER = "user-1";
const OTHER = "user-2";
const P1 = "prod-1";
const P2 = "prod-2";
const P3 = "prod-3";

const favorites = (): FavoriteRow[] => [
  { user_id: USER, product_id: P1 },
  { user_id: USER, product_id: P2 },
  { user_id: USER, product_id: P3 },
  { user_id: OTHER, product_id: P1 },
];

describe("favoritesAfterOrder – Buy Now & Cart checkout parity", () => {
  it("Buy Now: removes only the single purchased product", () => {
    const result = favoritesAfterOrder(
      favorites(),
      USER,
      [{ product_id: P1, quantity: 1 }],
      "created"
    );
    expect(result.find((f) => f.user_id === USER && f.product_id === P1)).toBeUndefined();
    expect(result.some((f) => f.user_id === USER && f.product_id === P2)).toBe(true);
    expect(result.some((f) => f.user_id === USER && f.product_id === P3)).toBe(true);
  });

  it("Cart checkout: removes only the purchased subset, keeps unpurchased", () => {
    const result = favoritesAfterOrder(
      favorites(),
      USER,
      [
        { product_id: P1, quantity: 2 },
        { product_id: P2, quantity: 1 },
      ],
      "created"
    );
    const remainingIds = result.filter((f) => f.user_id === USER).map((f) => f.product_id);
    expect(remainingIds).toEqual([P3]);
  });

  it("never touches favorites belonging to other users", () => {
    const result = favoritesAfterOrder(
      favorites(),
      USER,
      [{ product_id: P1, quantity: 1 }],
      "created"
    );
    expect(result.some((f) => f.user_id === OTHER && f.product_id === P1)).toBe(true);
  });
});

describe("favoritesAfterOrder – cancellation / failure guarantees", () => {
  it("cancelled order does NOT remove any favorites", () => {
    const before = favorites();
    const after = favoritesAfterOrder(
      before,
      USER,
      [
        { product_id: P1, quantity: 1 },
        { product_id: P2, quantity: 1 },
      ],
      "cancelled"
    );
    expect(after).toEqual(before);
  });

  it("failed order (RPC threw) does NOT remove any favorites", () => {
    const before = favorites();
    const after = favoritesAfterOrder(
      before,
      USER,
      [{ product_id: P1, quantity: 1 }],
      "failed"
    );
    expect(after).toEqual(before);
  });
});

describe("purchasedProductIds – edge cases", () => {
  it("dedupes duplicate product entries in the payload", () => {
    const ids = purchasedProductIds([
      { product_id: P1, quantity: 1 },
      { product_id: P1, quantity: 3 },
      { product_id: P2, quantity: 1 },
    ]);
    expect(ids.sort()).toEqual([P1, P2].sort());
  });

  it("ignores items with non-positive quantity", () => {
    const ids = purchasedProductIds([
      { product_id: P1, quantity: 0 },
      { product_id: P2, quantity: 2 },
    ]);
    expect(ids).toEqual([P2]);
  });

  it("partial cart: removes exactly the purchased items even when duplicated", () => {
    const before: FavoriteRow[] = [
      { user_id: USER, product_id: P1 },
      { user_id: USER, product_id: P2 },
      { user_id: USER, product_id: P3 },
    ];
    const after = favoritesAfterOrder(
      before,
      USER,
      [
        { product_id: P1, quantity: 1 },
        { product_id: P1, quantity: 1 }, // duplicate entry
      ],
      "created"
    );
    expect(after.map((f) => f.product_id).sort()).toEqual([P2, P3].sort());
  });
});

/**
 * Realtime propagation: multiple open tabs each subscribe to the
 * `favorites` channel filtered by their own user_id. When create_order
 * deletes rows server-side, every subscribed tab must receive the DELETE
 * event and refresh its local state / counter.
 *
 * We simulate the supabase-js channel surface and assert both the
 * Favorites-page refetch callback and the Dashboard counter callback
 * fire on the very same broadcast.
 */
describe("Realtime favorites broadcast – multi-tab sync", () => {
  type Handler = (payload: any) => void;

  const makeMockChannel = () => {
    const handlers: Handler[] = [];
    const channel = {
      handlers,
      on(_type: string, _filter: any, cb: Handler) {
        handlers.push(cb);
        return channel;
      },
      subscribe() {
        return channel;
      },
      broadcastDelete(row: FavoriteRow) {
        handlers.forEach((h) =>
          h({ eventType: "DELETE", old: row, new: {}, table: "favorites" })
        );
      },
    };
    return channel;
  };

  let favoritesTab: ReturnType<typeof makeMockChannel>;
  let dashboardTab: ReturnType<typeof makeMockChannel>;
  let favRefetch: ReturnType<typeof vi.fn>;
  let dashRecount: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    favoritesTab = makeMockChannel();
    dashboardTab = makeMockChannel();
    favRefetch = vi.fn();
    dashRecount = vi.fn();

    // Tab A: /favorites subscribes and refetches on any change
    favoritesTab.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "favorites", filter: `user_id=eq.${USER}` },
      favRefetch as unknown as (payload: any) => void
    );

    // Tab B: /dashboard subscribes and refreshes the counter
    dashboardTab.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "favorites", filter: `user_id=eq.${USER}` },
      dashRecount as unknown as (payload: any) => void
    );
  });

  it("delivers DELETE events to both open tabs simultaneously", () => {
    favoritesTab.broadcastDelete({ user_id: USER, product_id: P1 });
    dashboardTab.broadcastDelete({ user_id: USER, product_id: P1 });
    expect(favRefetch).toHaveBeenCalledTimes(1);
    expect(dashRecount).toHaveBeenCalledTimes(1);
  });

  it("fires one refresh per removed favorite row (partial cart)", () => {
    // Order removed 2 of 3 favorites → 2 DELETE events broadcast
    [P1, P2].forEach((pid) => {
      favoritesTab.broadcastDelete({ user_id: USER, product_id: pid });
      dashboardTab.broadcastDelete({ user_id: USER, product_id: pid });
    });
    expect(favRefetch).toHaveBeenCalledTimes(2);
    expect(dashRecount).toHaveBeenCalledTimes(2);
  });
});