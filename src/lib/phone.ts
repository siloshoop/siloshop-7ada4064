/**
 * Syrian mobile numbers: exactly 10 digits, always starting with 09.
 * One place decides the rule so every field and every order record agree.
 */

export const SYRIAN_MOBILE_MAX_DIGITS = 10;
export const SYRIAN_MOBILE_PATTERN = /^09\d{8}$/;

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

/** Drops letters, spaces and separators, and turns Arabic-Indic digits into the Latin ones orders store. */
export function phoneDigits(value: string): string {
  if (!value) return "";
  return Array.from(value)
    .map((char) => {
      const arabic = ARABIC_DIGITS.indexOf(char);
      if (arabic >= 0) return String(arabic);
      const persian = PERSIAN_DIGITS.indexOf(char);
      if (persian >= 0) return String(persian);
      return char;
    })
    .join("")
    .replace(/\D/g, "");
}

/** Keeps only digits so letters can never be typed into a phone field. */
export function sanitizePhoneInput(value: string): string {
  return phoneDigits(value);
}

export function phoneError(value: string): string | null {
  const digits = phoneDigits(value);
  if (!digits) return "رقم الهاتف مطلوب";
  if (digits.length > SYRIAN_MOBILE_MAX_DIGITS)
    return `رقم الهاتف يجب ألا يتجاوز ${SYRIAN_MOBILE_MAX_DIGITS} أرقام`;
  if (!SYRIAN_MOBILE_PATTERN.test(digits))
    return "رقم الهاتف يجب أن يبدأ بـ 09 ويتكون من 10 أرقام (مثال: 0944123456)";
  return null;
}

export function isSyrianMobile(value: string): boolean {
  return phoneError(value) === null;
}
