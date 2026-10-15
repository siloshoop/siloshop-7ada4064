import { describe, it, expect } from "vitest";
import { isKnownCurrency, CURRENCY_OPTIONS, formatPrice, MISSING_CURRENCY_LABEL } from "@/lib/currency";

describe("only USD and SYP are supported", () => {
  it("currency selector options are exactly SYP and USD", () => {
    expect(CURRENCY_OPTIONS.map((o) => o.value)).toEqual(["SYP", "USD"]);
  });
  it("accepts USD and SYP", () => {
    expect(isKnownCurrency("USD")).toBe(true);
    expect(isKnownCurrency("SYP")).toBe(true);
  });
  it.each(["EUR", "TRY", "GBP", "", null])("rejects %s", (c) => {
    expect(isKnownCurrency(c as string | null)).toBe(false);
  });
  it("never relabels an unsupported currency as SYP or USD", () => {
    expect(formatPrice(10, "EUR")).toBe(`10 (${MISSING_CURRENCY_LABEL})`);
  });
});
