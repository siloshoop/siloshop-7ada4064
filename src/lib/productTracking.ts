import { Clock, PackageCheck, Package, Boxes, Warehouse, Truck, Home } from "lucide-react";

/** Product shipment progress is independent of the whole-order lifecycle. */
export const PRODUCT_TRACKING_STEPS = [
  { key: "confirmed", label: "تم تأكيد الطلب", icon: PackageCheck },
  { key: "preparing", label: "بدء التحضير", icon: Package },
  { key: "ready_for_shipping", label: "جاهز للشحن", icon: Boxes },
  { key: "out_for_delivery", label: "تم تسليم الطلب إلى مركز الشحن", icon: Warehouse },
  { key: "shipped", label: "تم الشحن", icon: Truck },
  { key: "delivered", label: "تم الاستلام", icon: Home },
];

export const normalizeProductTracking = (status?: string | null) => {
  const value = status?.trim().toLowerCase();
  return value === "processing" ? "preparing" : value === "completed" ? "delivered" : value ?? "";
};

const TERMINAL: Record<string, string> = {
  cancelled: "تم إلغاء المنتج", return_requested: "تم تقديم طلب إرجاع",
  returning: "المنتج قيد الإرجاع", returned: "تم إرجاع المنتج", refunded: "تم رد المبلغ",
};
export const productTrackingLabel = (status?: string | null) => {
  const value = normalizeProductTracking(status);
  return PRODUCT_TRACKING_STEPS.find((step) => step.key === value)?.label
    ?? TERMINAL[value] ?? (value === "pending" ? "بانتظار تأكيد الطلب" : "حالة تتبع المنتج غير متاحة");
};

export const nextProductTracking = (status?: string | null) => {
  const value = normalizeProductTracking(status);
  if (value === "pending") return PRODUCT_TRACKING_STEPS[0];
  const index = PRODUCT_TRACKING_STEPS.findIndex((step) => step.key === value);
  return index >= 0 ? PRODUCT_TRACKING_STEPS[index + 1] : undefined;
};

export const PendingTrackingIcon = Clock;
export interface ProductTrackingHistory {
  order_item_id: string;
  status: string;
  created_at: string;
}

export const productTrackingProgress = (status?: string | null) => {
  const value = normalizeProductTracking(status);
  const index = PRODUCT_TRACKING_STEPS.findIndex((step) => step.key === value);
  return PRODUCT_TRACKING_STEPS.map((step, i) => ({
    ...step,
    state: i < index || (value === "delivered" && i === index) ? "completed" : i === index ? "current" : "future",
  }));
};