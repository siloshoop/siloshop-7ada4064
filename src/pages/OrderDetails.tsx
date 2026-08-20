import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowRight, Package, MapPin, Phone, Calendar, Receipt, XCircle, Truck, History } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import CancelOrderDialog, { canCancelOrder } from "@/components/CancelOrderDialog";
import ReturnRequestDialog from "@/components/ReturnRequestDialog";
import OrderStatusTimeline from "@/components/OrderStatusTimeline";
import OrderTimelineLog from "@/components/orders/OrderTimelineLog";
import OrderHelpActions from "@/components/orders/OrderHelpActions";

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "قيد المعالجة", variant: "secondary" },
  confirmed: { label: "مؤكد", variant: "default" },
  processing: { label: "قيد التحضير", variant: "secondary" },
  shipped: { label: "تم الشحن", variant: "outline" },
  out_for_delivery: { label: "في الطريق للتوصيل", variant: "outline" },
  delivered: { label: "تم التوصيل", variant: "default" },
  cancelled: { label: "ملغي", variant: "destructive" },
};

const OrderDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const load = async () => {
      if (!user || !id) return;
      setLoading(true);
      const { data: ord } = await supabase
        .from("orders")
        .select("*")
        .eq("id", id)
        .eq("customer_id", user.id)
        .maybeSingle();
      if (!ord) { setLoading(false); return; }
      setOrder(ord);
      const { data: oi } = await supabase
        .from("order_items")
        .select("quantity, price, vendor_id, product:products(id, name, image_url)")
        .eq("order_id", id);
      setItems(oi || []);
      setLoading(false);
    };
    void load();
  }, [id, user]);

  // Realtime: reflect status updates from vendor/admin immediately
  useEffect(() => {
    if (!user || !id) return;
    const channel = supabase
      .channel(`order-detail-${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${id}` },
        (payload) => {
          setOrder((prev: any) => (prev ? { ...prev, ...(payload.new as any) } : prev));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, user]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex flex-col"><Navbar />
        <div className="flex-1 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        <Footer />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex flex-col"><Navbar />
        <main className="flex-1 container px-4 py-12 text-center space-y-4">
          <Package className="h-16 w-16 mx-auto text-muted-foreground" />
          <h1 className="text-xl font-bold">الطلب غير موجود</h1>
          <Button onClick={() => navigate("/orders")}>العودة للطلبات</Button>
        </main>
        <Footer />
      </div>
    );
  }

  const status = statusMap[order.status || "pending"] || statusMap.pending;
  const itemsTotal = items.reduce((s, it) => s + Number(it.price) * it.quantity, 0);
  const discount = Number(order.discount_amount || 0);
  const shipping = Math.max(0, Number(order.total_amount) - itemsTotal + discount);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container px-4 py-6 sm:py-8 space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/orders")}>
          <ArrowRight className="h-4 w-4 ml-1" /> العودة للطلبات
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <span>تفاصيل الطلب #{order.id.slice(0, 8)}</span>
              <Badge variant={status.variant}>{status.label}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <OrderStatusTimeline
              status={order.tracking_status || order.status || "pending"}
              className="pb-3"
            />
            <p className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" />
              {format(new Date(order.created_at), "dd MMMM yyyy - HH:mm", { locale: ar })}
            </p>
            {order.shipping_address && (
              <p className="flex items-start gap-2"><MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />{order.shipping_address}</p>
            )}
            {order.phone && <p className="flex items-center gap-2" dir="ltr"><Phone className="h-4 w-4 text-muted-foreground" />{order.phone}</p>}
            {order.notes && <p className="text-muted-foreground bg-muted/50 p-2 rounded">{order.notes}</p>}
            <p className="flex items-center gap-2"><Receipt className="h-4 w-4 text-muted-foreground" />طريقة الدفع: <span className="font-semibold">الدفع عند الاستلام</span></p>
            {order.estimated_delivery && (
              <p className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                موعد التسليم المتوقع:{" "}
                <span className="font-semibold">
                  {format(new Date(order.estimated_delivery), "dd MMMM yyyy", { locale: ar })}
                </span>
              </p>
            )}
            {order.status === "cancelled" && order.cancellation_reason && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-1">
                <p className="flex items-center gap-2 font-semibold text-destructive">
                  <XCircle className="h-4 w-4" /> تم إلغاء الطلب
                </p>
                <p className="text-muted-foreground">
                  السبب: <span className="text-foreground">{order.cancellation_reason}</span>
                </p>
                {order.cancelled_at && (
                  <p className="text-xs text-muted-foreground">
                    بتاريخ {format(new Date(order.cancelled_at), "dd MMMM yyyy - HH:mm", { locale: ar })}
                    {order.cancelled_by_role ? ` — بواسطة ${
                      order.cancelled_by_role === "buyer" ? "المشتري" :
                      order.cancelled_by_role === "seller" ? "البائع" : "الإدارة"
                    }` : ""}
                  </p>
                )}
                {order.payment_status === "refund_pending" && (
                  <p className="text-xs text-amber-600">حالة الاسترداد: قيد المعالجة</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>المنتجات</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {items.map((it, idx) => (
              <Link to={it.product?.id ? `/product/${it.product.id}` : "#"} key={idx}
                className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/60 transition-colors">
                <img
                  src={it.product?.image_url || "/placeholder.svg"}
                  alt={it.product?.name ?? "منتج"}
                  loading="lazy"
                  decoding="async"
                  className="w-16 h-16 rounded object-cover"
                />
                <div className="flex-1">
                  <p className="font-medium">{it.product?.name || "منتج"}</p>
                  <p className="text-xs text-muted-foreground">{it.quantity} × {Number(it.price).toLocaleString()} ل.س</p>
                </div>
                <p className="font-bold">{(Number(it.price) * it.quantity).toLocaleString()} ل.س</p>
              </Link>
            ))}
          </CardContent>
        </Card>

        {(order.courier_name || order.tracking_number || order.driver_name || order.delivery_notes) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Truck className="h-5 w-5" /> معلومات الشحن
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {order.courier_name && <p>شركة الشحن: <span className="font-semibold">{order.courier_name}</span></p>}
              {order.tracking_number && (
                <p dir="ltr" className="text-start">رقم التتبع: <span className="font-mono font-semibold">{order.tracking_number}</span></p>
              )}
              {order.driver_name && (
                <p>مندوب التوصيل: <span className="font-semibold">{order.driver_name}</span>
                  {order.driver_phone ? <span dir="ltr"> ({order.driver_phone})</span> : null}
                </p>
              )}
              {order.delivery_notes && <p className="text-muted-foreground">{order.delivery_notes}</p>}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-5 w-5" /> سجل تحديثات الطلب
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <OrderTimelineLog orderId={order.id} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" />ملخص الفاتورة</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">المجموع الفرعي</span><span>{itemsTotal.toLocaleString()} ل.س</span></div>
            {discount > 0 && (
              <div className="flex justify-between text-green-600"><span>الخصم {order.coupon_code ? `(${order.coupon_code})` : ""}</span><span>-{discount.toLocaleString()} ل.س</span></div>
            )}
            <div className="flex justify-between"><span className="text-muted-foreground">التوصيل</span><span>{shipping > 0 ? `${shipping.toLocaleString()} ل.س` : "مجاني"}</span></div>
            <div className="border-t pt-2 mt-2 flex justify-between font-bold text-lg">
              <span>الإجمالي</span><span className="text-primary">{Number(order.total_amount).toLocaleString()} ل.س</span>
            </div>
          </CardContent>
        </Card>

        <Button variant="outline" className="w-full" onClick={() => navigate(`/orders/track/${order.id}`)}>
          تتبع الطلب
        </Button>
        <CancelOrderDialog
          orderId={order.id}
          status={order.status}
          trackingStatus={order.tracking_status}
          variant="destructive"
          size="default"
          onCancelled={() => {
            setOrder((prev: any) => prev ? { ...prev, status: "cancelled" } : prev);
          }}
        />
        <ReturnRequestDialog
          order={{ id: order.id, status: order.status, delivered_at: order.delivered_at }}
          variant="default"
          size="default"
          fullWidth
        />
        <Button variant="ghost" size="sm" className="w-full" onClick={() => navigate("/my-returns")}>
          عرض طلبات الإرجاع
        </Button>
        {order.status !== "cancelled" && !canCancelOrder(order.status, order.tracking_status) && (
          <OrderHelpActions vendorId={items[0]?.vendor_id} />
        )}
      </main>
      <Footer />
    </div>
  );
};

export default OrderDetails;