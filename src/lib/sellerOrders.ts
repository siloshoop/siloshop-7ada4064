import { supabase } from "@/integrations/supabase/client";
import { withDisplayCurrency } from "@/lib/displayCurrency";

export interface SellerOrderRow {
  id: string;
  order_number: string | null;
  invoice_number: string | null;
  created_at: string;
  updated_at: string;
  status: string;
  payment_status: string;
  payment_method: string;
  total_amount: number;
  currency?: string | null;
  vendor_subtotal: number;
  items_count: number;
  customer_name: string | null;
  customer_phone: string | null;
  city: string | null;
  courier_name: string | null;
  estimated_delivery: string | null;
  is_frozen: boolean;
  total_count: number;
}

export interface SellerOrderFilters {
  search?: string;
  status?: string; // "all" or a status key
  from?: string | null;
  to?: string | null;
  limit?: number;
  offset?: number;
}

export const fetchSellerOrders = async (
  filters: SellerOrderFilters,
): Promise<{ rows: SellerOrderRow[]; total: number }> => {
  const { data, error } = await supabase.rpc("seller_list_orders", {
    _search: filters.search || null,
    _status: !filters.status || filters.status === "all" ? null : filters.status,
    _from: filters.from || null,
    _to: filters.to || null,
    _limit: filters.limit ?? 25,
    _offset: filters.offset ?? 0,
  });
  if (error) throw error;
  const rows = await withDisplayCurrency((data || []) as SellerOrderRow[], "orders");
  const total = rows.length > 0 ? Number(rows[0].total_count) : 0;
  return { rows, total };
};

export interface SellerOrderItem {
  id: string;
  product_name: string | null;
  product_image: string | null;
  variant_label: string | null;
  quantity: number;
  price: number;
  currency?: string | null;
  subtotal: number | null;
  tracking_status?: string | null;
  tracking_number?: string | null;
  shipping_carrier?: string | null;
}

export const fetchSellerOrderItems = async (orderId: string): Promise<SellerOrderItem[]> => {
  // Sub-orders keep their items on the parent order; this RPC returns only
  // the items that belong to the current seller (or all of them for admins).
  const { data, error } = await supabase.rpc("seller_order_items", { _order_id: orderId });
  if (error) throw error;
  const rows = (data || []) as SellerOrderItem[];
  if (!rows.length) return rows;
  const { data: snapshots, error: snapshotError } = await supabase.from("order_items").select("id,currency,tracking_status,tracking_number,shipping_carrier").in("id", rows.map((r) => r.id));
  if (snapshotError) throw snapshotError;
  const saved = new Map((snapshots ?? []).map((r) => [r.id, r]));
  return rows.map((r) => {
    const s = saved.get(r.id);
    return { ...r, currency: s?.currency ?? r.currency ?? null, tracking_status: s?.tracking_status ?? null,
      tracking_number: s?.tracking_number ?? null, shipping_carrier: s?.shipping_carrier ?? null };
  });
};

/** Updates only this one order item's tracking; other items are never touched. */
export const updateOrderItemTracking = async (itemId: string, status: string, trackingNumber?: string, carrier?: string) => {
  const { error } = await supabase.rpc("update_order_item_tracking", {
    _item_id: itemId, _status: status,
    _tracking_number: trackingNumber?.trim() || null, _carrier: carrier?.trim() || null,
  });
  if (error) throw error;
};

export interface OrderNote {
  id: string;
  note: string;
  is_internal: boolean;
  author_name: string | null;
  author_role: string | null;
  created_at: string;
}

export const fetchOrderNotes = async (orderId: string): Promise<OrderNote[]> => {
  const { data, error } = await supabase.rpc("list_order_notes", { _order_id: orderId });
  if (error) throw error;
  return (data || []) as OrderNote[];
};

export const addOrderNote = async (orderId: string, note: string, isInternal: boolean) => {
  const { error } = await supabase.rpc("add_order_note", {
    _order_id: orderId,
    _note: note,
    _is_internal: isInternal,
  });
  if (error) throw error;
};

export interface ShippingUpdateInput {
  shippingCompany?: string | null;
  estimatedDelivery?: string | null;
  shippingNotes?: string | null;
}

export const updateSellerOrderShipping = async (orderId: string, input: ShippingUpdateInput) => {
  const { error } = await supabase.rpc("update_order_shipping", {
    _order_id: orderId,
    _shipping_company: input.shippingCompany || null,
    _estimated_delivery: input.estimatedDelivery || null,
    _shipping_notes: input.shippingNotes || null,
  });
  if (error) throw error;
};

export const cancelSellerOrder = async (orderId: string, reason: string) => {
  const { error } = await supabase.rpc("cancel_order", { _order_id: orderId, _reason: reason });
  if (error) throw error;
};
