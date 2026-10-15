import { z } from "zod";

export const COUPON_DATE_ORDER_ERROR = "يجب أن يكون تاريخ انتهاء الكوبون بعد تاريخ البدء.";

// Native datetime-local controls return year-month-day even when displayed in Arabic.
// Normalize Arabic/Persian digits, but never guess the order of slash-separated dates.
const localDateSchema = z.string().max(40).transform((value) => value.trim()
  .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x660))
  .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x6f0))
  .replace(/[\u200e\u200f\u061c]/g, ""))
  .pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/));

function localDateToISO(value: string, label: string): string | null {
  if (!value.trim()) return null;
  const parsed = localDateSchema.safeParse(value);
  if (!parsed.success) throw new Error(`تاريخ ${label} غير صالح؛ اختر التاريخ والوقت من حقل التاريخ.`);
  const [year, month, day, hour, minute, second = 0] = parsed.data.split(/[-T:]/).map(Number);
  const date = new Date(year, month - 1, day, hour, minute, second);
  // Reject overflow dates (e.g. February 30), invalid times and nonexistent DST times.
  if (year < 1000 || date.getFullYear() !== year || date.getMonth() !== month - 1 ||
    date.getDate() !== day || date.getHours() !== hour || date.getMinutes() !== minute || date.getSeconds() !== second) {
    throw new Error(`تاريخ ${label} غير صالح؛ اختر تاريخًا ووقتًا صحيحين.`);
  }
  // Interpret as the device's local time exactly once, then send explicit UTC to the server.
  return date.toISOString();
}

export function validateCouponDates(startsAt: string, expiresAt: string) {
  const starts_at = localDateToISO(startsAt, "البدء");
  const expires_at = localDateToISO(expiresAt, "الانتهاء");
  if (starts_at && expires_at && Date.parse(expires_at) <= Date.parse(starts_at)) {
    throw new Error(COUPON_DATE_ORDER_ERROR);
  }
  return { starts_at, expires_at };
}