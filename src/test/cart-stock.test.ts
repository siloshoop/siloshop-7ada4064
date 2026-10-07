import { beforeEach, describe, expect, it, vi } from "vitest";
const { maybeSingle, from } = vi.hoisted(() => ({ maybeSingle: vi.fn(), from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from } }));
import { readCartStock, validateCartQuantity } from "@/lib/cartStock";

beforeEach(() => {
  vi.resetAllMocks();
  const chain = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle };
  from.mockReturnValue(chain);
});

describe("cart stock limits", () => {
  it("permits one remaining piece, rejects two and cumulative additions", () => {
    expect(() => validateCartQuantity(1, 1)).not.toThrow();
    expect(() => validateCartQuantity(2, 1)).toThrow("الكمية المتاحة فقط: 1");
    expect(() => validateCartQuantity(1 + 1, 1)).toThrow();
  });
  it.each([0, -1, NaN, Infinity, 1.5])("rejects invalid quantity %s", quantity => {
    expect(() => validateCartQuantity(quantity, 5)).toThrow();
  });
  it("blocks zero and unavailable stock", () => {
    expect(() => validateCartQuantity(1, 0)).toThrow("نفذت الكمية");
    expect(() => validateCartQuantity(1, NaN)).toThrow();
  });
  it("reads fresh simple-product stock", async () => {
    maybeSingle.mockResolvedValue({ data: { stock_quantity: 1 }, error: null });
    expect(await readCartStock("product")).toBe(1);
    expect(from).toHaveBeenCalledWith("products");
  });
  it("uses selected variant stock rather than aggregate stock", async () => {
    maybeSingle.mockResolvedValue({ data: { product_id: "product", stock_quantity: 1, is_active: true }, error: null });
    expect(await readCartStock("product", "variant")).toBe(1);
    expect(from).toHaveBeenCalledWith("product_variants");
  });
  it.each([
    null,
    { product_id: "other", stock_quantity: 8, is_active: true },
    { product_id: "product", stock_quantity: 8, is_active: false },
  ])("fails closed for inaccessible, mismatched or inactive variants", async data => {
    maybeSingle.mockResolvedValue({ data, error: null });
    expect(await readCartStock("product", "variant")).toBe(0);
  });
  it("does not write on failed stock reads", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: new Error("offline") });
    await expect(readCartStock("product")).rejects.toThrow("offline");
  });
});