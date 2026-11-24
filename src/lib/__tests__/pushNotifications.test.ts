import { describe, it, expect } from "vitest";
import {
  isPushNotificationType,
  notificationTarget,
  ORDER_UPDATE_TYPES,
  pushGroupKey,
  pushPreferenceKeys,
} from "@/lib/notificationRoutes";

describe("phone and browser push alerts", () => {
  it("sends orders, store requests, chats, platform notices and offers", () => {
    for (const t of ["new_order", "staff_store_request", "order_status", "order_cancelled", "admin", "warning", "seller_approved", "message", "promotion", "deal", "price_drop"]) {
      expect(isPushNotificationType(t)).toBe(true);
    }
  });

  it("keeps noisy staff alerts inside the app only", () => {
    for (const t of ["staff_product_added", "staff_customer_registered", null, ""]) {
      expect(isPushNotificationType(t as string)).toBe(false);
    }
  });

  it("buyer order progress respects «تحديثات الطلبات»; seller sales, chats and announcements need no switch", () => {
    expect(ORDER_UPDATE_TYPES).toContain("order_status");
    expect(pushPreferenceKeys("order_status")).toEqual(["order_updates"]);
    expect(pushPreferenceKeys("new_order")).toEqual([]);
    expect(pushPreferenceKeys("message")).toEqual([]);
    expect(pushPreferenceKeys("admin")).toEqual([]);
  });

  it("offers are optional: «العروض الترويجية» plus their own switch", () => {
    expect(pushPreferenceKeys("promotion")).toEqual(["promotions"]);
    expect(pushPreferenceKeys("price_drop")).toEqual(["promotions", "price_drops"]);
    expect(pushPreferenceKeys("deal")).toEqual(["promotions", "daily_deals"]);
    expect(pushPreferenceKeys("new_product")).toEqual(["promotions", "new_products"]);
  });

  it("one chat or order shows one alert on the device instead of a pile", () => {
    expect(pushGroupKey("message", "c1", "n1")).toBe(pushGroupKey("message", "c1", "n2"));
    expect(pushGroupKey("order_status", "o1", "n1")).toBe(pushGroupKey("order_cancelled", "o1", "n2"));
    expect(pushGroupKey("new_order", "o1", "n1")).not.toBe(pushGroupKey("order_status", "o1", "n2"));
    expect(pushGroupKey("admin", null, "n1")).not.toBe(pushGroupKey("admin", null, "n2"));
  });

  it("opens the matching page when tapped", () => {
    expect(notificationTarget("new_order", "o1")).toBe("/dashboard/orders?order=o1");
    expect(notificationTarget("order_status", "o1")).toBe("/orders/track/o1");
    expect(notificationTarget("message", "c1")).toBe("/messages?c=c1");
    expect(notificationTarget("price_drop", "p1")).toBe("/product/p1");
    expect(notificationTarget("staff_store_request", "x")).toBe("/admin/seller-applications");
  });
});
