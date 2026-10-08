import { withDisplayCurrency } from "@/lib/displayCurrency";
import { useEffect, useMemo, useState } from "react";
import { exportFile, exportSuccessMessage, recordsToCsv } from "@/lib/exportFile";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import SellerLayout from "@/components/seller/SellerLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download } from "lucide-react";
import { formatAmountsByCurrency, normalizeCurrency } from "@/lib/currency";

interface OrderRow {
  id: string;
  created_at: string;
  status: string;
  total_amount: number;
  customer_name: string | null;
  city: string | null;
  currency?: string | null;
}

const RANGES = [
  { key: "7", label: "٧ أيام" },
  { key: "30", label: "٣٠ يوماً" },
  { key: "90", label: "٩٠ يوماً" },
  { key: "all", label: "الكل" },
];


const SellerReports = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [products, setProducts] = useState<{ name: string; price: number; currency: string | null; stock_quantity: number | null; moderation_status: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("30");
  const download = async (name: string, rows: Record<string, unknown>[]) => {
    try {
      if (!rows.length) throw new Error("لا توجد بيانات للتصدير في هذه الفترة");
      const r = await exportFile(recordsToCsv(rows), name);
      if (r !== "cancelled") toast({ title: exportSuccessMessage(r), description: `${rows.length} سجل` });
    } catch (e) {
      toast({ title: "تعذر التصدير", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const [ordersRes, productsRes] = await Promise.all([
        supabase.rpc("get_vendor_orders"),
        supabase.from("products").select("name,price,currency,stock_quantity,moderation_status").eq("vendor_id", user.id),
      ]);
      if (ordersRes.error) toast({ title: "تعذّر تحميل التقارير", description: ordersRes.error.message, variant: "destructive" });
      try { setOrders(await withDisplayCurrency((ordersRes.data as OrderRow[]) ?? [], "orders")); }
      catch (error) { toast({ title: "تعذر قراءة عملات الطلبات", description: String(error), variant: "destructive" }); }
      setProducts(productsRes.data ?? []);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const scoped = useMemo(() => {
    if (range === "all") return orders;
    const days = Number(range);
    const from = Date.now() - days * 86400000;
    return orders.filter((o) => new Date(o.created_at).getTime() >= from);
  }, [orders, range]);

  const summary = useMemo(() => {
    const delivered = scoped.filter((o) => o.status === "delivered");
    const cancelled = scoped.filter((o) => o.status === "cancelled");
    const revenueRows = delivered.map((o) => ({ amount: o.total_amount, currency: o.currency }));
    const countBy = (c: string) => delivered.filter((o) => normalizeCurrency(o.currency) === c).length;
    const byCity = new Map<string, number>();
    scoped.forEach((o) => byCity.set(o.city || "غير محدد", (byCity.get(o.city || "غير محدد") ?? 0) + 1));
    return {
      total: scoped.length,
      delivered: delivered.length,
      cancelled: cancelled.length,
      revenue: formatAmountsByCurrency(revenueRows),
      avg: formatAmountsByCurrency(revenueRows, { maximumFractionDigits: 2, divideBy: countBy }),
      topCities: [...byCity.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
    };
  }, [scoped]);

  return (
    <SellerLayout
      title="التقارير"
      description="تقارير البيع والمخزون مع إمكانية التصدير"
      actions={
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() =>
              download(
                `orders-${range}.csv`,
                (scoped.map((o) => ({
                  رقم_الطلب: o.id,
                  التاريخ: new Date(o.created_at).toLocaleDateString("ar-SY"),
                  الحالة: o.status,
                  المبلغ: Number(o.total_amount || 0),
                  العملة: normalizeCurrency(o.currency),
                  العميل: o.customer_name ?? "",
                  المحافظة: o.city ?? "",
                })))
              )
            }
          >
            <Download className="me-2 h-4 w-4" /> تصدير الطلبات
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              download(
                "products.csv",
                (products.map((p) => ({
                  المنتج: p.name,
                  السعر: Number(p.price || 0),
                   العملة: normalizeCurrency(p.currency),
                  المخزون: p.stock_quantity ?? 0,
                  الحالة: p.moderation_status ?? "",
                })))
              )
            }
          >
            <Download className="me-2 h-4 w-4" /> تصدير المنتجات
          </Button>
        </div>
      }
    >
      <Tabs value={range} onValueChange={setRange} className="mb-4">
        <TabsList>
          {RANGES.map((r) => <TabsTrigger key={r.key} value={r.key}>{r.label}</TabsTrigger>)}
        </TabsList>
      </Tabs>

      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {[
              { l: "إجمالي الطلبات", v: summary.total },
              { l: "طلبات مسلّمة", v: summary.delivered },
              { l: "طلبات ملغاة", v: summary.cancelled },
              { l: "إيراد مسلّم", v: summary.revenue },
              { l: "متوسط قيمة الطلب", v: summary.avg },
            ].map((k) => (
              <Card key={k.l}>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">{k.l}</p>
                  <p className="text-lg font-bold">{k.v}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="mt-4">
            <CardHeader className="pb-3"><CardTitle className="text-base">أعلى المحافظات بالطلبات</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {summary.topCities.length === 0 ? (
                <p className="text-sm text-muted-foreground">لا توجد بيانات في هذه الفترة.</p>
              ) : (
                summary.topCities.map(([city, count]) => (
                  <div key={city} className="flex items-center justify-between rounded-lg border p-2 text-sm">
                    <span>{city}</span>
                    <span className="font-bold">{count}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </SellerLayout>
  );
};

export default SellerReports;
