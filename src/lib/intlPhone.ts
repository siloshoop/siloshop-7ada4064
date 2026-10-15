import { parsePhoneNumberFromString, validatePhoneNumberLength, type CountryCode } from "libphonenumber-js/max";
import { findCountry } from "@/lib/countryCodes";
import { phoneDigits } from "@/lib/phone";

// Countries sharing a dial code (+1, +7) may resolve to their sibling region.
const SHARED_DIAL = new Set(["US", "CA", "RU", "KZ"]);

export interface IntlPhoneResult {
  e164: string | null;
  error: string | null;
}

/** Validates a national number against the selected country's numbering plan (libphonenumber metadata). */
export function validateIntlPhone(countryCode: string, nationalInput: string): IntlPhoneResult {
  const country = findCountry(countryCode);
  const digits = phoneDigits(nationalInput);
  if (!digits) return { e164: null, error: "رقم الهاتف مطلوب" };
  const iso = country.code as CountryCode;
  const lengthIssue = validatePhoneNumberLength(digits, iso);
  if (lengthIssue === "TOO_SHORT" || lengthIssue === "NOT_A_NUMBER")
    return { e164: null, error: `رقم الهاتف قصير جدًا بالنسبة لـ ${country.nameAr}` };
  if (lengthIssue === "TOO_LONG")
    return { e164: null, error: `رقم الهاتف طويل جدًا بالنسبة لـ ${country.nameAr}` };
  const parsed = parsePhoneNumberFromString(digits, iso);
  if (!parsed || !parsed.isValid() || (parsed.country !== iso && !SHARED_DIAL.has(iso)))
    return { e164: null, error: `رقم الهاتف غير صالح لـ ${country.nameAr}، تأكد من الرقم ورمز الدولة` };
  return { e164: parsed.number, error: null };
}
