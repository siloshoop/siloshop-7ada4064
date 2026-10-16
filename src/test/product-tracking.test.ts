import { describe, expect, it } from "vitest";
import { nextProductTracking, normalizeProductTracking, productTrackingProgress } from "@/lib/productTracking";
import { buildTrackingShipments, type TrackingProduct } from "@/lib/orderShipments";

describe("independent product tracking rules", () => {
  it("puts shipping-center receipt before shipping without changing order rules", () => {
    expect(nextProductTracking("ready_for_shipping")?.key).toBe("out_for_delivery");
    expect(nextProductTracking("out_for_delivery")?.key).toBe("shipped");
    expect(nextProductTracking("shipped")?.key).toBe("delivered");
  });
  it("does not invent progress from missing or unsupported saved statuses", () => {
    expect(nextProductTracking(null)).toBeUndefined();
    expect(nextProductTracking("unknown")).toBeUndefined();
    expect(productTrackingProgress(null).every((step) => step.state === "future")).toBe(true);
  });
  it("keeps legacy completed and processing readable", () => {
    expect(normalizeProductTracking("completed")).toBe("delivered");
    expect(normalizeProductTracking("processing")).toBe("preparing");
    expect(productTrackingProgress("completed").filter((step) => step.state === "completed")).toHaveLength(6);
  });
  it("does not advance terminal items", () => {
    for (const status of ["cancelled", "returned", "refunded", "delivered", "completed"]) {
      expect(nextProductTracking(status)).toBeUndefined();
    }
  });
  it("isolates products of the same seller and across different sellers", () => {
    const parent = { id: "order", vendor_id: null, status: "delivered", tracking_status: null, updated_at: null };
    const base: TrackingProduct = { id: "a", order_id: "order", vendor_id: "seller-a", product_name: null, product_image: null, variant_label: null, quantity: 1, price: 10, tracking_status: "preparing" };
    const result = buildTrackingShipments(parent, [], [base, { ...base, id: "b", tracking_status: "shipped" }, { ...base, id: "c", vendor_id: "seller-b", tracking_status: "confirmed" }]);
    expect(result.map((shipment) => shipment.items.map((item) => [item.id, item.tracking_status]))).toEqual([
      [["a", "preparing"], ["b", "shipped"]], [["c", "confirmed"]],
    ]);
    expect(result.map((shipment) => shipment.status)).toEqual([null, null]);
  });
});