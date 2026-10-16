import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Package, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import ShipmentTrackingTimeline from "@/components/orders/ShipmentTrackingTimeline";
import { productTrackingLabel, type ProductTrackingHistory } from "@/lib/productTracking";
import { Button } from "@/components/ui/button";
import OrderProductImage from "@/components/orders/OrderProductImage";
import { cn } from "@/lib/utils";
import type { TrackingProduct } from "@/lib/orderShipments";

/** One product = one independent saved tracking status (order_items.tracking_status). */
export default function OrderItemTrackingCard({ item, defaultOpen = false, history = [] }: { item: TrackingProduct; defaultOpen?: boolean; history?: ProductTrackingHistory[] }) {
  const [open, setOpen] = useState(defaultOpen);
  const status = item.tracking_status ?? null;
  return (
    <div className="rounded-md border" dir="rtl" data-item-id={item.id} data-item-status={status ?? ""}>
      <Button type="button" variant="ghost" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="flex h-auto w-full items-start justify-start gap-3 whitespace-normal p-2 text-right transition-colors hover:bg-muted/50">
        {item.product_image ? <OrderProductImage image={item.product_image} orderItemId={item.id} productId={item.product_id} alt={item.product_name ?? "منتج"} className="h-14 w-14 shrink-0 rounded object-cover" />
          : <div className="h-14 w-14 shrink-0 rounded bg-muted flex items-center justify-center"><Package className="h-6 w-6 text-muted-foreground" /></div>}
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium break-words">{item.product_name || "منتج"}</h3>
          {item.variant_label && <p className="text-xs text-muted-foreground break-words">{item.variant_label}</p>}
          <p className="text-xs text-muted-foreground mt-1">الكمية: {item.quantity}</p>
          <Badge variant="secondary" className="mt-1 whitespace-normal">{productTrackingLabel(status)}</Badge>
          {item.tracking_updated_at && <p className="mt-1 text-xs text-muted-foreground">آخر تحديث: {new Date(item.tracking_updated_at).toLocaleString("ar-SY")}</p>}
        </div>
        <ChevronDown className={cn("h-4 w-4 shrink-0 mt-1 transition-transform", open && "rotate-180")} aria-hidden />
      </Button>
      {open && (
        <div className="space-y-3 border-t p-3">
          {(item.tracking_number || item.shipping_carrier) && (
            <p className="flex flex-wrap items-center gap-2 text-xs">
              <Truck className="h-4 w-4 text-muted-foreground" />
              {item.shipping_carrier && <span>{item.shipping_carrier}</span>}
              {item.tracking_number && <span>رقم التتبع: <span dir="ltr" className="font-mono">{item.tracking_number}</span></span>}
            </p>
          )}
          <ShipmentTrackingTimeline status={status} history={history} />
          {item.product_id && <Link to={`/product/${item.product_id}`} className="text-xs text-primary underline">عرض صفحة المنتج</Link>}
        </div>
      )}
    </div>
  );
}
