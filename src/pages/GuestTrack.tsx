import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, PackageSearch, Truck } from "lucide-react";
import OrderStatusTimeline, { ORDER_STATUS_LABELS } from "@/components/OrderStatusTimeline";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

interface HistoryItem {
  status: string;
  notes: string | null;
  created_at: string;
}

interface TrackResult {
  id: string;
  created_at: string;
  status: string;
  tracking_status: string | null;
  courier_name: string | null;
  tracking_number: string | null;
  estimated_delivery: string | null;
  delivered_at: string | null;
  total_amount: number;
  governorate: string | null;
  history: HistoryItem[];
}

const ERRORS: Record<string, string> = {
  invalid_input: "يرجى إدخال رقم طلب صحيح ورقم هاتف صحيح.",
  rate_limited: "عدد المحاولات كبير. يرجى المحاولة بعد ساعة.",
  not_found: "لا يوجد طلب مطابق لرقم الطلب ورقم الهاتف المُدخلين.",
};

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("ar-SY", { maximumFractionDigits: 0 }).format(Math.round(n || 0)) + " ل.س";

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
    setResult(payload);
  };

  const currentStatus = result?.tracking_status || result?.status || "pending";
  const latestNote = result?.history?.length
    ? result.history[result.history.length - 1].notes
    : null;

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
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base">
                طلب #{result.id.slice(0, 8)}
              </CardTitle>
              <Badge variant="secondary">
                {ORDER_STATUS_LABELS[currentStatus] ?? currentStatus}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-6">
              <OrderStatusTimeline status={currentStatus} latestNote={latestNote} />

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">تاريخ الطلب</p>
                  <p className="font-medium">
                    {format(new Date(result.created_at), "d MMMM yyyy", { locale: ar })}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">الإجمالي</p>
                  <p className="font-medium">{formatCurrency(Number(result.total_amount))}</p>
                </div>
                {result.governorate && (
                  <div>
                    <p className="text-muted-foreground">المحافظة</p>
                    <p className="font-medium">{result.governorate}</p>
                  </div>
                )}
                {result.estimated_delivery && (
                  <div>
                    <p className="text-muted-foreground">التسليم المتوقع</p>
                    <p className="font-medium">
                      {format(new Date(result.estimated_delivery), "d MMMM yyyy", { locale: ar })}
                    </p>
                  </div>
                )}
                {result.courier_name && (
                  <div className="col-span-2 flex items-center gap-2">
                    <Truck className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{result.courier_name}</span>
                    {result.tracking_number && (
                      <span className="text-muted-foreground">— {result.tracking_number}</span>
                    )}
                  </div>
                )}
              </div>

              {result.history.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3">سجل الحالات</h3>
                  <ul className="space-y-3">
                    {[...result.history].reverse().map((h, i) => (
                      <li key={i} className="border-r-2 border-primary/40 pr-3">
                        <p className="text-sm font-medium">
                          {ORDER_STATUS_LABELS[h.status] ?? h.status}
                        </p>
                        {h.notes && <p className="text-xs text-muted-foreground">{h.notes}</p>}
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(h.created_at), "d MMM yyyy - HH:mm", { locale: ar })}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default GuestTrack;
