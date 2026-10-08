import { afterEach, describe, expect, it, vi } from "vitest";
import { loadProductCardMeta } from "@/lib/productCardMeta";

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ select: () => ({ in: mocks.query }) }) },
}));
afterEach(() => { vi.useRealTimers(); mocks.query.mockReset(); });

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
});