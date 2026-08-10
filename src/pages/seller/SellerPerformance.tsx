import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import SellerLayout from "@/components/seller/SellerLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchSellerPerformance, formatHours, friendlyOrderError, type SellerPerformance as Perf,
} from "@/lib/orderStatus";
import {
  ShoppingBag, PackageCheck, XCircle, Undo2, Timer, Truck, Star, RefreshCw,
} from "lucide-react";

const rateTone = (rate: number, good = 5, warn = 12) =>
  rate <= good ? "text-[hsl(var(--status-completed))]"
    : rate <= warn ? "text-[hsl(var(--status-pending))]"
    : "text-destructive";

/** Seller-facing quality dashboard: prep/delivery time, cancellation & return rates, satisfaction. */
const SellerPerformance = () => {
  const { toast } = useToast();
  const [perf, setPerf] = useState<Perf | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPerf(await fetchSellerPerformance());
    } catch (e) {
      toast({ title: "خطأ", description: friendlyOrderError(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  // Live refresh when order history changes
  useEffect(() => {
    const channel = supabase
      .channel("seller-performance")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "order_status_history" }, () => void load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const kpis = perf
    ? [
        { label: "إجمالي الطلبات", value: perf.total_orders.toLocaleString("ar-SY"), icon: ShoppingBag, tone: "" },
        { label: "طلبات مسلّمة", value: perf.delivered_orders.toLocaleString("ar-SY"), icon: PackageCheck, tone: "text-[hsl(var(--status-delivered))]" },
        { label: "متوسط زمن التجهيز", value: formatHours(perf.avg_prep_hours), icon: Timer, tone: "" },
        { label: "متوسط زمن التوصيل", value: formatHours(perf.avg_delivery_hours), icon: Truck, tone: "" },
        { label: "نسبة الإلغاء", value: `${perf.cancellation_rate}%`, icon: XCircle, tone: rateTone(perf.cancellation_rate) },
        { label: "نسبة الإرجاع", value: `${perf.return_rate}%`, icon: Undo2, tone: rateTone(perf.return_rate) },
      ]
    : [];

  return (
    <SellerLayout
      title="أداء المتجر"
      description="مؤشرات جودة الخدمة المحسوبة من سجل الطلبات الفعلي"
      actions={
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw className="me-2 h-4 w-4" /> تحديث
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {loading || !perf
          ? Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}><CardContent className="p-4"><Skeleton className="h-14 w-full" /></CardContent></Card>
            ))
          : kpis.map((k) => (
              <Card key={k.label}>
                <CardContent className="p-4">
                  <k.icon className="mb-2 h-4 w-4 text-primary" />
                  <p className="text-xs text-muted-foreground">{k.label}</p>
                  <p className={`text-lg font-bold ${k.tone}`}>{k.value}</p>
                </CardContent>
              </Card>
            ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Star className="h-4 w-4 text-[hsl(var(--status-pending))]" /> رضا العملاء
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading || !perf ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">{perf.satisfaction_score.toFixed(2)}</span>
                  <span className="text-sm text-muted-foreground">من 5</span>
                </div>
                <Progress value={(perf.satisfaction_score / 5) * 100} />
                <p className="text-xs text-muted-foreground">
                  محسوبة من {perf.ratings_count.toLocaleString("ar-SY")} تقييم للمتجر.
                </p>
                <Button asChild variant="outline" size="sm">
                  <Link to="/seller/reviews">عرض التقييمات</Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">تفصيل الجودة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {loading || !perf ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <>
                <div>
                  <div className="mb-1 flex justify-between">
                    <span className="text-muted-foreground">نسبة الإلغاء</span>
                    <span className={rateTone(perf.cancellation_rate)}>{perf.cancellation_rate}%</span>
                  </div>
                  <Progress value={Math.min(100, perf.cancellation_rate)} />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {perf.cancelled_orders.toLocaleString("ar-SY")} طلب ملغي من {perf.total_orders.toLocaleString("ar-SY")}
                  </p>
                </div>
                <div>
                  <div className="mb-1 flex justify-between">
                    <span className="text-muted-foreground">نسبة الإرجاع</span>
                    <span className={rateTone(perf.return_rate)}>{perf.return_rate}%</span>
                  </div>
                  <Progress value={Math.min(100, perf.return_rate)} />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {perf.returned_orders.toLocaleString("ar-SY")} طلب مرتجع
                  </p>
                </div>
                <p className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
                  حافظ على نسبة إلغاء وإرجاع أقل من 5% وزمن تجهيز أقل من 24 ساعة لتحسين ظهور متجرك.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </SellerLayout>
  );
};

export default SellerPerformance;
