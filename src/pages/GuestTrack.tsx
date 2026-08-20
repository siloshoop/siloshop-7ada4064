import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Loader2, Search, PackageSearch, Truck, ExternalLink, XCircle, RotateCcw, CreditCard, StickyNote, Clock,
} from "lucide-react";
import OrderStatusTimeline, { ORDER_STATUS_LABELS } from "@/components/OrderStatusTimeline";
import { ACTOR_ROLE_LABELS } from "@/lib/orderStatus";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

interface HistoryItem {
  status: string;
  notes: string | null;
  created_at: string;
}

interface EventItem {
  status: string;
  description: string | null;
  actor_role: string | null;
  created_at: string;
}

interface OrderItemSummary {
  product_name: string | null;
  product_image: string | null;
  variant_label: string | null;
  quantity: number;
}

interface TrackResult {
  id: string;
  order_number: string | null;
  invoice_number: string | null;
  created_at: string;
  updated_at: string | null;
  status: string;
  tracking_status: string | null;
  courier_name: string | null;
  tracking_number: string | null;
  estimated_delivery: string | null;
  delivered_at: string | null;
  shipped_at: string | null;
  shipping_notes: string | null;
  payment_method: string | null;
  payment_status: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  total_amount: number;
  subtotal_amount: number | null;
  shipping_amount: number | null;
  tax_amount: number | null;
  discount_amount: number | null;
  governorate: string | null;
  history: HistoryItem[];
  events: EventItem[];
  items: OrderItemSummary[];
}

const ERRORS: Record<string, string> = {
  invalid_input: "يرجى إدخال رقم طلب صحيح ورقم هاتف صحيح.",
  rate_limited: "عدد المحاولات كبير. يرجى المحاولة بعد ساعة.",
  not_found: "لا يوجد طلب مطابق لرقم الطلب ورقم الهاتف المُدخلين.",
};

const DESTRUCTIVE_STATUSES = new Set(["cancelled", "return_requested", "returning", "returned", "refunded"]);

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

const formatCurrency = (n: number | null | undefined) =>
  new Intl.NumberFormat("ar-SY", { maximumFractionDigits: 0 }).format(Math.round(Number(n) || 0)) + " ل.س";

