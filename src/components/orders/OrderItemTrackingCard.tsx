import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Package, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import ShipmentTrackingTimeline from "@/components/orders/ShipmentTrackingTimeline";
import { statusLabel } from "@/lib/orderStatus";
import { cn } from "@/lib/utils";
import type { TrackingProduct } from "@/lib/orderShipments";

/** One product = one independent saved tracking status (order_items.tracking_status). */
export default function OrderItemTrackingCard({ item, defaultOpen = false }: { item: TrackingProduct; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const status = item.tracking_status ?? null;
  return (
    <div className="rounded-md border" data-item-id={item.id} data-item-status={status ?? ""}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="flex w-full items-start gap-3 p-2 text-right transition-colors hover:bg-muted/50">
        {item.product_image ? <img src={item.product_image} alt={item.product_name ?? "منتج"} loading="lazy" className="h-14 w-14 shrink-0 rounded object-cover" />
          : <div className="h-14 w-14 shrink-0 rounded bg-muted flex items-center justify-center"><Package className="h-6 w-6 text-muted-foreground" /></div>}
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium break-words">{item.product_name || "منتج"}</h3>
          {item.variant_label && <p className="text-xs text-muted-foreground break-words">{item.variant_label}</p>}
          <p className="text-xs text-muted-foreground mt-1">الكمية: {item.quantity}</p>
          <Badge variant="secondary" className="mt-1 whitespace-normal">{statusLabel(status) || "حالة المنتج غير متاحة"}</Badge>
        </div>
        <ChevronDown className={cn("h-4 w-4 shrink-0 mt-1 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <div className="space-y-3 border-t p-3">
          {(item.tracking_number || item.shipping_carrier) && (
            <p className="flex flex-wrap items-center gap-2 text-xs">
              <Truck className="h-4 w-4 text-muted-foreground" />
              {item.shipping_carrier && <span>{item.shipping_carrier}</span>}
              {item.tracking_number && <span>رقم التتبع: <span dir="ltr" className="font-mono">{item.tracking_number}</span></span>}
            </p>
          )}
          <ShipmentTrackingTimeline status={status} />
          {item.product_id && <Link to={`/product/${item.product_id}`} className="text-xs text-primary underline">عرض صفحة المنتج</Link>}
        </div>
      )}
    </div>
  );
}
