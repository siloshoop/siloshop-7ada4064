import { describe, expect, it } from "vitest";
import { formatPrice, formatKnownPrice, formatAmountsByCurrency, sumByCurrency, currencySymbol, totalsByCurrency } from "@/lib/currency";
import { buildProductsCsv } from "@/lib/productCsv";

describe("saved currency amounts without conversion", () => {
  it("preserves a USD amount and its fraction", () => {
    expect(formatPrice(58.5, "USD")).toBe("$58.5");
    expect(currencySymbol("USD")).toBe("$");
  });
  it("preserves a Syrian-pound amount", () => {
    expect(formatPrice(58000.5, "SYP")).toBe("58,000.5 ل.س");
    expect(currencySymbol("SYP")).toBe("ل.س");
  });
  it("does not label missing report currency as Syrian pounds", () => {
    expect(formatKnownPrice(59, null)).toBe("59 (العملة غير متاحة)");
    expect(formatAmountsByCurrency([{ amount: 59, currency: null }])).toBe("59 (العملة غير متاحة)");
  });
  it("keeps mixed-currency totals independent", () => {
    const rows = [{ amount: 59, currency: "USD" }, { amount: 1000, currency: "SYP" }];
    const totals = sumByCurrency(rows);
    expect(totals.USD?.total).toBe(59);
    expect(totals.SYP?.total).toBe(1000);
    expect(formatAmountsByCurrency(rows)).toBe("1,000 ل.س · $59");
    expect(rows).toEqual([{ amount: 59, currency: "USD" }, { amount: 1000, currency: "SYP" }]);
  });
  it("keeps coupon savings in the order currency without changing other amounts", () => {
    const totals = totalsByCurrency([
      { currency: "USD", lineSubtotal: 59 }, { currency: "SYP", lineSubtotal: 1000 },
    ], { couponCurrency: "USD", couponDiscount: 5.9 });
    expect(totals.find((t) => t.currency === "USD")?.total).toBe(53.1);
    expect(totals.find((t) => t.currency === "SYP")?.total).toBe(1000);
  });
  it("exports original numeric prices with their currency codes", () => {
    const csv = buildProductsCsv([{ name: "Dollar product", price: 58.5, currency: "USD" }, { name: "Syrian product", price: 58000, currency: "SYP" }]);
    const lines = csv.replace(/^\uFEFF/, "").split("\r\n");
    const columns = lines[0].split(",");
    const priceIndex = columns.indexOf("price");
    const currencyIndex = columns.indexOf("currency");
    expect(lines[1].split(",")[priceIndex]).toBe("58.5");
    expect(lines[1].split(",")[currencyIndex]).toBe("USD");
    expect(lines[2].split(",")[priceIndex]).toBe("58000");
    expect(lines[2].split(",")[currencyIndex]).toBe("SYP");
  });
});