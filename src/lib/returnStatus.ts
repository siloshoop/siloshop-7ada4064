export const RETURN_REASONS = [
  { value: "damaged", label: "منتج تالف" },
  { value: "wrong_product", label: "منتج خاطئ" },
  { value: "missing_parts", label: "أجزاء مفقودة" },
  { value: "not_as_described", label: "غير مطابق للوصف" },
  { value: "defective", label: "منتج معيب" },
  { value: "changed_mind", label: "غيّرت رأيي" },
  { value: "other", label: "سبب آخر" },
] as const;

export type ReturnReason = (typeof RETURN_REASONS)[number]["value"];

export const RETURN_STATUS: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; description: string }
> = {
  pending: { label: "قيد الانتظار", variant: "secondary", description: "طلبك بانتظار مراجعة البائع" },
  under_review: { label: "قيد المراجعة", variant: "secondary", description: "البائع يراجع طلبك" },
  info_requested: { label: "معلومات مطلوبة", variant: "outline", description: "البائع طلب معلومات إضافية" },
  approved: { label: "موافق عليه", variant: "default", description: "تمت الموافقة على الإرجاع" },
  rejected: { label: "مرفوض", variant: "destructive", description: "تم رفض طلب الإرجاع" },
  return_in_progress: { label: "الإرجاع جارٍ", variant: "outline", description: "المنتج في طريقه للبائع" },
  returned: { label: "تم الإرجاع", variant: "default", description: "استلم البائع المنتج" },
  refunded: { label: "تم رد المبلغ", variant: "default", description: "تم رد المبلغ" },
  closed: { label: "مغلق", variant: "secondary", description: "طلب الإرجاع مغلق" },
};

export const RETURN_WINDOW_DAYS = 14;

export function isReturnEligible(order: {
  status?: string | null;
  delivered_at?: string | null;
}): { eligible: boolean; reason?: string } {
  if (order.status !== "delivered") return { eligible: false, reason: "not_delivered" };
  if (!order.delivered_at) return { eligible: false, reason: "no_delivery_date" };
  const deliveredMs = new Date(order.delivered_at).getTime();
  const windowMs = RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  if (Date.now() - deliveredMs > windowMs) return { eligible: false, reason: "expired" };
  return { eligible: true };
}

export function returnDeadline(deliveredAt: string): Date {
  return new Date(new Date(deliveredAt).getTime() + RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}