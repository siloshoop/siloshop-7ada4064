export const VIOLATION_SEVERITY_LABELS: Record<string, string> = {
  warning: "إنذار",
  strike: "مخالفة",
  suspension: "إيقاف",
};

export const VIOLATION_SEVERITY_CLASS: Record<string, string> = {
  warning: "bg-warning/15 text-warning",
  strike: "bg-sale/15 text-sale",
  suspension: "bg-destructive/10 text-destructive",
};

/** Standard violation reason codes used by the moderation team. */
export const VIOLATION_REASON_CODES: string[] = [
  "منتج مخالف أو محظور",
  "وصف أو صور مضللة",
  "سعر مبالغ فيه أو تلاعب بالأسعار",
  "تأخر متكرر في تسليم الطلبات",
  "إلغاء طلبات دون سبب",
  "تعامل غير لائق مع العميل",
  "مخالفة سياسة الإرجاع",
  "تقييمات أو طلبات وهمية",
  "بيانات متجر غير صحيحة",
  "أخرى",
];

export const violationSeverityLabel = (s: string | null) =>
  VIOLATION_SEVERITY_LABELS[s ?? ""] ?? "غير محدد";

export const violationSeverityClass = (s: string | null) =>
  VIOLATION_SEVERITY_CLASS[s ?? ""] ?? "bg-muted text-muted-foreground";
