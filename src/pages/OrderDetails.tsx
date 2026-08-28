import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ArrowRight, Package, MapPin, Phone, Calendar, Receipt, XCircle, Truck, History, MessageSquare, Send } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import CancelOrderDialog, { canCancelOrder } from "@/components/CancelOrderDialog";
import ReturnRequestDialog from "@/components/ReturnRequestDialog";
import OrderStatusTimeline from "@/components/OrderStatusTimeline";
import OrderTimelineLog from "@/components/orders/OrderTimelineLog";
import OrderHelpActions from "@/components/orders/OrderHelpActions";
import CustomerInvoice from "@/components/orders/CustomerInvoice";
import { useToast } from "@/hooks/use-toast";

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "قيد الانتظار", variant: "secondary" },
  confirmed: { label: "تم التأكيد", variant: "default" },
  preparing: { label: "قيد التجهيز", variant: "secondary" },
  processing: { label: "قيد التجهيز", variant: "secondary" },
  ready_for_shipping: { label: "جاهز للشحن", variant: "outline" },
  shipped: { label: "تم الشحن", variant: "outline" },
  out_for_delivery: { label: "خارج للتوصيل", variant: "outline" },
  delivered: { label: "تم التوصيل", variant: "default" },
  completed: { label: "مكتمل", variant: "default" },
  cancelled: { label: "ملغي", variant: "destructive" },
  return_requested: { label: "طلب إرجاع", variant: "outline" },
  returning: { label: "قيد الإرجاع", variant: "outline" },
  returned: { label: "مرتجع", variant: "outline" },
  refunded: { label: "تم رد المبلغ", variant: "outline" },
};

interface OrderNote {
  id: string;
  note: string;
  author_role: string;
  author_name: string | null;
  is_internal: boolean;
  created_at: string;
}

const ROLE_LABELS: Record<string, string> = {
  buyer: "أنت",
  seller: "البائع",
  admin: "الإدارة",
  system: "النظام",
};

const orderDisplayNumber = (order: any) =>
  order?.order_number || `#${String(order?.id || "").slice(0, 8).toUpperCase()}`;

const OrderDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [shipping, setShipping] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<OrderNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [newNote, setNewNote] = useState("");
  const [submittingNote, setSubmittingNote] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  const loadNotes = useCallback(async () => {
    if (!id) return;
    setNotesLoading(true);
    try {
      const { data, error } = await supabase.rpc("list_order_notes", { _order_id: id });
      if (error) throw error;
      setNotes((data || []) as OrderNote[]);
    } catch (error: any) {
      toast({
        title: "تعذر تحميل الملاحظات",
        description: error?.message || "حدث خطأ أثناء تحميل ملاحظات الطلب",
        variant: "destructive",
      });
    } finally {
      setNotesLoading(false);
    }
  }, [id, toast]);

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
        .select("quantity, price, vendor_id, variant_label, product_name, product_image, discount_amount, subtotal, product:products(id, name, image_url)")
        .eq("order_id", id);
      setItems(oi || []);
      const { data: sd } = await supabase
        .from("shipping_details")
        .select("*")
        .eq("order_id", id)
        .maybeSingle();
      setShipping(sd || null);
      setLoading(false);
    };
    void load();
    void loadNotes();
  }, [id, user, loadNotes]);

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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shipping_details", filter: `order_id=eq.${id}` },
        () => {
          void supabase
            .from("shipping_details")
            .select("*")
            .eq("order_id", id)
            .maybeSingle()
            .then(({ data }) => setShipping(data || null));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, user]);

  const submitNote = async () => {
    if (!newNote.trim() || !id) return;
    setSubmittingNote(true);
    try {
      const { error } = await supabase.rpc("add_order_note", {
        _order_id: id,
        _note: newNote.trim(),
        _is_internal: false,
      });
      if (error) throw error;
      setNewNote("");
      await loadNotes();
    } catch (error: any) {
      toast({
        title: "تعذر إرسال الملاحظة",
        description: error?.message || "حدث خطأ أثناء إرسال الملاحظة",
        variant: "destructive",
      });
    } finally {
      setSubmittingNote(false);
    }
  };

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
  const itemsDiscount = items.reduce((s, it) => s + Number(it.discount_amount || 0), 0);

  const subtotal = Number(order.subtotal_amount || 0) || itemsTotal;
  const discount = Number(order.discount_amount || 0) || itemsDiscount;
  const shippingAmount = Number(order.shipping_amount || 0) ||
    Math.max(0, Number(order.total_amount) - itemsTotal + discount);
  const taxAmount = Number(order.tax_amount || 0);
  const total = Number(order.total_amount || 0) || (subtotal - discount + shippingAmount + taxAmount);

  const shippingCompany = shipping?.shipping_company || order.courier_name || null;
  const trackingNumber = shipping?.tracking_number || order.tracking_number || null;
  const estimatedDelivery = shipping?.estimated_delivery || order.estimated_delivery || null;
  const shippedAt = shipping?.shipped_at || order.shipped_at || null;
  const deliveredAt = shipping?.delivered_at || order.delivered_at || null;
  const shippingNotes = shipping?.shipping_notes || order.shipping_notes || null;
  const hasShippingInfo = !!(shippingCompany || trackingNumber || estimatedDelivery || shippedAt || deliveredAt || shippingNotes);

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
              <span>تفاصيل الطلب {orderDisplayNumber(order)}</span>
              <Badge variant={status.variant}>{status.label}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <OrderStatusTimeline
              status={order.tracking_status || order.status || "pending"}
              className="pb-3"
            />
            {order.invoice_number && (
              <p className="flex items-center gap-2 text-muted-foreground">
                <Receipt className="h-4 w-4" /> رقم الفاتورة: <span className="font-mono">{order.invoice_number}</span>
              </p>
            )}
            <p className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" />
              {format(new Date(order.created_at), "dd MMMM yyyy - HH:mm", { locale: ar })}
            </p>
            {order.shipping_address && (
              <p className="flex items-start gap-2"><MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />{order.shipping_address}</p>
            )}
            {order.phone && <p className="flex items-center gap-2" dir="ltr"><Phone className="h-4 w-4 text-muted-foreground" />{order.phone}</p>}
            {order.notes && <p className="text-muted-foreground bg-muted/50 p-2 rounded">{order.notes}</p>}
            <p className="flex items-center gap-2"><Receipt className="h-4 w-4 text-muted-foreground" />طريقة الدفع: <span className="font-semibold">الدفع عند الاستلام</span></p>
            {order.confirmed_at && (
              <p className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                تاريخ التأكيد: <span className="font-semibold">{format(new Date(order.confirmed_at), "dd MMMM yyyy - HH:mm", { locale: ar })}</span>
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
                  <p className="text-xs text-warning">حالة الاسترداد: قيد المعالجة</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>المنتجات</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {items.map((it, idx) => {
              const name = it.product_name || it.product?.name || "منتج";
              const image = it.product_image || it.product?.image_url || "/placeholder.svg";
              const lineSubtotal = it.subtotal != null ? Number(it.subtotal) : Number(it.price) * it.quantity;
              return (
                <Link to={it.product?.id ? `/product/${it.product.id}` : "#"} key={idx}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/60 transition-colors">
                  <img
                    src={image}
                    alt={name}
                    loading="lazy"
                    decoding="async"
                    className="w-16 h-16 rounded object-cover"
                  />
                  <div className="flex-1">
                    <p className="font-medium">{name}</p>
                    {it.variant_label && <p className="text-xs text-muted-foreground">{it.variant_label}</p>}
                    <p className="text-xs text-muted-foreground">{it.quantity} × {Number(it.price).toLocaleString()} ل.س</p>
                  </div>
                  <p className="font-bold">{lineSubtotal.toLocaleString()} ل.س</p>
                </Link>
              );
            })}
          </CardContent>
        </Card>

        {hasShippingInfo && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Truck className="h-5 w-5" /> معلومات الشحن
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {shippingCompany && <p>شركة الشحن: <span className="font-semibold">{shippingCompany}</span></p>}
              {trackingNumber && (
                <p dir="ltr" className="text-start">رقم التتبع: <span className="font-mono font-semibold">{trackingNumber}</span></p>
              )}
              {estimatedDelivery && (
                <p>موعد التسليم المتوقع: <span className="font-semibold">{format(new Date(estimatedDelivery), "dd MMMM yyyy", { locale: ar })}</span></p>
              )}
              {shippedAt && (
                <p>تاريخ الشحن: <span className="font-semibold">{format(new Date(shippedAt), "dd MMMM yyyy - HH:mm", { locale: ar })}</span></p>
              )}
              {deliveredAt && (
                <p>تاريخ التسليم: <span className="font-semibold">{format(new Date(deliveredAt), "dd MMMM yyyy - HH:mm", { locale: ar })}</span></p>
              )}
              {shippingNotes && <p className="text-muted-foreground">{shippingNotes}</p>}
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
            <div className="flex justify-between"><span className="text-muted-foreground">المنتجات</span><span>{subtotal.toLocaleString()} ل.س</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">الشحن</span><span>{shippingAmount > 0 ? `${shippingAmount.toLocaleString()} ل.س` : "مجاني"}</span></div>
            {discount > 0 && (
              <div className="flex justify-between text-success"><span>الخصم {order.coupon_code ? `(${order.coupon_code})` : ""}</span><span>-{discount.toLocaleString()} ل.س</span></div>
            )}
            {taxAmount > 0 && (
              <div className="flex justify-between"><span className="text-muted-foreground">الضريبة</span><span>{taxAmount.toLocaleString()} ل.س</span></div>
            )}
            <div className="border-t pt-2 mt-2 flex justify-between font-bold text-lg">
              <span>الإجمالي</span><span className="text-primary">{total.toLocaleString()} ل.س</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-5 w-5" /> ملاحظات الطلب
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {notesLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : notes.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا توجد ملاحظات على هذا الطلب بعد.</p>
            ) : (
              <div className="space-y-3">
                {notes.map((n) => (
                  <div key={n.id} className="rounded-lg bg-muted/30 p-3 text-sm space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{n.author_name || ROLE_LABELS[n.author_role] || n.author_role}</span>
                      <Badge variant="outline" className="text-[10px]">{ROLE_LABELS[n.author_role] || n.author_role}</Badge>
                      <span className="text-xs text-muted-foreground mr-auto">
                        {format(new Date(n.created_at), "dd MMMM yyyy - HH:mm", { locale: ar })}
                      </span>
                    </div>
                    <p>{n.note}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="أضف ملاحظة على الطلب..."
                maxLength={500}
              />
              <Button
                size="sm"
                className="self-end gap-2"
                onClick={submitNote}
                disabled={submittingNote || !newNote.trim()}
              >
                {submittingNote ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                إرسال
              </Button>
            </div>
          </CardContent>
        </Card>

        <Button variant="outline" className="w-full" onClick={() => navigate(`/orders/track/${order.id}`)}>
          تتبع الطلب
        </Button>
        {order.status !== "cancelled" && <CustomerInvoice orderId={order.id} />}
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
          <OrderHelpActions orderId={order.id} vendorId={items[0]?.vendor_id} />
        )}
      </main>
      <Footer />
    </div>
  );
};

export default OrderDetails;
