import { describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach } from "vitest";
import ShipmentTrackingTimeline from "@/components/orders/ShipmentTrackingTimeline";
import { buildTrackingShipments, type SavedShipment, type TrackingProduct } from "@/lib/orderShipments";

afterEach(cleanup);
const parent: SavedShipment = { id: "parent", vendor_id: null, status: "pending", tracking_status: "pending", updated_at: null };
const children: SavedShipment[] = [
  { ...parent, id: "shipment-a", vendor_id: "seller-a", status: "confirmed" },
  { ...parent, id: "shipment-b", vendor_id: "seller-b", status: "shipped" },
];
const items: TrackingProduct[] = [
  { id: "item-a", order_id: "parent", vendor_id: "seller-a", product_name: "منتج أ", product_image: null, variant_label: null, quantity: 2, price: 10 },
  { id: "item-b", order_id: "parent", vendor_id: "seller-b", product_name: "منتج ب", product_image: null, variant_label: null, quantity: 1, price: 20 },
];

describe("saved seller shipments", () => {
  it("uses independent child statuses and assigns only each seller's items", () => {
    const result = buildTrackingShipments(parent, children, items);
    expect(result.map((s) => s.status)).toEqual(["confirmed", "shipped"]);
    expect(result.map((s) => s.items.map((i) => i.id))).toEqual([["item-a"], ["item-b"]]);
  });
  it("does not advance another seller when one saved shipment changes", () => {
    const changed = children.map((s) => s.id === "shipment-a" ? { ...s, status: "delivered" } : s);
    expect(buildTrackingShipments(parent, changed, items).map((s) => s.status)).toEqual(["delivered", "shipped"]);
  });
  it("supports direct single-seller orders", () => {
    expect(buildTrackingShipments(parent, [], [items[0]])[0]).toMatchObject({ status: "pending", vendor_id: "seller-a", items: [items[0]] });
  });
  it("never invents per-seller progress for legacy orders without shipments", () => {
    expect(buildTrackingShipments(parent, [], items).map((s) => s.status)).toEqual([null, null]);
  });
});

describe("vertical tracking progress", () => {
  it("keeps the previous circle filled with a check after advancing", () => {
    const { container, rerender } = render(<ShipmentTrackingTimeline status="pending" />);
    rerender(<ShipmentTrackingTimeline status="confirmed" />);
    const pending = container.querySelector('[data-step="pending"]');
    expect(pending?.getAttribute("data-state")).toBe("completed");
    expect(pending?.querySelector(".lucide-check")).toBeTruthy();
    expect(container.querySelector('[data-step="confirmed"]')?.getAttribute("aria-current")).toBe("step");
    expect(container.querySelector('[data-step="preparing"]')?.getAttribute("data-state")).toBe("future");
  });
  it("restores all completed steps from a saved status on fresh render", () => {
    const { container } = render(<ShipmentTrackingTimeline status="completed" />);
    expect(container.querySelectorAll('[data-state="completed"]')).toHaveLength(8);
    expect(container.querySelectorAll(".lucide-check")).toHaveLength(8);
  });
  it("normalizes existing processing status", () => {
    const { container } = render(<ShipmentTrackingTimeline status="processing" />);
    expect(container.querySelector('[data-step="preparing"]')?.getAttribute("data-state")).toBe("current");
  });
  it("keeps return states distinct from pending", () => {
    render(<ShipmentTrackingTimeline status="return_requested" />);
    expect(screen.getByText("تم تقديم طلب إرجاع")).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
  });
});