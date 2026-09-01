import { useEffect, useState, lazy, Suspense } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import OrderStatusTimeline from "@/components/OrderStatusTimeline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Loader2, Package, MapPin, Clock, Truck, ExternalLink, RefreshCw, Wifi, WifiOff,
  XCircle, RotateCcw, FileText, CreditCard, StickyNote,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { ORDER_STATUS_LABELS, ACTOR_ROLE_LABELS } from "@/lib/orderStatus";

const OrderTrackingMap = lazy(() => import("@/components/orders/OrderTrackingMap"));

// روابط تتبع شركات الشحن
const courierTrackingUrls: Record<string, (trackingNumber: string) => string> = {
  'aramex': (tn) => `https://www.aramex.com/track/results?ShipmentNumber=${tn}`,
  'أرامكس': (tn) => `https://www.aramex.com/track/results?ShipmentNumber=${tn}`,
  'dhl': (tn) => `https://www.dhl.com/global-en/home/tracking/tracking-express.html?submit=1&tracking-id=${tn}`,
  'دي اتش ال': (tn) => `https://www.dhl.com/global-en/home/tracking/tracking-express.html?submit=1&tracking-id=${tn}`,
  'fedex': (tn) => `https://www.fedex.com/fedextrack/?trknbr=${tn}`,
  'فيديكس': (tn) => `https://www.fedex.com/fedextrack/?trknbr=${tn}`,
  'ups': (tn) => `https://www.ups.com/track?tracknum=${tn}`,
  'يو بي اس': (tn) => `https://www.ups.com/track?tracknum=${tn}`,
  'smsa': (tn) => `https://www.smsaexpress.com/trackshipment?tracknumbers=${tn}`,
  'سمسا': (tn) => `https://www.smsaexpress.com/trackshipment?tracknumbers=${tn}`,
  'zajil': (tn) => `https://www.zajil.com/track?id=${tn}`,
  'زاجل': (tn) => `https://www.zajil.com/track?id=${tn}`,
  'saudi post': (tn) => `https://www.splonline.com.sa/track/${tn}`,
  'البريد السعودي': (tn) => `https://www.splonline.com.sa/track/${tn}`,
  'j&t': (tn) => `https://www.jtexpress.sa/track?id=${tn}`,
  'جي اند تي': (tn) => `https://www.jtexpress.sa/track?id=${tn}`,
  'naqel': (tn) => `https://naqelexpress.com/en/track/${tn}`,
  'ناقل': (tn) => `https://naqelexpress.com/en/track/${tn}`,
};

const getTrackingUrl = (courierName: string | null, trackingNumber: string): string | null => {
  if (!courierName || !trackingNumber) return null;
  const normalizedName = courierName.toLowerCase().trim();
  const urlGenerator = courierTrackingUrls[normalizedName];
  return urlGenerator ? urlGenerator(trackingNumber) : null;
};

// حالات إضافية لا يغطيها الشريط الأساسي (مسار الإرجاع/الاسترداد)
const EXTRA_STATUS_LABELS: Record<string, string> = {
  return_requested: "طلب إرجاع",
  returning: "جارٍ الإرجاع",
  refunded: "تم رد المبلغ",
};

const statusLabel = (status?: string | null): string => {
  const s = (status || "").trim().toLowerCase();
  const normalized = s === "processing" ? "preparing" : s;
  return ORDER_STATUS_LABELS[normalized] ?? EXTRA_STATUS_LABELS[normalized] ?? status ?? "";
};

const DESTRUCTIVE_STATUSES = new Set(["cancelled", "return_requested", "returning", "returned", "refunded"]);

const getBadgeVariant = (status: string): "default" | "outline" | "destructive" | "secondary" => {
  if (status === "cancelled") return "destructive";
  if (["return_requested", "returning", "returned", "refunded"].includes(status)) return "secondary";
  return "default";
};

interface OrderItem {
  quantity: number;
  price: number;
  product_name: string | null;
  product_image: string | null;
  variant_label: string | null;
}

