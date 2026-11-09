/**
 * Product "second option": a product offers either sizes (with optional
 * per-size measurements) or suitable ages — never both. Colors stay independent.
 * Buyers pick the chosen option through product_variants attributes.
 */

export type ProductOptionMode = "none" | "size" | "age";

export const COLOR_ATTR = "اللون";
export const SIZE_ATTR = "المقاس";
export const AGE_ATTR = "العمر";

export const AGE_PRESETS = [
  "0–3 أشهر",
  "3–6 أشهر",
  "6–12 شهرًا",
  "1–2 سنة",
  "2–3 سنوات",
  "3–5 سنوات",
  "5–7 سنوات",
  "7–10 سنوات",
  "10–14 سنة",
];

export const DEFAULT_MEASUREMENTS = ["الطول", "العرض"];
export const MAX_MEASUREMENT_COLUMNS = 6;

export interface SizeChartRow {
  size: string;
  values: Record<string, string>;
}

export interface SizeChart {
  columns: string[];
  rows: SizeChartRow[];
}

export const emptySizeChart = (): SizeChart => ({ columns: [...DEFAULT_MEASUREMENTS], rows: [] });

/** Attribute name used by the variants for the chosen mode. */
export const optionAttr = (mode: ProductOptionMode) => (mode === "age" ? AGE_ATTR : SIZE_ATTR);

/** Size/age decided from saved data; ages win only when no sizes exist (they can never coexist). */
export const inferOptionMode = (sizes: unknown, ages: unknown): ProductOptionMode => {
  if (Array.isArray(sizes) && sizes.length > 0) return "size";
  if (Array.isArray(ages) && ages.length > 0) return "age";
  return "none";
};

/** Defensive read of the saved size chart. */
export const parseSizeChart = (raw: unknown): SizeChart | null => {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { columns?: unknown; rows?: unknown };
  const columns = Array.isArray(r.columns)
    ? r.columns.filter((c): c is string => typeof c === "string" && c.trim() !== "").map((c) => c.trim())
    : [];
  const rows = Array.isArray(r.rows)
    ? r.rows
        .filter((row: any) => row && typeof row.size === "string" && row.size.trim() !== "")
        .map((row: any) => {
          const values: Record<string, string> = {};
          if (row.values && typeof row.values === "object") {
            for (const c of columns) {
              const v = row.values[c];
              if (v !== undefined && v !== null && String(v).trim() !== "") values[c] = String(v).trim();
            }
          }
          return { size: row.size.trim(), values };
        })
    : [];
  if (columns.length === 0 || rows.length === 0) return null;
  return { columns, rows };
};

/**
 * Keeps only measurements for sizes still offered, drops empty values and
 * unused columns. Returns null when nothing was measured.
 */
export const cleanSizeChart = (chart: SizeChart | null | undefined, sizes: string[]): SizeChart | null => {
  if (!chart || sizes.length === 0) return null;
  const rows: SizeChartRow[] = [];
  for (const size of sizes) {
    const src = chart.rows.find((r) => r.size === size);
    const values: Record<string, string> = {};
    for (const c of chart.columns) {
      const v = src?.values?.[c]?.trim();
      if (v) values[c] = v;
    }
    if (Object.keys(values).length > 0) rows.push({ size, values });
  }
  const columns = chart.columns.filter((c) => rows.some((r) => r.values[c]));
  if (columns.length === 0 || rows.length === 0) return null;
  return { columns, rows };
};

/** Product columns to save: exactly one of sizes / age_ranges can be filled. */
export const productOptionColumns = (value: {
  mode: ProductOptionMode;
  colors: string[];
  sizes: string[];
  ages: string[];
  sizeChart: SizeChart | null;
}) => ({
  colors: value.colors,
  sizes: value.mode === "size" ? value.sizes : [],
  age_ranges: value.mode === "age" ? value.ages : [],
  size_chart: value.mode === "size" ? cleanSizeChart(value.sizeChart, value.sizes) : null,
});

/** Variant attributes for a color/option row under the chosen mode. */
export const variantAttributes = (row: { color: string; size: string }, mode: ProductOptionMode) => {
  const a: Record<string, string> = {};
  if (row.color) a[COLOR_ATTR] = row.color;
  if (row.size && mode !== "none") a[optionAttr(mode)] = row.size;
  return a;
};

/** Buyer prompt listing the options they still have to choose, e.g. «اللون والعمر». */
export const choicePrompt = (keys: string[]) => {
  if (keys.length === 0) return "يرجى اختيار الخيارات لعرض السعر والكمية المتوفرة";
  return `يرجى اختيار ${keys.join(" و")} لعرض السعر والكمية المتوفرة`;
};
