import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { friendlyOrderError, normalizeStatus, statusLabel } from "@/lib/orderStatus";
import { updateOrderItemTracking, type SellerOrderItem } from "@/lib/sellerOrders";

const NEXT: Record<string, { label: string; target: string }> = {
  pending: { label: "تأكيد المنتج", target: "confirmed" },
  confirmed: { label: "بدء التحضير", target: "preparing" },
  preparing: { label: "جاهز للشحن", target: "ready_for_shipping" },
  ready_for_shipping: { label: "تم الشحن", target: "shipped" },
  shipped: { label: "تم تسليمه إلى مركز الشحن", target: "out_for_delivery" },
  out_for_delivery: { label: "تم التسليم", target: "delivered" },
};

/** Per-product tracking: changes only this order item. */
export default function SellerItemTrackingControl({ item, disabled, onSaved }: { item: SellerOrderItem; disabled?: boolean; onSaved: (patch: Partial<SellerOrderItem>) => void }) {
  const { toast } = useToast();
  const [tn, setTn] = useState(item.tracking_number ?? "");
  const [carrier, setCarrier] = useState(item.shipping_carrier ?? "");
  const [busy, setBusy] = useState(false);
  const status = normalizeStatus(item.tracking_status);
  const next = NEXT[status];

  const save = async (target: string) => {
    setBusy(true);
    try {
      await updateOrderItemTracking(item.id, target, tn, carrier);
      onSaved({ tracking_status: target, tracking_number: tn.trim() || item.tracking_number, shipping_carrier: carrier.trim() || item.shipping_carrier });
      toast({ title: "تم التحديث", description: "تم تحديث حالة هذا المنتج فقط" });
    } catch (e) {
      toast({ title: "خطأ", description: friendlyOrderError(e), variant: "destructive" });
    } finally { setBusy(false); }
  };

  return (
    <div className="mt-2 space-y-2 border-t pt-2">
      <Badge variant="secondary">{statusLabel(status) || "غير متاحة"}</Badge>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input value={carrier} onChange={(e) => setCarrier(e.target.value)} maxLength={100} placeholder="شركة الشحن (اختياري)" disabled={disabled || busy} />
        <Input value={tn} onChange={(e) => setTn(e.target.value)} maxLength={100} placeholder="رقم التتبع (اختياري)" dir="ltr" disabled={disabled || busy} />
      </div>
      <div className="flex flex-wrap gap-2">
        {next && <Button size="sm" onClick={() => save(next.target)} disabled={disabled || busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : next.label}</Button>}
        <Button size="sm" variant="outline" onClick={() => save(status)} disabled={disabled || busy || (!tn.trim() && !carrier.trim())}>حفظ بيانات الشحن</Button>
      </div>
    </div>
  );
}
