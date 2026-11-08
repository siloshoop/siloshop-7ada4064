// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { Blob as NodeBlob } from "node:buffer";
import {
  formatDimensions,
  normalizeFeatureRows,
  parseDimension,
  parseFeatures,
} from "@/lib/productFeatures";

describe("product features entered by sellers", () => {
  it("keeps every titled feature in the seller's order, Arabic or English", () => {
    const r = normalizeFeatureRows([
      { title: " الخامة ", value: " قطن " },
      { title: "Origin", value: "Turkey" },
      { title: "", value: "" },
      { title: "محتويات العلبة", value: "قطعتان" },
    ]);
    expect(r.ok).toBe(true);
    expect(r.features).toEqual([
      { title: "الخامة", value: "قطن" },
      { title: "Origin", value: "Turkey" },
      { title: "محتويات العلبة", value: "قطعتان" },
    ]);
  });

  it("refuses a feature with a title but no value", () => {
    const r = normalizeFeatureRows([{ title: "النمط", value: "  " }]);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("أكمل عنوان وقيمة كل ميزة أو احذفها");
  });

  it("allows at most 30 features", () => {
    const rows = Array.from({ length: 31 }, (_, i) => ({ title: `t${i}`, value: "v" }));
    expect(normalizeFeatureRows(rows).ok).toBe(false);
    expect(normalizeFeatureRows(rows.slice(0, 30)).ok).toBe(true);
  });

  it("ignores malformed saved data when showing features", () => {
    expect(parseFeatures(null)).toEqual([]);
    expect(parseFeatures([{ title: "اللون", value: "وردي" }, { title: "x" }, 5])).toEqual([
      { title: "اللون", value: "وردي" },
    ]);
  });
});

describe("product length and width", () => {
  it("accepts empty (not set) or numbers above zero in cm", () => {
    expect(parseDimension("", "الطول")).toMatchObject({ ok: true, value: null });
    expect(parseDimension("220", "الطول")).toMatchObject({ ok: true, value: 220 });
    expect(parseDimension("٢٢٠", "الطول")).toMatchObject({ ok: true, value: 220 });
    expect(parseDimension("0", "العرض").ok).toBe(false);
    expect(parseDimension("-5", "العرض").ok).toBe(false);
    expect(parseDimension("abc", "العرض").ok).toBe(false);
  });

  it("shows only the saved dimensions to buyers", () => {
    expect(formatDimensions(220, 160, null)).toEqual({ label: "الأبعاد (الطول × العرض)", value: "220 × 160 سم" });
    expect(formatDimensions(null, 90, null)).toEqual({ label: "الأبعاد (العرض)", value: "90 سم" });
    expect(formatDimensions(null, null, null)).toBeNull();
  });
});

describe("database rules for features and dimensions", () => {
  let db: PGlite;
  beforeAll(async () => {
    db = new PGlite({ fsBundle: new NodeBlob([readFileSync("node_modules/@electric-sql/pglite/dist/pglite.data")]) as unknown as Blob });
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE TABLE public.products(id serial primary key, length_cm numeric, width_cm numeric);`);
    await db.exec(readFileSync("drizzle/migrations/0056_product_features_and_dimensions.sql", "utf8").replace(/--> statement-breakpoint/g, ""));
  }, 30000);
  afterAll(async () => { await db?.close(); });

  const insert = (features: string, l: number | null = null, w: number | null = null) =>
    db.query(`INSERT INTO public.products(features, length_cm, width_cm) VALUES ($1::jsonb, $2, $3)`, [features, l, w]);

  it("saves seller features and positive dimensions", async () => {
    await insert(JSON.stringify([{ title: "الخامة", value: "بوليستر قطن" }, { title: "Origin", value: "TR" }]), 220, 160);
    const { rows } = await db.query<{ features: unknown }>(`SELECT features FROM public.products ORDER BY id DESC LIMIT 1`);
    expect(rows[0].features).toEqual([{ title: "الخامة", value: "بوليستر قطن" }, { title: "Origin", value: "TR" }]);
  });

  it("existing products default to no features", async () => {
    await db.query(`INSERT INTO public.products(length_cm) VALUES (NULL)`);
    const { rows } = await db.query<{ features: unknown }>(`SELECT features FROM public.products ORDER BY id DESC LIMIT 1`);
    expect(rows[0].features).toEqual([]);
  });

  it("rejects blank or extra feature fields and zero/negative sizes", async () => {
    await expect(insert(JSON.stringify([{ title: " ", value: "x" }]))).rejects.toThrow();
    await expect(insert(JSON.stringify([{ title: "a", value: "b", html: "<b>" }]))).rejects.toThrow();
    await expect(insert(JSON.stringify({ title: "a", value: "b" }))).rejects.toThrow();
    await expect(insert("[]", 0, null)).rejects.toThrow();
    await expect(insert("[]", null, -3)).rejects.toThrow();
  });
});
