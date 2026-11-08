/**
 * Seller-defined product features (title/value pairs) and product dimensions.
 * Limits mirror the database check (public.product_features_valid and the
 * length/width range constraints) so the form explains problems before saving.
 */
export interface ProductFeature {
  title: string;
  value: string;
}

export interface FeatureRow extends ProductFeature {
  id: string;
}

export const MAX_FEATURES = 30;
export const MAX_FEATURE_TITLE = 80;
export const MAX_FEATURE_VALUE = 300;
export const MAX_DIMENSION_CM = 100000;

let rowSeq = 0;
export const newFeatureRow = (title = "", value = ""): FeatureRow => ({
  id: `f${Date.now().toString(36)}${(rowSeq++).toString(36)}`,
  title,
  value,
});

/** Reads saved features tolerantly (unknown shapes are ignored, never thrown). */
export function parseFeatures(raw: unknown): ProductFeature[] {
  if (!Array.isArray(raw)) return [];
  const out: ProductFeature[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const title = typeof (item as any).title === "string" ? (item as any).title.trim() : "";
    const value = typeof (item as any).value === "string" ? (item as any).value.trim() : "";
    if (title && value) out.push({ title, value });
  }
  return out;
}

export const toFeatureRows = (raw: unknown): FeatureRow[] =>
  parseFeatures(raw).map((f) => newFeatureRow(f.title, f.value));

// Plain result objects (not unions): the project compiles without strict narrowing.
export interface FeaturesResult {
  ok: boolean;
  features: ProductFeature[];
  error: string | null;
}

/** Trims rows, drops fully empty ones and rejects half-filled or oversized entries. */
export function normalizeFeatureRows(rows: ProductFeature[]): FeaturesResult {
  const features: ProductFeature[] = [];
  for (const row of rows) {
    const title = (row.title ?? "").trim();
    const value = (row.value ?? "").trim();
    if (!title && !value) continue;
    if (!title || !value) {
      return { ok: false, features: [], error: "أكمل عنوان وقيمة كل ميزة أو احذفها" };
    }
    if (title.length > MAX_FEATURE_TITLE) {
      return { ok: false, features: [], error: `عنوان الميزة يجب ألا يتجاوز ${MAX_FEATURE_TITLE} حرفاً` };
    }
    if (value.length > MAX_FEATURE_VALUE) {
      return { ok: false, features: [], error: `قيمة الميزة يجب ألا تتجاوز ${MAX_FEATURE_VALUE} حرف` };
    }
    features.push({ title, value });
  }
  if (features.length > MAX_FEATURES) {
    return { ok: false, features: [], error: `يمكن إضافة ${MAX_FEATURES} ميزة كحد أقصى` };
  }
  return { ok: true, features, error: null };
}

export interface DimensionResult {
  ok: boolean;
  value: number | null;
  error: string | null;
}

/** Parses an optional length/width in cm: empty → null, otherwise a number > 0. */
export function parseDimension(text: string | number | null | undefined, label: string): DimensionResult {
  const raw = text === null || text === undefined ? "" : String(text).trim().replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace("٫", ".").replace(",", ".");
  if (!raw) return { ok: true, value: null, error: null };
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    return { ok: false, value: null, error: `${label} يجب أن يكون رقماً أكبر من صفر` };
  }
  if (n > MAX_DIMENSION_CM) {
    return { ok: false, value: null, error: `${label} يجب ألا يتجاوز ${MAX_DIMENSION_CM} سم` };
  }
  return { ok: true, value: Math.round(n * 100) / 100, error: null };
}

const DIM_NAMES = ["الطول", "العرض", "الارتفاع"] as const;

/** Builds the buyer-facing dimensions row, naming only the dimensions that are saved. */
export function formatDimensions(
  length: number | string | null | undefined,
  width: number | string | null | undefined,
  height?: number | string | null,
): { label: string; value: string } | null {
  const present = [length, width, height]
    .map((v, i) => ({ v: v === null || v === undefined || v === "" ? null : Number(v), name: DIM_NAMES[i] }))
    .filter((d) => d.v !== null && Number.isFinite(d.v) && (d.v as number) > 0);
  if (present.length === 0) return null;
  return {
    label: `الأبعاد (${present.map((d) => d.name).join(" × ")})`,
    value: `${present.map((d) => d.v).join(" × ")} سم`,
  };
}
