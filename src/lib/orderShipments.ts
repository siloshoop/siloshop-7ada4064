export interface TrackingProduct {
  id: string;
  order_id: string;
  vendor_id: string | null;
  product_id?: string | null;
  product_name: string | null;
  product_image: string | null;
  variant_label: string | null;
  quantity: number;
  price: number;
}

export interface SavedShipment {
  id: string;
  vendor_id: string | null;
  status: string | null;
  tracking_status: string | null;
  updated_at: string | null;
}

export interface TrackingShipment extends SavedShipment {
  items: TrackingProduct[];
}

/** Child orders own shipment progress; parent items are matched by seller. */
export function buildTrackingShipments(
  parent: SavedShipment,
  children: SavedShipment[],
  items: TrackingProduct[],
): TrackingShipment[] {
  if (children.length) {
    return children.map((child) => ({
      ...child,
      items: items.filter((item) => item.order_id === child.id ||
        (item.order_id === parent.id && item.vendor_id === child.vendor_id)),
    }));
  }
  const vendors = [...new Set(items.map((item) => item.vendor_id))];
  if (vendors.length <= 1) return [{ ...parent, vendor_id: vendors[0] ?? parent.vendor_id, items }];
  // A legacy parent status cannot stand in for independent seller progress.
  return vendors.map((vendorId) => ({
    ...parent, id: `${parent.id}:${vendorId ?? "platform"}`, vendor_id: vendorId,
    status: null, tracking_status: null,
    items: items.filter((item) => item.vendor_id === vendorId),
  }));
}