import { describe, it, expect } from "vitest";
import {
  AGE_ATTR,
  SIZE_ATTR,
  cleanSizeChart,
  inferOptionMode,
  productOptionColumns,
  variantAttributes,
} from "@/lib/productOptions";

const chart = {
  columns: ["الطول", "العرض"],
  rows: [
    { size: "M", values: { "الطول": "70", "العرض": "52" } },
    { size: "L", values: { "الطول": "72", "العرض": "" } },
  ],
};

describe("product size or age option", () => {
  it("age products save ages only — sizes and measurements are cleared", () => {
    const cols = productOptionColumns({ mode: "age", colors: [], sizes: ["M"], ages: ["0–3 أشهر"], sizeChart: chart });
    expect(cols.age_ranges).toEqual(["0–3 أشهر"]);
    expect(cols.sizes).toEqual([]);
    expect(cols.size_chart).toBeNull();
  });

  it("size products save sizes and measurements only — ages are cleared", () => {
    const cols = productOptionColumns({ mode: "size", colors: [], sizes: ["M", "L"], ages: ["3–5 سنوات"], sizeChart: chart });
    expect(cols.sizes).toEqual(["M", "L"]);
    expect(cols.age_ranges).toEqual([]);
    expect(cols.size_chart?.rows.find((r) => r.size === "M")?.values).toEqual({ "الطول": "70", "العرض": "52" });
  });

  it("products with neither option save no sizes and no ages", () => {
    const cols = productOptionColumns({ mode: "none", colors: ["أحمر"], sizes: ["M"], ages: ["1–2 سنة"], sizeChart: chart });
    expect(cols.sizes).toEqual([]);
    expect(cols.age_ranges).toEqual([]);
    expect(cols.size_chart).toBeNull();
    expect(cols.colors).toEqual(["أحمر"]);
  });

  it("drops measurements of sizes no longer offered", () => {
    expect(cleanSizeChart(chart, ["L"])?.rows).toEqual([{ size: "L", values: { "الطول": "72" } }]);
    expect(cleanSizeChart(chart, ["XL"])).toBeNull();
  });

  it("size-and-age products save sizes, measurements and ages together", () => {
    const cols = productOptionColumns({ mode: "both", colors: [], sizes: ["M"], ages: ["3–5 سنوات"], sizeChart: chart });
    expect(cols.sizes).toEqual(["M"]);
    expect(cols.age_ranges).toEqual(["3–5 سنوات"]);
    expect(cols.size_chart?.rows).toEqual([{ size: "M", values: { "الطول": "70", "العرض": "52" } }]);
  });

  it("size-and-age variants carry both choices for the buyer", () => {
    expect(variantAttributes({ color: "أحمر", size: "M", age: "3–5 سنوات" }, "both")).toEqual({
      "اللون": "أحمر",
      [SIZE_ATTR]: "M",
      [AGE_ATTR]: "3–5 سنوات",
    });
    expect(variantAttributes({ color: "", size: "M", age: "3–5 سنوات" }, "size")).toEqual({ [SIZE_ATTR]: "M" });
  });

  it("buyer options follow the chosen mode", () => {
    expect(variantAttributes({ color: "أزرق", size: "", age: "3–6 أشهر" }, "age")).toEqual({ "اللون": "أزرق", [AGE_ATTR]: "3–6 أشهر" });
    expect(variantAttributes({ color: "", size: "M" }, "size")).toEqual({ [SIZE_ATTR]: "M" });
    expect(variantAttributes({ color: "أزرق", size: "M" }, "none")).toEqual({ "اللون": "أزرق" });
  });

  it("reopens saved products in the right mode", () => {
    expect(inferOptionMode(["M"], [])).toBe("size");
    expect(inferOptionMode([], ["0–3 أشهر"])).toBe("age");
    expect(inferOptionMode(["M"], ["0–3 أشهر"])).toBe("both");
    expect(inferOptionMode(null, null)).toBe("none");
  });
});
