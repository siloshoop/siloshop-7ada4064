/**
 * Detects phone numbers in buyer–seller chat text. Mirrors the database
 * function public.chat_text_has_phone, which is the real enforcement; this
 * copy only gives instant feedback before anything is sent or uploaded.
 */
export const CHAT_PHONE_BLOCKED_TEXT =
  "يُمنع إرسال أرقام الهواتف في المحادثة بين المشتري والبائع. تواصل عبر المحادثة داخل SiloShop فقط.";

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹";

/**
 * Digit groups written as one number: digits joined by short runs of spaces,
 * dashes, dots, brackets or underscores. Commas and slashes end a group, so
 * lists such as "38, 39, 40" are separate numbers.
 */
const NUMBER_GROUP = /\+?[0-9](?:[0-9]|[\s\-.()_]{1,3}(?=[0-9]))*/g;

/** Whether one written number is a phone number. */
const groupIsPhone = (group: string): boolean => {
  const digits = group.replace(/[^0-9]/g, "");
  const separated = digits.length !== group.replace(/^\+/, "").length;
  if (group.startsWith("+")) return digits.length >= 7; // +963…, +90…
  if (/^00[0-9]{7,}$/.test(digits)) return true; // 00963…
  if (/^963[0-9]{8,10}$/.test(digits)) return true; // 963 9xx …
  if (/^0[0-9]{8,10}$/.test(digits)) return true; // 09xx … / 011 …
  if (/^9[3-9][0-9]{7}$/.test(digits)) return true; // 9xx xxx xxx
  // A long unbroken run is a number someone can dial; separated groups such
  // as price ranges ("25000-30000") or size lists are not.
  return !separated && digits.length >= 10;
};

export const chatTextHasPhone = (text: string | null | undefined): boolean => {
  if (!text) return false;
  let n = Array.from(text, (ch) => {
    const i = ARABIC_DIGITS.indexOf(ch);
    return i >= 0 ? String(i % 10) : ch;
  }).join("");
  n = n.replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, "");
  n = n.replace(/[A-Za-z]{2,4}-[0-9]{4}-[0-9]{4,8}/g, " ");
  n = n.replace(/\+[\s\-.()]+/g, "+");
  return (n.match(NUMBER_GROUP) ?? []).some(groupIsPhone);
};
