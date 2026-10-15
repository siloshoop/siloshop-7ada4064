import { describe, expect, it } from "vitest";
import { applyDeal, dealHasStock, dealPercent } from "@/lib/dealPricing";
import { couponErrorFromMessage, couponErrorMessage } from "@/lib/couponQuote";

describe("product sale pricing", () => {
  it("a sale price overrides the percentage and shows exactly", () => {
    const pct = dealPercent({ discount_percentage: 10, sale_price: 292000 }, 365000);
    expect(applyDeal(365000, pct)).toBe(292000);
  });
  it("percentage deals keep working when no sale price is set", () => {
    expect(applyDeal(50, dealPercent({ discount_percentage: 20 }, 50))).toBe(40);
  });
  it("a sale ends when its sale quantity is sold out", () => {
    expect(dealHasStock({ discount_percentage: 10, sale_quantity: 2, sold_quantity: 2 })).toBe(false);
    expect(dealHasStock({ discount_percentage: 10, sale_quantity: 2, sold_quantity: 1 })).toBe(true);
    expect(dealHasStock({ discount_percentage: 10, sale_quantity: null })).toBe(true);
  });
});

describe("coupon checkout errors", () => {
  it("reads the reason saved by order confirmation", () => {
    expect(couponErrorFromMessage("Invalid or expired coupon: UNITS_EXHAUSTED")).toBe("UNITS_EXHAUSTED");
    expect(couponErrorFromMessage("OUT_OF_STOCK:x")).toBeNull();
  });
  it("explains per-customer and sale-combining limits", () => {
    expect(couponErrorMessage("CUSTOMER_LIMIT")).toContain("الحد الأقصى");
    expect(couponErrorMessage("SALE_NOT_COMBINABLE")).toContain("لا يُجمع");
    expect(couponErrorMessage("MIXED_CURRENCY")).toContain("عملات مختلفة");
  });
});
