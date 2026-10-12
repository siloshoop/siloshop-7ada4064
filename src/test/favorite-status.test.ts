import { describe, it, expect, vi, beforeEach } from "vitest";

const calls: string[][] = [];
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          in: (_c: string, ids: string[]) => {
            calls.push(ids);
            return Promise.resolve({ data: ids.filter((id) => id === "p2").map((product_id) => ({ product_id })), error: null });
          },
        }),
      }),
    }),
  },
}));

import { isFavorited } from "@/lib/favoriteStatus";

describe("favorite status batching", () => {
  beforeEach(() => { calls.length = 0; });

  it("checks many cards in one request with correct answers", async () => {
    const r = await Promise.all(["p1", "p2", "p3"].map((id) => isFavorited("u1", id)));
    expect(r).toEqual([false, true, false]);
    expect(calls).toHaveLength(1);
  });

  it("does not reuse a finished answer", async () => {
    await isFavorited("u1", "p2");
    await isFavorited("u1", "p2");
    expect(calls).toHaveLength(2);
  });
});