interface ShippingDetails {
  shipping_company: string | null;
  tracking_number: string | null;
  estimated_delivery: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  shipping_notes: string | null;
}

interface Order {
  id: string;
  order_number: string | null;
  invoice_number: string | null;
  created_at: string;
  total_amount: number;
  subtotal_amount: number | null;
  shipping_amount: number | null;
  discount_amount: number | null;
  tax_amount: number | null;
  payment_method: string | null;
  status: string;
  tracking_status: string;
  tracking_number: string | null;
  courier_name: string | null;
  estimated_delivery: string | null;
  shipping_address: string | null;
  shipping_notes: string | null;
  current_location_lat: number | null;
  current_location_lng: number | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  confirmed_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  order_items: OrderItem[];
  shipping_details: ShippingDetails | ShippingDetails[] | null;
}

interface TrackingHistoryRow {
  status: string;
  description: string | null;
  actor_role: string | null;
  created_at: string;
}

const formatMoney = (n: number | null | undefined) =>
  `${new Intl.NumberFormat("ar-SY", { maximumFractionDigits: 0 }).format(Math.round(Number(n) || 0))} ل.س`;

const TrackOrder = () => {
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [statusHistory, setStatusHistory] = useState<TrackingHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isLive, setIsLive] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  const [, forceTick] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    fetchOrder();
    fetchStatusHistory();

    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let realtimeConnected = false;

    // Start polling as fallback - will be cancelled when realtime connects
    const startPolling = () => {
      if (pollInterval) return;
      pollInterval = setInterval(() => {
        fetchOrder();
        fetchStatusHistory();
      }, 30000);
    };

    const stopPolling = () => {
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    };

    // Subscribe to realtime updates across order-related tables
    const channel = supabase
      .channel(`order-updates-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'order_status_history',
          filter: `order_id=eq.${id}`,
        },
        () => {
          fetchOrder();
          fetchStatusHistory();
          setHighlightedIndex(0);
          setTimeout(() => setHighlightedIndex(null), 3000);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tracking_history',
          filter: `order_id=eq.${id}`,
        },
        () => {
          fetchOrder();
          fetchStatusHistory();
          setHighlightedIndex(0);
          setTimeout(() => setHighlightedIndex(null), 3000);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${id}`,
        },
        () => {
          fetchOrder();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'shipping_details',
          filter: `order_id=eq.${id}`,
        },
        () => {
          fetchOrder();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'shipping_details',
          filter: `order_id=eq.${id}`,
        },
        () => {
          fetchOrder();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Realtime is live: stop polling
          realtimeConnected = true;
          setIsLive(true);
          stopPolling();
        } else if (
          status === 'CHANNEL_ERROR' ||
          status === 'TIMED_OUT' ||
          status === 'CLOSED'
        ) {
          // Realtime unavailable: fall back to polling every 30s
          realtimeConnected = false;
          setIsLive(false);
          startPolling();
        }
      });

    // Initial safety net: if realtime hasn't connected within 5s, start polling
    const fallbackTimer = setTimeout(() => {
      if (!realtimeConnected) startPolling();
    }, 5000);

    return () => {
      clearTimeout(fallbackTimer);
      stopPolling();
      supabase.removeChannel(channel);
    };
  }, [id, user]);

  // Tick every 30s to refresh "since" label
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const fetchOrder = async () => {
    if (!user || !id) return;

    const { data, error } = await supabase
      .from("orders")
      .select(`
        *,
        order_items(quantity, price, product_name, product_image, variant_label),
        shipping_details(shipping_company, tracking_number, estimated_delivery, shipped_at, delivered_at, shipping_notes)
      `)
      .eq("id", id)
      .eq("customer_id", user.id)
      .maybeSingle();

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    setOrder(data as unknown as Order);
    setLoading(false);
    setLastUpdated(new Date());
  };

  const fetchStatusHistory = async () => {
    if (!id) return;

    const { data, error } = await supabase
      .from("tracking_history")
      .select("status, description, actor_role, created_at")
      .eq("order_id", id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setStatusHistory(data as TrackingHistoryRow[]);
      setLastUpdated(new Date());
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 container px-4 py-8">
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="h-8 w-64 bg-muted animate-pulse rounded" />
            <div className="h-4 w-40 bg-muted animate-pulse rounded" />
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="space-y-6">
                <div className="h-64 bg-muted animate-pulse rounded-lg" />
                <div className="h-40 bg-muted animate-pulse rounded-lg" />
              </div>
              <div className="space-y-6">
                <div className="h-64 bg-muted animate-pulse rounded-lg" />
                <div className="h-40 bg-muted animate-pulse rounded-lg" />
              </div>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">الطلب غير موجود</h2>
            <p className="text-muted-foreground">تأكد من رابط التتبع أو أنك مسجّل بالحساب الصحيح.</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const currentStatus = (order.tracking_status || order.status || "pending").trim().toLowerCase();
  const normalizedStatus = currentStatus === "processing" ? "preparing" : currentStatus;
  const isDestructiveState = DESTRUCTIVE_STATUSES.has(normalizedStatus);

  const shippingInfo: ShippingDetails | null = Array.isArray(order.shipping_details)
    ? order.shipping_details[0] ?? null
    : order.shipping_details ?? null;

  const shippingCompany = shippingInfo?.shipping_company || order.courier_name;
  const trackingNumber = shippingInfo?.tracking_number || order.tracking_number;
  const estimatedDelivery = shippingInfo?.estimated_delivery || order.estimated_delivery;
  const shippingNotes = shippingInfo?.shipping_notes || order.shipping_notes;

  // Build the visible timeline: prefer tracking_history rows, fall back to order milestones.
  const timelineEntries: TrackingHistoryRow[] = statusHistory.length
    ? statusHistory
    : [
        order.completed_at && { status: "completed", description: null, actor_role: "system", created_at: order.completed_at },
        order.cancelled_at && { status: "cancelled", description: order.cancellation_reason, actor_role: "system", created_at: order.cancelled_at },
        order.delivered_at && { status: "delivered", description: null, actor_role: "system", created_at: order.delivered_at },
        order.shipped_at && { status: "shipped", description: null, actor_role: "system", created_at: order.shipped_at },
        order.confirmed_at && { status: "confirmed", description: null, actor_role: "system", created_at: order.confirmed_at },
        { status: "pending", description: null, actor_role: "system", created_at: order.created_at },
      ].filter(Boolean) as TrackingHistoryRow[];

  const latestNote = timelineEntries[0]?.description ?? null;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">تتبع الطلب</h1>
            <p className="text-muted-foreground">
              رقم الطلب: {order.order_number || order.id.slice(0, 8)}
              {order.invoice_number && <span className="mx-2">· فاتورة: {order.invoice_number}</span>}
            </p>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <Badge variant={isLive ? "default" : "outline"} className="gap-1">
                {isLive ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                {isLive ? "تحديث فوري" : "تحديث دوري"}
              </Badge>
              <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
                <RefreshCw className="h-3 w-3" />
                آخر تحديث: {formatDistanceToNow(lastUpdated, { addSuffix: true, locale: ar })}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => {
                  fetchOrder();
                  fetchStatusHistory();
                }}
              >
                تحديث الآن
              </Button>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Order Details */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>تفاصيل الطلب</span>
                    <Badge variant={getBadgeVariant(normalizedStatus)}>
                      {statusLabel(normalizedStatus)}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isDestructiveState ? (
                    <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
                      {normalizedStatus === "cancelled" ? (
                        <XCircle className="h-6 w-6 shrink-0 text-destructive" />
                      ) : (
                        <RotateCcw className="h-6 w-6 shrink-0 text-destructive" />
                      )}
                      <div>
                        <p className="font-semibold">
                          {normalizedStatus === "cancelled" && "تم إلغاء هذا الطلب"}
                          {normalizedStatus === "return_requested" && "تم تقديم طلب إرجاع"}
                          {normalizedStatus === "returning" && "الطلب قيد الإرجاع"}
                          {normalizedStatus === "returned" && "تم إرجاع هذا الطلب"}
                          {normalizedStatus === "refunded" && "تم رد المبلغ إلى العميل"}
                        </p>
                        {order.cancellation_reason && (
                          <p className="text-sm text-muted-foreground mt-1">
                            السبب: {order.cancellation_reason}
                          </p>
                        )}
                        {!order.cancellation_reason && latestNote && (
                          <p className="text-sm text-muted-foreground mt-1">{latestNote}</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <OrderStatusTimeline
                      status={normalizedStatus}
                      latestNote={latestNote}
                      className="pb-2"
                    />
                  )}

                  <div className="flex items-center gap-3 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">تاريخ الطلب:</span>
                    <span className="font-medium">
                      {format(new Date(order.created_at), "dd MMM yyyy - HH:mm", { locale: ar })}
                    </span>
                  </div>

                  {order.payment_method && (
                    <div className="flex items-center gap-3 text-sm">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">طريقة الدفع:</span>
                      <span className="font-medium">{order.payment_method}</span>
                    </div>
                  )}

                  {trackingNumber && (
                    <div className="flex items-center gap-3 text-sm">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">رقم التتبع:</span>
                      <span className="font-medium font-mono">{trackingNumber}</span>
                    </div>
                  )}

                  {shippingCompany && (
                    <div className="flex items-center gap-3 text-sm">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">شركة الشحن:</span>
                      <span className="font-medium">{shippingCompany}</span>
                    </div>
                  )}

                  {/* زر تتبع الشحنة المباشر */}
                  {trackingNumber && shippingCompany && (
                    <div className="pt-2">
                      {getTrackingUrl(shippingCompany, trackingNumber) ? (
                        <Button
                          className="w-full"
                          onClick={() => {
                            const url = getTrackingUrl(shippingCompany, trackingNumber);
                            if (url) window.open(url, '_blank');
                          }}
                        >
                          <ExternalLink className="h-4 w-4 ml-2" />
                          تتبع الشحنة عبر {shippingCompany}
                        </Button>
                      ) : (
                        <div className="p-3 bg-muted rounded-lg">
                          <p className="text-sm text-muted-foreground text-center">
                            يمكنك تتبع شحنتك باستخدام رقم التتبع: <span className="font-mono font-bold">{trackingNumber}</span>
                          </p>
                          <p className="text-xs text-muted-foreground text-center mt-1">
                            عبر موقع شركة الشحن: {shippingCompany}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {estimatedDelivery && (
                    <div className="flex items-center gap-3 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">التسليم المتوقع:</span>
                      <span className="font-medium">
                        {format(new Date(estimatedDelivery), "dd MMM yyyy", { locale: ar })}
                      </span>
                    </div>
                  )}

                  {order.shipping_address && (
                    <div className="flex items-start gap-3 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-1" />
                      <div>
                        <span className="text-muted-foreground">عنوان التسليم:</span>
                        <p className="font-medium mt-1">{order.shipping_address}</p>
                      </div>
                    </div>
                  )}

                  {shippingNotes && (
                    <div className="flex items-start gap-3 text-sm">
                      <StickyNote className="h-4 w-4 text-muted-foreground mt-1" />
                      <div>
                        <span className="text-muted-foreground">ملاحظات الشحن:</span>
                        <p className="font-medium mt-1">{shippingNotes}</p>
                      </div>
                    </div>
                  )}

                  <Separator />

                  {/* Totals breakdown */}
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">منتجات:</span>
                      <span className="font-medium">{formatMoney(order.subtotal_amount ?? order.total_amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">الشحن:</span>
                      <span className="font-medium">{formatMoney(order.shipping_amount)}</span>
                    </div>
                    {!!order.discount_amount && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">الخصم:</span>
                        <span className="font-medium text-primary">- {formatMoney(order.discount_amount)}</span>
                      </div>
                    )}
                    {!!order.tax_amount && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">الضريبة:</span>
                        <span className="font-medium">{formatMoney(order.tax_amount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-lg font-bold pt-2 border-t">
                      <span>الإجمالي:</span>
                      <span className="text-primary">{formatMoney(order.total_amount)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Status History */}
              <Card>
                <CardHeader>
                  <CardTitle>سجل التتبع</CardTitle>
                </CardHeader>
                <CardContent>
                  {timelineEntries.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      لا توجد تحديثات بعد
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {timelineEntries.map((update, index) => {
                        const uStatus = (update.status || "").trim().toLowerCase();
                        const uNormalized = uStatus === "processing" ? "preparing" : uStatus;
                        const isBad = DESTRUCTIVE_STATUSES.has(uNormalized);
                        return (
                          <div
                            key={index}
                            className={`flex gap-4 pb-4 border-b last:border-0 transition-colors rounded-md ${
                              highlightedIndex === index ? "bg-primary/10 animate-pulse" : ""
                            }`}
                          >
                            <div className="flex flex-col items-center">
                              <div
                                className={`h-3 w-3 rounded-full ${
                                  isBad ? "bg-destructive" : "bg-primary"
                                } ${index === 0 ? "ring-4 " + (isBad ? "ring-destructive/20" : "ring-primary/20") : ""}`}
                              />
                              {index < timelineEntries.length - 1 && (
                                <div className="w-px h-full bg-border mt-2" />
                              )}
                            </div>
                            <div className="flex-1 pb-4">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant={getBadgeVariant(uNormalized)}>
                                  {statusLabel(uNormalized)}
                                </Badge>
                                {update.actor_role && (
                                  <span className="text-xs text-muted-foreground">
                                    {ACTOR_ROLE_LABELS[update.actor_role] ?? update.actor_role}
                                  </span>
                                )}
                                {index === 0 && (
                                  <span className="text-xs text-primary font-medium">أحدث تحديث</span>
                                )}
                              </div>
                              {update.description && (
                                <p className="text-sm mt-2">{update.description}</p>
                              )}
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(update.created_at), "dd MMM yyyy - HH:mm", { locale: ar })}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  ({formatDistanceToNow(new Date(update.created_at), { addSuffix: true, locale: ar })})
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Map */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>موقع التتبع</CardTitle>
                </CardHeader>
                <CardContent>
                  <Suspense
                    fallback={<div className="w-full h-96 rounded-lg animate-pulse bg-muted" />}
                  >
                    <OrderTrackingMap
                      currentLat={order.current_location_lat}
                      currentLng={order.current_location_lng}
                      deliveryLat={order.delivery_lat}
                      deliveryLng={order.delivery_lng}
                    />
                  </Suspense>
                  <p className="text-xs text-muted-foreground mt-4 text-center">
                    📍 الأخضر: وجهة التسليم | 🔵 الأزرق: الموقع الحالي
                  </p>
                </CardContent>
              </Card>

              {/* Order Items */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    المنتجات ({order.order_items?.length ?? 0})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {(order.order_items ?? []).map((item, index) => (
                      <div key={index} className="flex gap-4">
                        {item.product_image ? (
                          <img loading="lazy" decoding="async"
                            src={item.product_image}
                            alt={item.product_name ?? ""}
                            className="w-16 h-16 object-cover rounded"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded bg-muted flex items-center justify-center">
                            <Package className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1">
                          <h4 className="font-medium">{item.product_name ?? "منتج"}</h4>
                          {item.variant_label && (
                            <p className="text-xs text-muted-foreground">{item.variant_label}</p>
                          )}
                          <p className="text-sm text-muted-foreground">
                            الكمية: {item.quantity} × {formatMoney(item.price)}
                          </p>
                        </div>
                      </div>
                    ))}
                    {(!order.order_items || order.order_items.length === 0) && (
                      <p className="text-center text-muted-foreground py-4 text-sm">لا توجد منتجات</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default TrackOrder;
