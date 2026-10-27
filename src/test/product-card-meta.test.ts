import { afterEach, describe, expect, it, vi } from "vitest";
import { loadProductCardMeta } from "@/lib/productCardMeta";

const mocks = vi.hoisted(() => ({ query: vi.fn(), deals: [] as unknown[] }));
vi.mock("@/integrations/supabase/client", () => {
  const dealChain: any = { eq: () => dealChain, lte: () => dealChain, gt: () => Promise.resolve({ data: mocks.deals }) };
  return {
    supabase: {
      from: (table: string) => ({
        select: () => ({ in: table === "products" ? mocks.query : () => dealChain }),
      }),
    },
  };
});
afterEach(() => { vi.useRealTimers(); mocks.query.mockReset(); mocks.deals = []; });

describe("product metadata request coalescing", () => {
  it("shares pending requests but refreshes again after completion", async () => {
    vi.useFakeTimers();
    let finish: (value: { data: unknown[] }) => void = () => {};
    mocks.query.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const first = loadProductCardMeta("one");
    await vi.advanceTimersByTimeAsync(16);
    expect(loadProductCardMeta("one")).toBe(first);
    finish({ data: [{ id: "one", stock_quantity: 5 }] });
    expect(await first).toMatchObject({ stock_quantity: 5 });
    mocks.query.mockResolvedValueOnce({ data: [{ id: "one", stock_quantity: 0 }] });
    const fresh = loadProductCardMeta("one");
    await vi.advanceTimersByTimeAsync(16);
    expect(await fresh).toMatchObject({ stock_quantity: 0 });
    expect(mocks.query).toHaveBeenCalledTimes(2);
  });

  it("settles a failed request and allows a retry", async () => {
    vi.useFakeTimers();
    mocks.query.mockRejectedValueOnce(new Error("network failure"));
    const failed = loadProductCardMeta("two");
    await vi.advanceTimersByTimeAsync(16);
    expect(await failed).toBeNull();
    mocks.query.mockResolvedValueOnce({ data: [{ id: "two", stock_quantity: 2 }] });
    const retry = loadProductCardMeta("two");
    await vi.advanceTimersByTimeAsync(16);
    expect(await retry).toMatchObject({ stock_quantity: 2 });
  });

  it("starts independent deal reads before the product response resolves", async () => {
    vi.useFakeTimers();
    let finish: (value: { data: unknown[] }) => void = () => {};
    mocks.query.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const dealRead = vi.spyOn(mocks, "deals", "get");
    const request = loadProductCardMeta("parallel");
    await vi.advanceTimersByTimeAsync(16);
    expect(dealRead).toHaveBeenCalled();
    finish({ data: [{ id: "parallel", stock_quantity: 4 }] });
    expect(await request).toMatchObject({ stock_quantity: 4 });
    dealRead.mockRestore();
  });

  it("attaches the active sale percentage from a sale price", async () => {
    vi.useFakeTimers();
    mocks.deals = [{ product_id: "s", discount_percentage: 10, sale_price: 75, sale_quantity: null, sold_quantity: 0 }];
    mocks.query.mockResolvedValueOnce({ data: [{ id: "s", price: 100, stock_quantity: 3 }] });
    const meta = loadProductCardMeta("s");
    await vi.advanceTimersByTimeAsync(16);
    expect(await meta).toMatchObject({ price: 100, deal_pct: 25 });
  });

  it("ignores a sale whose quantity is sold out", async () => {
    vi.useFakeTimers();
    mocks.deals = [{ product_id: "x", discount_percentage: 30, sale_price: null, sale_quantity: 5, sold_quantity: 5 }];
    mocks.query.mockResolvedValueOnce({ data: [{ id: "x", price: 100, stock_quantity: 3 }] });
    const meta = loadProductCardMeta("x");
    await vi.advanceTimersByTimeAsync(16);
    expect((await meta)?.deal_pct).toBeUndefined();
  });
});
