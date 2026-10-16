import { useCallback, useEffect, useState } from "react";
import { Truck } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { friendlyOrderError } from "@/lib/orderStatus";
import SellerItemTrackingControl from "@/components/seller/SellerItemTrackingControl";
import type { SellerOrderItem } from "@/lib/sellerOrders";

/** Admin-only: per-order shipment tracking switch and per-product shipment statuses.
 *  Changes here never touch the order status itself. */
export default function AdminShipmentTrackingPanel({ orderId, initialEnabled }: { orderId: string; initialEnabled: boolean }) {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<SellerOrderItem[]>([]);

  

  const loadItems = useCallback(async () => {
    const { data, error } = await (supabase.rpc as any)("admin_order_items_tracking", { _order_id: orderId });
    if (!error) setItems((data ?? []) as SellerOrderItem[]);
  }, [orderId]);

  useEffect(() => {
    if (!enabled) return;
    void loadItems();
    const channel = supabase.channel(`admin-item-tracking-${orderId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "order_items" }, () => { void loadItems(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [enabled, loadItems, orderId]);

  const toggle = async (next: boolean) => {
    setBusy(true);
    const { error } = await (supabase.rpc as any)("admin_set_order_shipment_tracking", { _order_id: orderId, _enabled: next });
    setBusy(false);
    if (error) { toast({ title: "خطأ", description: friendlyOrderError(error), variant: "destructive" }); return; }
    setEnabled(next);
    toast({ title: "تم الحفظ", description: next ? "تتبع الشحنات ظاهر للعميل في هذا الطلب" : "تتبع الشحنات مخفي عن العميل" });
  };

  return (
    <div className="rounded border p-3" dir="rtl">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold"><Truck className="h-4 w-4" /> تتبع الشحنات لهذا الطلب</p>
        
      </div>
      {enabled && items.map((it) => (
        <div key={it.id} className="mt-2 rounded bg-muted/50 p-2">
          <p className="truncate text-sm">{it.product_name || "منتج"}</p>
          <SellerItemTrackingControl item={it}
            onSaved={(patch) => setItems((prev) => prev.map((x) => x.id === it.id ? { ...x, ...patch } : x))} />
        </div>
      ))}
    </div>
  );
}
