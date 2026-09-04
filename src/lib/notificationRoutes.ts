/**
 * Single source of truth for where a notification should navigate.
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
