/** Clear, specific Arabic reasons for image upload failures + recommended sizes. */

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];

export type ImageKind = "logo" | "cover" | "product";

export const IMAGE_SIZE_GUIDES: Record<ImageKind, string> = {
  logo: "المقاس الموصى به: 500 × 500 بكسل (مربع)",
  cover: "المقاس الموصى به: 1920 × 600 بكسل (عريض)",
  product: "المقاس الموصى به: 1000 × 1000 بكسل (مربع)",
};

export const IMAGE_FORMAT_HINT = "الصيغ المدعومة: JPG, PNG, WEBP, GIF · الحد الأقصى 5 ميجابايت";

export class UploadError extends Error {}

const mb = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1);

/** Returns a reason string when the file can't be uploaded, otherwise null. */
export const validateImageFile = (file: File): string | null => {
  if (!file.type.startsWith("image/") || !ALLOWED_IMAGE_TYPES.includes(file.type.toLowerCase())) {
    const ext = file.name.split(".").pop()?.toUpperCase() || "غير معروفة";
    return `صيغة الملف «${file.name}» (${ext}) غير مدعومة. ${IMAGE_FORMAT_HINT}`;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `حجم الصورة «${file.name}» ${mb(file.size)} ميجابايت، والحد الأقصى 5 ميجابايت. صغّر الصورة ثم أعد المحاولة.`;
  }
  if (file.size === 0) return `الملف «${file.name}» فارغ أو تالف.`;
  return null;
};

/** Translate a storage / network / compression error into a specific reason. */
export const describeUploadError = (error: unknown, file?: File): string => {
  const anyErr = error as { message?: string; statusCode?: string | number; status?: number; name?: string } | null;
  const msg = String(anyErr?.message ?? error ?? "").toLowerCase();
  const status = Number(anyErr?.statusCode ?? anyErr?.status ?? 0);

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "لا يوجد اتصال بالإنترنت. تحقق من الشبكة ثم أعد المحاولة.";
  }
  if (msg.includes("failed to fetch") || msg.includes("network") || msg.includes("load failed") || msg.includes("timeout")) {
    return "انقطع الاتصال أثناء الرفع (خطأ في الشبكة). تحقق من الإنترنت ثم أعد المحاولة.";
  }
  if (status === 413 || msg.includes("too large") || msg.includes("payload") || msg.includes("exceeded the maximum")) {
    return `حجم الصورة${file ? ` (${mb(file.size)} ميجابايت)` : ""} أكبر من المسموح به. الحد الأقصى 5 ميجابايت.`;
  }
  if (msg.includes("mime") || msg.includes("invalid_mime") || msg.includes("not supported") || status === 415) {
    return `صيغة الصورة غير مدعومة. ${IMAGE_FORMAT_HINT}`;
  }
  if (status === 401 || msg.includes("jwt") || msg.includes("not authenticated")) {
    return "انتهت جلسة الدخول. سجّل الدخول مرة أخرى ثم أعد الرفع.";
  }
  if (status === 403 || msg.includes("row-level security") || msg.includes("unauthorized") || msg.includes("permission")) {
    return "ليست لديك صلاحية لرفع الصور في هذا المكان.";
  }
  if (msg.includes("already exists") || status === 409) {
    return "يوجد ملف بالاسم نفسه. أعد المحاولة.";
  }
  if (msg.includes("bucket not found")) return "مكان تخزين الصور غير متاح حاليًا. تواصل مع الدعم.";
  if (msg.includes("compress") || msg.includes("image") && msg.includes("decode")) {
    return "تعذّرت معالجة الصورة؛ قد يكون الملف تالفًا. جرّب صورة أخرى.";
  }
  if (status >= 500) return "خطأ مؤقت في الخادم أثناء الرفع. أعد المحاولة بعد قليل.";
  return anyErr?.message ? `تعذّر رفع الصورة: ${anyErr.message}` : "تعذّر رفع الصورة لسبب غير معروف. أعد المحاولة.";
};
