import { useEffect, useMemo, useState } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Lock, Phone, MapPin, User, Package, Truck, Ban } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import OrderStatusBadge from "@/components/orders/OrderStatusBadge";
import OrderTimelineLog from "@/components/orders/OrderTimelineLog";
import PrintOrderDocs from "@/components/seller/PrintOrderDocs";
import SellerOrderNotes from "@/components/seller/SellerOrderNotes";
import SellerOrderShippingForm from "@/components/seller/SellerOrderShippingForm";
import { changeOrderStatus, friendlyOrderError, normalizeStatus, type OrderStatus } from "@/lib/orderStatus";
import {
  cancelSellerOrder, fetchSellerOrderItems, type SellerOrderItem, type SellerOrderRow,
} from "@/lib/sellerOrders";

interface Props {
  order: SellerOrderRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}

interface SellerAction {
  key: string;
  label: string;
  target: OrderStatus;
  variant?: "default" | "outline" | "destructive";
  requiresTracking?: boolean;
}

const ACTIONS_BY_STATUS: Record<string, SellerAction[]> = {
  pending: [{ key: "confirm", label: "تأكيد الطلب", target: "confirmed" }],
  confirmed: [{ key: "prepare", label: "بدء التحضير", target: "preparing" }],
  preparing: [{ key: "ready", label: "جاهز للشحن", target: "ready_for_shipping" }],
  ready_for_shipping: [{ key: "ship", label: "تم الشحن", target: "shipped", requiresTracking: true }],
  shipped: [{ key: "out", label: "خرج للتوصيل", target: "out_for_delivery" }],
  out_for_delivery: [{ key: "delivered", label: "تم التسليم", target: "delivered" }],
};

const CANCELLABLE = ["pending", "confirmed", "preparing", "ready_for_shipping"];

