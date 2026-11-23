/**
 * Single source of truth for where a notification should navigate — used by the
 * in-app lists (via src/lib/notificationRoutes.ts) and by phone/browser pushes
 * (push-dispatch). Pure TypeScript so both the app and edge functions import it.
 * `related_id` meaning per type:
 *  - order* / return_status  -> order id
 *  - message                 -> conversation id
 *  - new_order               -> order id (seller side)
 *  - product_* / deals       -> product id
 */
export const notificationTarget = (
  type: string,
  relatedId?: string | null,
): string | null => {
  if (type === "staff_store_request") return "/admin/seller-applications";
  if (type === "staff_product_added") return "/admin/products";
  if (type === "staff_customer_registered") return "/notifications";
  if (type === "seller_approved" || type === "seller_reactivated") return "/dashboard";
  if (type === "seller_rejected" || type === "seller_suspended") return "/seller/application";
  if (type === "account_activated" || type === "account_suspended" || type === "account_banned") {
    return "/profile";
  }

  if (type === "message") return relatedId ? `/messages?c=${relatedId}` : "/messages";
  if (type === "new_order") return relatedId ? `/dashboard/orders?order=${relatedId}` : "/dashboard/orders";

  if (
    type === "order" || type === "order_status" ||
    type === "order_cancelled" || type === "order_refunded" ||
    type === "return_status"
  ) {
    return relatedId ? `/orders/track/${relatedId}` : "/orders";
  }

  if (!relatedId) return null;

  if (type.startsWith("product_") && type !== "product_deleted") return `/product/${relatedId}`;
  if (
    type === "price_change" || type === "price_drop" ||
    type === "daily_deal" || type === "deal" || type === "deal_ended" ||
    type === "new_product" || type === "push_new_product" ||
    type === "rating" || type === "review_reply"
  ) {
    return `/product/${relatedId}`;
  }

  return null;
};

/**
 * In-app alert types that are also delivered as phone/browser notifications:
 * orders, store requests, chat messages, platform/account notices and
 * opt-out promotions. Mirrored by public.notification_push_eligible — change both together.
 */
export const PUSH_NOTIFICATION_TYPES = [
  "new_order", "order", "order_status", "order_cancelled", "order_refunded", "return_status",
  "staff_store_request", "seller_approved", "seller_rejected", "seller_suspended", "seller_reactivated",
  "product_approve", "product_reject", "product_suspend",
  "admin", "warning", "announcement",
  "account_suspended", "account_activated", "account_banned",
  "message",
  "promotion", "deal", "daily_deal", "price_drop", "price_change", "new_product",
] as const;

/** Buyer order progress types; skipped as pushes when the buyer turned off «تحديثات الطلبات». */
export const ORDER_UPDATE_TYPES = ["order", "order_status", "order_cancelled", "order_refunded", "return_status"];

/** Optional marketing pushes; each needs «العروض والتخفيضات» plus its own switch when it has one. */
export const PROMOTION_TYPES = ["promotion", "deal", "daily_deal", "price_drop", "price_change", "new_product"];

export type NotificationPreferenceKey = "order_updates" | "promotions" | "price_drops" | "daily_deals" | "new_products";

/** Preference switches that must all be on (missing = on) before this alert is pushed to a buyer. */
export const pushPreferenceKeys = (type: string): NotificationPreferenceKey[] => {
  if (ORDER_UPDATE_TYPES.includes(type)) return ["order_updates"];
  if (type === "price_drop" || type === "price_change") return ["promotions", "price_drops"];
  if (type === "deal" || type === "daily_deal") return ["promotions", "daily_deals"];
  if (type === "new_product") return ["promotions", "new_products"];
  if (type === "promotion") return ["promotions"];
  return [];
};

/** Alerts sharing a key replace each other on the device, so one order or chat shows one alert. */
export const pushGroupKey = (type: string, relatedId: string | null | undefined, notificationId: string) => {
  if (!relatedId) return notificationId;
  if (type === "message") return `chat-${relatedId}`;
  if (type === "new_order") return `sale-${relatedId}`;
  if (ORDER_UPDATE_TYPES.includes(type)) return `order-${relatedId}`;
  return notificationId;
};

export const isPushNotificationType = (type: string | null | undefined) =>
  !!type && (PUSH_NOTIFICATION_TYPES as readonly string[]).includes(type);
