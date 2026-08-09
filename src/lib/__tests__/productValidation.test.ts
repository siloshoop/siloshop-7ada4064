import { describe, it, expect } from "vitest";
import { productNumbersSchema, friendlyDbError } from "@/lib/productValidation";

describe("product validation", () => {
  it("accepts large SYP prices", () => {
    const r = productNumbersSchema.safeParse({ name: "منتج", price: "150000000", stock_quantity: "5" });
    expect(r.success).toBe(true);
  });
  it("rejects absurd prices with arabic message", () => {
    const r = productNumbersSchema.safeParse({ name: "منتج", price: "9".repeat(20), stock_quantity: "5" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toContain("كبير جداً");
  });
  it("rejects non-integer stock", () => {
    const r = productNumbersSchema.safeParse({ name: "منتج", price: "10", stock_quantity: "1.5" });
    expect(r.success).toBe(false);
  });
  it("keeps sku as text", () => {
    const r = productNumbersSchema.safeParse({ name: "منتج", price: "10", stock_quantity: "1", sku: 12345 });
    expect(r.success && r.data.sku).toBe("12345");
  });
  it("maps overflow db error", () => {
    expect(friendlyDbError({ code: "22003", message: "numeric field overflow" })).toContain("كبير جداً");
  });
});