const SellerOrderDetailSheet = ({ order, open, onOpenChange, onChanged }: Props) => {
  const { toast } = useToast();
  const [items, setItems] = useState<SellerOrderItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [localOrder, setLocalOrder] = useState<SellerOrderRow | null>(order);

  useEffect(() => setLocalOrder(order), [order]);

  useEffect(() => {
    if (!open || !order) return;
    let active = true;
    setLoadingItems(true);
    fetchSellerOrderItems(order.id)
      .then((rows) => { if (active) setItems(rows); })
      .catch((e) => toast({ title: "خطأ", description: friendlyOrderError(e), variant: "destructive" }))
      .finally(() => { if (active) setLoadingItems(false); });
    return () => { active = false; };
  }, [open, order?.id]);

  const status = normalizeStatus(localOrder?.status);
  const frozen = !!localOrder?.is_frozen;
  const actions = useMemo(() => ACTIONS_BY_STATUS[status] || [], [status]);
  const canCancel = CANCELLABLE.includes(status);

  const printData = useMemo(() => {
    if (!localOrder) return null;
    return {
      id: localOrder.id,
      created_at: localOrder.created_at,
      status: localOrder.status,
      customer_name: localOrder.customer_name,
      city: localOrder.city,
      items: items.map((i) => ({ name: i.product_name || "منتج", quantity: i.quantity, price: i.price })),
    };
  }, [localOrder, items]);

  const runAction = async (action: SellerAction) => {
    if (!localOrder) return;
    if (action.requiresTracking && !localOrder.tracking_number) {
      toast({
        title: "بيانات الشحن ناقصة",
        description: "يرجى إدخال شركة الشحن ورقم التتبع قبل تأكيد الشحن.",
        variant: "destructive",
      });
      return;
    }
    setActing(action.key);
    try {
      await changeOrderStatus(localOrder.id, action.target);
      toast({ title: "تم التحديث", description: "تم تحديث حالة الطلب بنجاح" });
      setLocalOrder({ ...localOrder, status: action.target });
      onChanged();
    } catch (e) {
      toast({ title: "خطأ", description: friendlyOrderError(e), variant: "destructive" });
    } finally {
      setActing(null);
    }
  };

  const runCancel = async () => {
    if (!localOrder || !cancelReason.trim()) return;
    setActing("cancel");
    try {
      await cancelSellerOrder(localOrder.id, cancelReason.trim());
      toast({ title: "تم الإلغاء", description: "تم رفض/إلغاء الطلب" });
      setLocalOrder({ ...localOrder, status: "cancelled" });
      setCancelOpen(false);
      setCancelReason("");
      onChanged();
    } catch (e) {
      toast({ title: "خطأ", description: friendlyOrderError(e), variant: "destructive" });
    } finally {
      setActing(null);
    }
  };

  if (!localOrder) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-full overflow-y-auto sm:max-w-xl" dir="rtl">
        <SheetHeader className="text-right">
          <SheetTitle className="flex flex-wrap items-center gap-2">
            طلب #{localOrder.order_number || localOrder.id.slice(0, 8)}
            <OrderStatusBadge status={localOrder.status} />
            {frozen && (
              <Badge variant="destructive" className="gap-1">
                <Lock className="h-3 w-3" /> مجمّد إداريًا
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            {new Date(localOrder.created_at).toLocaleString("ar-SY", {
              year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
            })}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <div className="grid gap-2 rounded-lg border p-3 text-sm sm:grid-cols-2">
            <div className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" /> {localOrder.customer_name || "غير متوفر"}</div>
            <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> {localOrder.customer_phone || "غير متوفر"}</div>
            <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /> {localOrder.city || "غير محددة"}</div>
            <div className="flex items-center gap-2"><Package className="h-4 w-4 text-muted-foreground" /> {localOrder.items_count} منتج · إجمالي {Number(localOrder.vendor_subtotal || 0).toLocaleString("ar-SY")} ل.س</div>
          </div>

          {printData && (
            <div className="flex flex-wrap gap-2">
              <PrintOrderDocs order={printData} />
            </div>
          )}

          <div className="flex flex-wrap gap-2 border-t pt-3">
            {frozen ? (
              <p className="text-sm text-muted-foreground">هذا الطلب مجمّد من قبل الإدارة، لا يمكن تنفيذ أي إجراء عليه حاليًا.</p>
            ) : (
              <>
                {actions.map((a) => (
                  <Button key={a.key} size="sm" onClick={() => runAction(a)} disabled={acting !== null}>
                    {acting === a.key ? <Loader2 className="h-4 w-4 animate-spin" /> : a.label}
                  </Button>
                ))}
                {canCancel && (
                  <Button size="sm" variant="destructive" className="gap-1" onClick={() => setCancelOpen(true)} disabled={acting !== null}>
                    <Ban className="h-4 w-4" /> رفض الطلب
                  </Button>
                )}
                {actions.length === 0 && !canCancel && (
                  <p className="text-sm text-muted-foreground">لا توجد إجراءات متاحة على هذه الحالة.</p>
                )}
              </>
            )}
          </div>

          <Tabs defaultValue="items" className="pt-2">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="items">المنتجات</TabsTrigger>
              <TabsTrigger value="shipping">الشحن</TabsTrigger>
              <TabsTrigger value="timeline">السجل الزمني</TabsTrigger>
              <TabsTrigger value="notes">الملاحظات</TabsTrigger>
            </TabsList>

            <TabsContent value="items" className="space-y-2 pt-3">
              {loadingItems ? (
                <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
              ) : items.length === 0 ? (
                <p className="text-sm text-muted-foreground">لا توجد منتجات.</p>
              ) : (
                items.map((it) => (
                  <div key={it.id} className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
                    <img loading="lazy" decoding="async" src={it.product_image || "/placeholder.svg"} alt={it.product_name || ""} className="h-12 w-12 rounded object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{it.product_name || "منتج"}</p>
                      {it.variant_label && <p className="text-xs text-muted-foreground">{it.variant_label}</p>}
                      <p className="text-xs text-muted-foreground">الكمية: {it.quantity} × {Number(it.price).toLocaleString("ar-SY")} ل.س</p>
                    </div>
                    <p className="text-sm font-semibold">
                      {Number(it.subtotal ?? it.quantity * it.price).toLocaleString("ar-SY")} ل.س
                    </p>
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="shipping" className="pt-3">
              <SellerOrderShippingForm
                order={localOrder}
                disabled={frozen}
                onSaved={() => onChanged()}
              />
            </TabsContent>

            <TabsContent value="timeline" className="pt-3">
              <OrderTimelineLog orderId={localOrder.id} />
            </TabsContent>

            <TabsContent value="notes" className="pt-3">
              <SellerOrderNotes orderId={localOrder.id} />
            </TabsContent>
          </Tabs>
        </div>

        <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle>رفض / إلغاء الطلب</AlertDialogTitle>
              <AlertDialogDescription>يرجى ذكر سبب الرفض، سيتم إشعار العميل بذلك.</AlertDialogDescription>
            </AlertDialogHeader>
            <Textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="سبب الرفض..."
              rows={3}
              maxLength={300}
            />
            <AlertDialogFooter>
              <AlertDialogCancel>تراجع</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => { e.preventDefault(); runCancel(); }}
                disabled={!cancelReason.trim() || acting === "cancel"}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {acting === "cancel" ? <Loader2 className="h-4 w-4 animate-spin" /> : "تأكيد الرفض"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
};

export default SellerOrderDetailSheet;