const GuestTrack = () => {
  const [orderId, setOrderId] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TrackResult | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    const { data, error: rpcError } = await supabase.rpc("track_order_public", {
      _order_id: orderId.trim(),
      _phone: phone.trim(),
    });
    setLoading(false);
    if (rpcError) {
      setError("تعذر تنفيذ البحث. تأكد من صيغة رقم الطلب.");
      return;
    }
    const payload = data as unknown as (TrackResult & { error?: string }) | null;
    if (!payload || payload.error) {
      setError(ERRORS[payload?.error ?? ""] ?? "تعذر العثور على الطلب.");
      return;
    }
    setResult({ history: [], events: [], items: [], ...payload });
  };

  const currentStatus = (result?.tracking_status || result?.status || "pending").trim().toLowerCase();
  const normalizedStatus = currentStatus === "processing" ? "preparing" : currentStatus;
  const isDestructiveState = DESTRUCTIVE_STATUSES.has(normalizedStatus);

  // خط زمني: نفضّل events (تاريخ التتبع) ونعود للـ history عند عدم توفرها
  const useEvents = !!result?.events?.length;
  const latestNote = useEvents
    ? result?.events[0]?.description ?? null
    : result?.history?.length
    ? result.history[result.history.length - 1].notes
    : null;

  const lastUpdateAt = result
    ? useEvents
      ? result.events[0]?.created_at
      : result.updated_at || result.history?.[result.history.length - 1]?.created_at || result.created_at
    : null;

  const hasShippingInfo =
    result &&
    (result.courier_name || result.tracking_number || result.estimated_delivery || result.shipped_at || result.delivered_at || result.shipping_notes);

  const hasAmountBreakdown =
    result && ((result.subtotal_amount ?? 0) > 0 || (result.shipping_amount ?? 0) > 0 || (result.tax_amount ?? 0) > 0 || (result.discount_amount ?? 0) > 0);

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="flex items-center gap-3 mb-2">
          <PackageSearch className="h-7 w-7 text-primary" />
          <h1 className="text-2xl md:text-3xl font-bold">تتبع طلبك</h1>
        </div>
        <p className="text-muted-foreground mb-6">
          أدخل رقم الطلب ورقم الهاتف المستخدم عند الطلب لعرض حالة الشحنة — دون الحاجة لتسجيل الدخول.
        </p>

        <Card className="mb-6">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
              <div className="space-y-2">
                <Label htmlFor="order-id">رقم الطلب</Label>
                <Input
                  id="order-id"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  placeholder="مثال: 8f1c2b34-..."
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">رقم الهاتف</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="09XXXXXXXX"
                  inputMode="tel"
                  required
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full md:w-auto">
                {loading ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Search className="ml-2 h-4 w-4" />}
                تتبع
              </Button>
            </form>
            {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>

        {result && (
          <div className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
                <div>
                  <CardTitle className="text-base">
                    طلب #{result.order_number || result.id.slice(0, 8)}
                  </CardTitle>
                  {result.invoice_number && (
                    <p className="text-xs text-muted-foreground mt-1">فاتورة: {result.invoice_number}</p>
                  )}
                </div>
                <Badge variant={normalizedStatus === "cancelled" ? "destructive" : "secondary"}>
                  {statusLabel(normalizedStatus)}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-6">
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
                      {result.cancellation_reason ? (
                        <p className="text-sm text-muted-foreground mt-1">السبب: {result.cancellation_reason}</p>
                      ) : (
                        latestNote && <p className="text-sm text-muted-foreground mt-1">{latestNote}</p>
                      )}
                      {result.cancelled_at && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(result.cancelled_at), "d MMM yyyy - HH:mm", { locale: ar })}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <OrderStatusTimeline status={normalizedStatus} latestNote={latestNote} />
                )}

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">تاريخ الطلب</p>
                    <p className="font-medium">
                      {format(new Date(result.created_at), "d MMMM yyyy", { locale: ar })}
                    </p>
                  </div>
                  {lastUpdateAt && (
                    <div>
                      <p className="text-muted-foreground">آخر تحديث</p>
                      <p className="font-medium">
                        {format(new Date(lastUpdateAt), "d MMM yyyy - HH:mm", { locale: ar })}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-muted-foreground">الإجمالي</p>
                    <p className="font-medium">{formatCurrency(result.total_amount)}</p>
                  </div>
                  {result.governorate && (
                    <div>
                      <p className="text-muted-foreground">المحافظة</p>
                      <p className="font-medium">{result.governorate}</p>
                    </div>
                  )}
                  {result.payment_method && (
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{result.payment_method}</span>
                      {result.payment_status && (
                        <span className="text-xs text-muted-foreground">({result.payment_status})</span>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* بطاقة الشحن */}
            {hasShippingInfo && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Truck className="h-4 w-4 text-muted-foreground" />
                    معلومات الشحن
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {result.courier_name && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">شركة الشحن:</span>
                      <span className="font-medium">{result.courier_name}</span>
                    </div>
                  )}
                  {result.tracking_number && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">رقم التتبع:</span>
                      <span className="font-medium font-mono">{result.tracking_number}</span>
                    </div>
                  )}

                  {result.tracking_number && result.courier_name && (
                    <div className="pt-1">
                      {getTrackingUrl(result.courier_name, result.tracking_number) ? (
                        <Button
                          className="w-full"
                          onClick={() => {
                            const url = getTrackingUrl(result.courier_name, result.tracking_number!);
                            if (url) window.open(url, "_blank");
                          }}
                        >
                          <ExternalLink className="h-4 w-4 ml-2" />
                          تتبع الشحنة عبر {result.courier_name}
                        </Button>
                      ) : (
                        <div className="p-3 bg-muted rounded-lg">
                          <p className="text-sm text-muted-foreground text-center">
                            يمكنك تتبع شحنتك باستخدام رقم التتبع:{" "}
                            <span className="font-mono font-bold">{result.tracking_number}</span>
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {result.estimated_delivery && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">التسليم المتوقع:</span>
                      <span className="font-medium">
                        {format(new Date(result.estimated_delivery), "d MMMM yyyy", { locale: ar })}
                      </span>
                    </div>
                  )}
                  {result.shipped_at && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">تاريخ الشحن:</span>
                      <span className="font-medium">
                        {format(new Date(result.shipped_at), "d MMM yyyy - HH:mm", { locale: ar })}
                      </span>
                    </div>
                  )}
                  {result.delivered_at && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">تاريخ التسليم:</span>
                      <span className="font-medium">
                        {format(new Date(result.delivered_at), "d MMM yyyy - HH:mm", { locale: ar })}
                      </span>
                    </div>
                  )}
                  {result.shipping_notes && (
                    <div className="flex items-start gap-2">
                      <StickyNote className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <span className="text-muted-foreground">ملاحظات الشحن:</span>
                        <p className="font-medium mt-1">{result.shipping_notes}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* المنتجات والإجمالي */}
            {(result.items.length > 0 || hasAmountBreakdown) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">تفاصيل الطلب</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {result.items.length > 0 && (
                    <div className="space-y-3">
                      {result.items.map((item, i) => (
                        <div key={i} className="flex items-center gap-3">
                          {item.product_image ? (
                            <img
                              src={item.product_image}
                              alt={item.product_name ?? ""}
                              className="h-12 w-12 rounded-md object-cover border shrink-0"
                            />
                          ) : (
                            <div className="h-12 w-12 rounded-md bg-muted shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.product_name ?? "منتج"}</p>
                            {item.variant_label && (
                              <p className="text-xs text-muted-foreground">{item.variant_label}</p>
                            )}
                          </div>
                          <span className="text-sm text-muted-foreground">×{item.quantity}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {result.items.length > 0 && hasAmountBreakdown && <Separator />}

                  <div className="space-y-1.5 text-sm">
                    {hasAmountBreakdown ? (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">منتجات:</span>
                          <span className="font-medium">{formatCurrency(result.subtotal_amount ?? result.total_amount)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">الشحن:</span>
                          <span className="font-medium">{formatCurrency(result.shipping_amount)}</span>
                        </div>
                        {!!result.discount_amount && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">الخصم:</span>
                            <span className="font-medium text-primary">- {formatCurrency(result.discount_amount)}</span>
                          </div>
                        )}
                        {!!result.tax_amount && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">الضريبة:</span>
                            <span className="font-medium">{formatCurrency(result.tax_amount)}</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">لا توجد تفاصيل إضافية للمبلغ.</p>
                    )}
                    <div className="flex justify-between text-lg font-bold pt-2 border-t">
                      <span>الإجمالي:</span>
                      <span className="text-primary">{formatCurrency(result.total_amount)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* سجل الحالات */}
            {(useEvents ? result.events.length > 0 : result.history.length > 0) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">سجل الحالات</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {useEvents
                      ? result.events.map((ev, i) => (
                          <li key={i} className="border-r-2 border-primary/40 pr-3">
                            <p className="text-sm font-medium">
                              {statusLabel(ev.status)}
                              {ev.actor_role && (
                                <span className="text-xs text-muted-foreground mr-2">
                                  ({ACTOR_ROLE_LABELS?.[ev.actor_role] ?? ev.actor_role})
                                </span>
                              )}
                            </p>
                            {ev.description && (
                              <p className="text-xs text-muted-foreground">{ev.description}</p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(ev.created_at), "d MMM yyyy - HH:mm", { locale: ar })}
                            </p>
                          </li>
                        ))
                      : [...result.history].reverse().map((h, i) => (
                          <li key={i} className="border-r-2 border-primary/40 pr-3">
                            <p className="text-sm font-medium">{statusLabel(h.status)}</p>
                            {h.notes && <p className="text-xs text-muted-foreground">{h.notes}</p>}
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(h.created_at), "d MMM yyyy - HH:mm", { locale: ar })}
                            </p>
                          </li>
                        ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default GuestTrack;
