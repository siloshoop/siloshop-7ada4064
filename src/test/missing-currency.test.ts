import { describe, expect, it } from "vitest";
import { totalsByCurrency, currencySymbol, currencyName, formatPrice } from "@/lib/currency";
import { buildInvoiceBlocks } from "@/lib/invoiceTotals";

describe("missing currency is never treated as SYP", () => {
  it("cart/checkout/favorites totals exclude lines without a saved currency", () => {
    const t = totalsByCurrency([
      { currency: "SYP", lineSubtotal: 1000 }, { currency: null, lineSubtotal: 500 }, { currency: "USD", lineSubtotal: 20 },
    ]);
    expect(t.map((x) => [x.currency, x.total])).toEqual([["SYP", 1000], ["USD", 20]]);
  });
  it("labels show the missing-currency text, not SYP", () => {
    expect(currencySymbol(null)).toBe("العملة غير متاحة");
    expect(currencyName(undefined)).toBe("العملة غير متاحة");
    expect(formatPrice(70, "")).toBe("70 (العملة غير متاحة)");
  });
  it("invoice puts items without a currency in their own block, not SYP", () => {
    const blocks = buildInvoiceBlocks({ currency: null, total_amount: 0 }, [
      { currency: "SYP", quantity: 1, price: 1000 }, { currency: null, quantity: 1, price: 70 },
    ]);
    expect(blocks.map((b) => [b.currency, b.subtotal])).toEqual([["SYP", 1000], [null, 70]]);
  });
});
