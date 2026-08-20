export const RETURN_REASONS = [
  { value: "wrong_product", label: "منتج خاطئ" },
  { value: "damaged", label: "منتج تالف" },
  { value: "defective", label: "منتج معيب" },
  { value: "missing_parts", label: "أجزاء مفقودة" },
  { value: "not_as_described", label: "غير مطابق للوصف" },
  { value: "changed_mind", label: "غيّرت رأيي" },
  { value: "other", label: "سبب آخر" },
] as const;

export type ReturnReason = (typeof RETURN_REASONS)[number]["value"];

export const RETURN_STATUS: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; description: string }
> = {
  pending: { label: "قيد المراجعة الأولية", variant: "secondary", description: "طلبك بانتظار مراجعة البائع" },
  under_review: { label: "قيد المراجعة", variant: "secondary", description: "البائع يراجع طلبك" },
  info_requested: { label: "معلومات مطلوبة", variant: "outline", description: "البائع طلب معلومات إضافية" },
  approved: { label: "موافق عليه", variant: "default", description: "تمت الموافقة على الإرجاع" },
  rejected: { label: "مرفوض", variant: "destructive", description: "تم رفض طلب الإرجاع" },
  awaiting_return: {
    label: "بانتظار إرجاع المنتج",
    variant: "outline",
    description: "يرجى إرسال المنتج وفق تعليمات البائع",
  },
  item_shipped: { label: "تم إرسال المنتج", variant: "outline", description: "المنتج في طريقه إلى البائع" },
  item_received: { label: "تم استلام المنتج", variant: "default", description: "استلم البائع المنتج المرتجع" },
  inspection: { label: "قيد الفحص", variant: "secondary", description: "يتم فحص المنتج المرتجع" },
  completed: { label: "تم إكمال الإرجاع", variant: "default", description: "تم إكمال عملية الإرجاع" },
  return_in_progress: { label: "الإرجاع جارٍ", variant: "outline", description: "المنتج في طريقه للبائع" },
  returned: { label: "تم الإرجاع", variant: "default", description: "استلم البائع المنتج" },
  refunded: { label: "تم رد المبلغ", variant: "default", description: "تم رد المبلغ" },
  closed: { label: "مغلق", variant: "secondary", description: "طلب الإرجاع مغلق" },
  // Canonical enterprise statuses
  pending_review: { label: "بانتظار المراجعة", variant: "secondary", description: "طلبك بانتظار مراجعة البائع" },
  seller_reviewing: { label: "البائع يراجع الطلب", variant: "secondary", description: "البائع يراجع طلبك الآن" },
  waiting_customer: { label: "بانتظار ردك", variant: "outline", description: "البائع طلب معلومات إضافية" },
  customer_shipping: { label: "المنتج في طريقه للبائع", variant: "outline", description: "تم إرسال المنتج المرتجع" },
  seller_inspecting: { label: "قيد الفحص", variant: "secondary", description: "البائع يفحص المنتج المرتجع" },
  inspection_passed: { label: "نجح الفحص", variant: "default", description: "تم قبول المنتج المرتجع" },
  inspection_failed: { label: "فشل الفحص", variant: "destructive", description: "لم يجتز المنتج الفحص" },
  cancelled: { label: "ملغي", variant: "secondary", description: "تم إلغاء طلب الإرجاع" },
};

/** Return window (days after delivery) during which a return can be requested. */
export const RETURN_WINDOW_DAYS = 7;

/** Ordered lifecycle used for the customer-facing timeline. */
export const RETURN_TIMELINE = [
  "pending_review",
  "seller_reviewing",
  "approved",
  "customer_shipping",
  "seller_inspecting",
  "inspection_passed",
  "completed",
] as const;

/** Statuses a seller/admin can move a return to, in workflow order. */
export const RETURN_NEXT_STATUSES = [
  "seller_reviewing",
  "waiting_customer",
  "approved",
  "rejected",
  "customer_shipping",
  "seller_inspecting",
  "inspection_passed",
  "inspection_failed",
  "completed",
  "cancelled",
] as const;

export const returnStatusLabel = (status: string) => RETURN_STATUS[status]?.label ?? status;

/** Maps legacy statuses onto the canonical enterprise lifecycle. */
export const RETURN_STATUS_ALIAS: Record<string, string> = {
  pending: "pending_review",
  under_review: "seller_reviewing",
  info_requested: "waiting_customer",
  awaiting_return: "approved",
  item_shipped: "customer_shipping",
  return_in_progress: "customer_shipping",
  item_received: "seller_inspecting",
  inspection: "seller_inspecting",
  returned: "inspection_passed",
  refunded: "completed",
  closed: "completed",
};

export const canonicalReturnStatus = (status: string) => RETURN_STATUS_ALIAS[status] ?? status;

/** Index of a status inside RETURN_TIMELINE; -1 for terminal/off-track statuses. */
export function returnTimelineIndex(status: string): number {
  return (RETURN_TIMELINE as readonly string[]).indexOf(canonicalReturnStatus(status));
}

/** Days left to request a return, or null when not applicable. */
export function returnDaysRemaining(deliveredAt?: string | null): number | null {
  if (!deliveredAt) return null;
  const endMs = new Date(deliveredAt).getTime() + RETURN_WINDOW_DAYS * 86400000;
  const left = Math.ceil((endMs - Date.now()) / 86400000);
  return left > 0 ? left : 0;
}

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