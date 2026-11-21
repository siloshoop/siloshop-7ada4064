import { describe, it, expect } from "vitest";
import { isPushNotificationType, notificationTarget, ORDER_UPDATE_TYPES } from "@/lib/notificationRoutes";

describe("phone and browser push alerts", () => {
  it("sends new orders, store requests, order updates and platform notices", () => {
    for (const t of ["new_order", "staff_store_request", "order_status", "order_cancelled", "admin", "warning", "seller_approved"]) {
      expect(isPushNotificationType(t)).toBe(true);
    }
  });

  it("keeps noisy or chat alerts inside the app only", () => {
    for (const t of ["staff_product_added", "staff_customer_registered", "message", "deal", null, ""]) {
      expect(isPushNotificationType(t as string)).toBe(false);
    }
  });

  it("buyer order progress respects the «تحديثات الطلبات» switch, seller new orders do not", () => {
    expect(ORDER_UPDATE_TYPES).toContain("order_status");
    expect(ORDER_UPDATE_TYPES).not.toContain("new_order");
  });

  it("opens the matching page when tapped", () => {
    expect(notificationTarget("new_order", "o1")).toBe("/dashboard/orders?order=o1");
    expect(notificationTarget("order_status", "o1")).toBe("/orders/track/o1");
    expect(notificationTarget("staff_store_request", "x")).toBe("/admin/seller-applications");
  });
});
