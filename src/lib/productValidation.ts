import { z } from "zod";

/**
 * Numeric limits mirror the database column types:
 *  - money columns: numeric(14,2)  -> max 999,999,999,999.99
 *  - weight:        numeric(12,3)  -> max 999,999,999.999
 *  - integers:      int4           -> max 2,147,483,647
 */
export const MAX_MONEY = 999_999_999_999.99;
export const MAX_WEIGHT = 999_999_999.999;
export const MAX_INT = 2_147_483_647;

const round = (n: number, decimals: number) => {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
};

/** Parse a form string/number into a money value, or throw a friendly Arabic error. */
export const money = (label: string, opts: { required?: boolean; min?: number } = {}) =>
  z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .transform((v, ctx) => {
      const raw = typeof v === "string" ? v.trim() : v;
      if (raw === "" || raw === null || raw === undefined) {
        if (opts.required) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} مطلوب` });
          return z.NEVER;
        }
        return null;
      }
      const n = Number(raw);
      if (!Number.isFinite(n)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} يجب أن يكون رقماً صحيحاً` });
        return z.NEVER;
      }
      if (n < (opts.min ?? 0)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} لا يمكن أن يكون أقل من ${opts.min ?? 0}` });
        return z.NEVER;
      }
      if (n > MAX_MONEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${label} كبير جداً — الحد الأقصى ${MAX_MONEY.toLocaleString("en-US")}`,
        });
        return z.NEVER;
      }
      return round(n, 2);
    });

/** Parse a form string/number into a non-negative integer. */
export const integer = (label: string, opts: { required?: boolean; max?: number } = {}) =>
  z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .transform((v, ctx) => {
      const raw = typeof v === "string" ? v.trim() : v;
      if (raw === "" || raw === null || raw === undefined) {
        if (opts.required) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} مطلوب` });
          return z.NEVER;
        }
        return null;
      }
      const n = Number(raw);
      if (!Number.isFinite(n)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} يجب أن يكون رقماً صحيحاً` });
        return z.NEVER;
      }
      if (!Number.isInteger(n)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} يجب أن يكون عدداً صحيحاً بدون فواصل` });
        return z.NEVER;
      }
      if (n < 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} لا يمكن أن يكون سالباً` });
        return z.NEVER;
      }
      const max = opts.max ?? MAX_INT;
      if (n > max) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${label} كبير جداً — الحد الأقصى ${max.toLocaleString("en-US")}`,
        });
        return z.NEVER;
      }
      return n;
    });

/** Weight in kg — numeric(12,3). */
export const weight = () =>
  z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .transform((v, ctx) => {
      const raw = typeof v === "string" ? v.trim() : v;
      if (raw === "" || raw === null || raw === undefined) return null;
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "الوزن يجب أن يكون رقماً موجباً" });
        return z.NEVER;
      }
      if (n > MAX_WEIGHT) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "الوزن كبير جداً" });
        return z.NEVER;
      }
      return round(n, 3);
    });

/** SKU / barcode / product code — always TEXT, never numeric. */
export const codeText = (label: string, max = 64) =>
  z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .transform((v, ctx) => {
      if (v === null || v === undefined) return null;
      const s = String(v).trim();
      if (!s) return null;
      if (s.length > max) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} يجب أن يكون أقل من ${max} حرفاً` });
        return z.NEVER;
      }
      return s;
    });

/** Shared product schema used by seller and platform product forms. */
export const productNumbersSchema = z
  .object({
    name: z.string().trim().min(2, "اسم المنتج مطلوب").max(200, "اسم المنتج طويل جداً"),
    price: money("السعر", { required: true, min: 0.01 }),
    original_price: money("السعر الأصلي"),
    discount_price: money("سعر الخصم"),
    shipping_cost: money("تكلفة الشحن"),
    stock_quantity: integer("الكمية المتوفرة", { required: true }),
    ships_within_days: integer("مدة التحضير (أيام)", { max: 365 }),
    weight: weight(),
    sku: codeText("رمز المنتج (SKU)"),
  })
  .partial({
    original_price: true,
    discount_price: true,
    shipping_cost: true,
    ships_within_days: true,
    weight: true,
    sku: true,
  })
  .superRefine((v, ctx) => {
    if (v.original_price != null && v.price != null && v.original_price < v.price) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["original_price"],
        message: "السعر الأصلي يجب أن يكون أكبر من السعر الحالي",
      });
    }
    if (v.discount_price != null && v.price != null && v.discount_price >= v.price) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["discount_price"],
        message: "سعر الخصم يجب أن يكون أقل من السعر الأساسي",
      });
    }
  });

/** First validation message from a zod error, ready for a toast. */
export const firstIssue = (err: z.ZodError) => err.issues[0]?.message ?? "بيانات غير صالحة";

/** Turn raw database errors into user-friendly Arabic messages. */
export const friendlyDbError = (error: any): string => {
  const msg: string = error?.message ?? "";
  const code: string = error?.code ?? "";

  if (code === "22003" || /numeric field overflow|out of range/i.test(msg)) {
    return "أحد الأرقام المُدخلة كبير جداً (السعر أو الكمية). يرجى إدخال قيمة أصغر.";
  }
  if (code === "22P02" || /invalid input syntax/i.test(msg)) {
    return "أحد الحقول يحتوي على قيمة غير صالحة. تأكد من إدخال الأرقام بشكل صحيح.";
  }
  if (code === "23514" || /violates check constraint/i.test(msg)) {
    return "القيم المُدخلة لا تطابق الشروط المطلوبة. يرجى مراجعة الأسعار والكميات.";
  }
  if (code === "23503" || /foreign key/i.test(msg)) {
    return "الفئة أو العلامة التجارية المختارة غير موجودة.";
  }
  if (code === "23502" || /null value in column/i.test(msg)) {
    return "يرجى تعبئة جميع الحقول المطلوبة.";
  }
  if (code === "23505") return "رمز المنتج (SKU) مستخدم مسبقاً.";
  if (code === "42501" || /permission denied|row-level security/i.test(msg)) {
    return "ليست لديك صلاحية لتنفيذ هذه العملية.";
  }
  return msg || "حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.";
};
