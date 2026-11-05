import { validateCouponDates } from "@/lib/couponDates";
export function isInternalAdPath(path: string) { return !path || (/^\/(?![\/\\])/.test(path) && !/[\u0000-\u001f\u007f\\]/.test(path)); }
export function adDates(start: string, end: string) {
  try { const dates = validateCouponDates(start, end); return { start_date: dates.starts_at, end_date: dates.expires_at }; }
  catch { throw new Error("اختر تاريخًا صحيحًا؛ يجب أن يكون انتهاء الإعلان بعد بدايته."); }
}
export function localAdDate(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso); if (!Number.isFinite(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function adState(ad: { is_active: boolean; start_date: string | null; end_date: string | null }, now = Date.now()) {
  if (!ad.is_active) return "متوقف";
  if (ad.end_date && Date.parse(ad.end_date) <= now) return "منتهي";
  if (ad.start_date && Date.parse(ad.start_date) > now) return "مجدول";
  return "معروض";
}