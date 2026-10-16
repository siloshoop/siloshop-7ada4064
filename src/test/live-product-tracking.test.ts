import { describe, expect, it } from "vitest";
import { mergeSavedProductTracking } from "@/lib/liveProductTracking";

describe("saved realtime product updates", () => {
  const items = [
    { id: "a", tracking_status: "confirmed", tracking_updated_at: "2026-10-16T10:00:00Z", price: 50 },
    { id: "b", tracking_status: "shipped", tracking_updated_at: "2026-10-16T10:00:00Z", price: 20 },
  ];
  it("updates only the matching product immediately, not prices or other products", () => {
    const result = mergeSavedProductTracking(items, { id: "a", tracking_status: "preparing", tracking_updated_at: "2026-10-16T10:01:00Z", price: 0 });
    expect(result[0].tracking_status).toBe("preparing");
    expect(result[0].price).toBe(50);
    expect(result[1]).toBe(items[1]);
    expect(items[0].tracking_status).toBe("confirmed");
  });
  it("does not regress progress when an older event arrives late", () => {
    expect(mergeSavedProductTracking(items, { id: "a", tracking_status: "pending", tracking_updated_at: "2026-10-16T09:59:00Z" })[0]).toBe(items[0]);
  });
  it("ignores events for unrelated orders and products", () => {
    expect(mergeSavedProductTracking(items, { id: "other", tracking_status: "delivered" })).toEqual(items);
  });
  it("preserves separate concurrent product updates and saved shipment numbers", () => {
    const first = mergeSavedProductTracking(items, { id: "a", tracking_status: "preparing", tracking_updated_at: "2026-10-16T10:01:00Z" });
    const result = mergeSavedProductTracking(first, { id: "b", tracking_status: "delivered", tracking_number: "shipment-b", tracking_updated_at: "2026-10-16T10:02:00Z" });
    expect(result.map((item) => item.tracking_status)).toEqual(["preparing", "delivered"]);
    expect(result[1]).toMatchObject({ tracking_number: "shipment-b" });
  });
});