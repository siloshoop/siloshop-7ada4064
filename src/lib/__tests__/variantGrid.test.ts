import { describe, it, expect } from "vitest";
import { buildVariantRows, variantKey, toLatinDigits } from "@/components/seller/ProductColorsSizesEditor";

describe("variant grid", () => {
  it("creates one row per color/size combination", () => {
    const rows = buildVariantRows(["ابيض", "احمر"], ["S", "M", "L"], []);
    expect(rows).toHaveLength(6);
    expect(new Set(rows.map((r) => variantKey(r.color, r.size))).size).toBe(6);
  });

  it("starts with empty quantity and price so typed values show up", () => {
    const rows = buildVariantRows(["ابيض"], ["S"], []);
    expect(rows[0].stock_quantity).toBe("");
    expect(rows[0].price).toBe("");
  });

  it("keeps each combination's own quantity and price when rebuilding", () => {
    const existing = [
      { color: "ابيض", size: "S", stock_quantity: "5", price: "1000" },
      { color: "احمر", size: "M", stock_quantity: "7", price: "1500" },
    ];
    const rows = buildVariantRows(["ابيض", "احمر"], ["S", "M"], existing);
    const byKey = Object.fromEntries(rows.map((r) => [variantKey(r.color, r.size), r]));
    expect(byKey["ابيض__S"]).toMatchObject({ stock_quantity: "5", price: "1000" });
    expect(byKey["احمر__M"]).toMatchObject({ stock_quantity: "7", price: "1500" });
    expect(byKey["ابيض__M"]).toMatchObject({ stock_quantity: "", price: "" });
  });

  it("normalizes arabic-indic digits", () => {
    expect(toLatinDigits("٢٥٠")).toBe("250");
  });
});
