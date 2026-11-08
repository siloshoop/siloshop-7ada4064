import { describe, it, expect, vi, beforeEach } from "vitest";

let reads = 0;
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => {
          reads += 1;
          return Promise.resolve({ data: [{ product_id: "p1" }, { product_id: "p2" }], error: null });
        },
      }),
    }),
  },
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: null, loading: false }) }));

import { loadAccountCompareList } from "@/hooks/useCompareProducts";

describe("comparison list reads", () => {
  beforeEach(() => { reads = 0; localStorage.clear(); });

  it("20 product cards loading together send one read and all get the saved list", async () => {
    const lists = await Promise.all(Array.from({ length: 20 }, () => loadAccountCompareList("u1")));
    expect(reads).toBe(1);
    lists.forEach((list) => expect(list).toEqual(["p1", "p2"]));
  });

  it("does not reuse a finished read", async () => {
    await loadAccountCompareList("u1");
    await loadAccountCompareList("u1");
    expect(reads).toBe(2);
  });
});
