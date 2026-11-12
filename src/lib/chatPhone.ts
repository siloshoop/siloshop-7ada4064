/**
 * Detects phone numbers in buyer–seller chat text. Mirrors the database
 * function public.chat_text_has_phone, which is the real enforcement; this
 * copy only gives instant feedback before anything is sent or uploaded.
 */
export const CHAT_PHONE_BLOCKED_TEXT =
  "يُمنع إرسال أرقام الهواتف في المحادثة بين المشتري والبائع. تواصل عبر المحادثة داخل SiloShop فقط.";

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹";

export const chatTextHasPhone = (text: string | null | undefined): boolean => {
  if (!text) return false;
  let n = Array.from(text, (ch) => {
    const i = ARABIC_DIGITS.indexOf(ch);
    return i >= 0 ? String(i % 10) : ch;
  }).join("");
  n = n.replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, "");
  n = n.replace(/[A-Za-z]{2,4}-[0-9]{4}-[0-9]{4,8}/g, " ");
  n = n.replace(/\+[\s\-.()]+/g, "+");
  n = n.replace(/([0-9])[\s\-.()_/\\,،٬]+(?=[0-9])/g, "$1");
  return /\+[0-9]{7,}/.test(n) || /[0-9]{10,}/.test(n) || /(^|[^0-9])[09][0-9]{8}([^0-9]|$)/.test(n);
};
