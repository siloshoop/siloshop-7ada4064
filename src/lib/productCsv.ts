// Dependency-free CSV helpers for product import/export.

export const PRODUCT_CSV_COLUMNS = [
  "name",
  "name_en",
  "sku",
  "barcode",
  "price",
  "discount_price",
  "stock_quantity",
  "category_id",
  "brand_id",
  "shipping_cost",
  "weight",
  "country_of_origin",
  "warranty",
  "short_description",
  "description",
  "tags",
  "seo_title",
  "seo_description",
] as const;

export type ProductCsvColumn = (typeof PRODUCT_CSV_COLUMNS)[number];

export type ProductCsvRow = Record<ProductCsvColumn, string>;

export interface ParsedProductCsvRow {
  line: number;
  data: ProductCsvRow;
}

export interface ParseProductsCsvResult {
  rows: ParsedProductCsvRow[];
  errors: { line: number; message: string }[];
}

const CSV_BOM = "\uFEFF";

function escapeCsvField(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildProductsCsv(rows: Array<Partial<Record<ProductCsvColumn, unknown>>>): string {
  const header = PRODUCT_CSV_COLUMNS.join(",");
  const lines = rows.map((row) => PRODUCT_CSV_COLUMNS.map((col) => escapeCsvField(row[col])).join(","));
  return CSV_BOM + [header, ...lines].join("\r\n");
}

// Parses a single CSV line honoring quoted fields, returns array of fields.
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

// Splits raw CSV text into logical records, respecting quoted newlines.
function splitCsvRecords(text: string): string[] {
  const records: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      cur += ch;
    } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      records.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur.trim().length > 0) records.push(cur);
  return records;
}

export function parseProductsCsv(text: string): ParseProductsCsvResult {
  const cleaned = text.replace(/^\uFEFF/, "");
  const records = splitCsvRecords(cleaned).filter((r) => r.trim().length > 0);
  const errors: { line: number; message: string }[] = [];
  const rows: ParsedProductCsvRow[] = [];

  if (records.length === 0) {
    errors.push({ line: 0, message: "الملف فارغ." });
    return { rows, errors };
  }

  const header = parseCsvLine(records[0]).map((h) => h.trim());
  const missing = PRODUCT_CSV_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length > 0) {
    errors.push({ line: 1, message: `أعمدة ناقصة في الترويسة: ${missing.join("، ")}` });
    return { rows, errors };
  }

  for (let i = 1; i < records.length; i++) {
    const lineNo = i + 1;
    const fields = parseCsvLine(records[i]);
    const data = {} as ProductCsvRow;
    header.forEach((col, idx) => {
      if ((PRODUCT_CSV_COLUMNS as readonly string[]).includes(col)) {
        (data as any)[col] = (fields[idx] ?? "").trim();
      }
    });
    PRODUCT_CSV_COLUMNS.forEach((col) => {
      if (data[col] === undefined) data[col] = "";
    });

    if (!data.name) {
      errors.push({ line: lineNo, message: "اسم المنتج مطلوب." });
      continue;
    }
    if (!data.price || Number.isNaN(Number(data.price)) || Number(data.price) <= 0) {
      errors.push({ line: lineNo, message: `سعر غير صحيح للمنتج "${data.name}".` });
      continue;
    }
    if (data.discount_price && Number.isNaN(Number(data.discount_price))) {
      errors.push({ line: lineNo, message: `سعر التخفيض غير صحيح للمنتج "${data.name}".` });
      continue;
    }
    if (data.stock_quantity && Number.isNaN(Number(data.stock_quantity))) {
      errors.push({ line: lineNo, message: `الكمية غير صحيحة للمنتج "${data.name}".` });
      continue;
    }

    rows.push({ line: lineNo, data });
  }

  return { rows, errors };
}
