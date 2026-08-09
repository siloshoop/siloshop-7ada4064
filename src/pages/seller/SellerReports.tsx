import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import SellerLayout from "@/components/seller/SellerLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download } from "lucide-react";

interface OrderRow {
  id: string;
  created_at: string;
  status: string;
  total_amount: number;
  customer_name: string | null;
  city: string | null;
}

const RANGES = [
  { key: "7", label: "٧ أيام" },
  { key: "30", label: "٣٠ يوماً" },
  { key: "90", label: "٩٠ يوماً" },
  { key: "all", label: "الكل" },
];

const toCsv = (rows: Record<string, string | number>[]) => {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return "\uFEFF" + [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
};

const download = (name: string, content: string) => {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
};

const SellerReports = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [products, setProducts] = useState<{ name: string; price: number; stock_quantity: number | null; moderation_status: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("30");

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const [ordersRes, productsRes] = await Promise.all([
        supabase.rpc("get_vendor_orders"),
        supabase.from("products").select("name,price,stock_quantity,moderation_status").eq("vendor_id", user.id),
      ]);
      if (ordersRes.error) toast({ title: "تعذّر تحميل التقارير", description: ordersRes.error.message, variant: "destructive" });
      setOrders((ordersRes.data as OrderRow[]) ?? []);
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
    const revenue = delivered.reduce((s, o) => s + Number(o.total_amount || 0), 0);
    const byCity = new Map<string, number>();
    scoped.forEach((o) => byCity.set(o.city || "غير محدد", (byCity.get(o.city || "غير محدد") ?? 0) + 1));
    return {
      total: scoped.length,
      delivered: delivered.length,
      cancelled: cancelled.length,
      revenue,
      avg: delivered.length ? revenue / delivered.length : 0,
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
                toCsv(scoped.map((o) => ({
                  رقم_الطلب: o.id,
                  التاريخ: new Date(o.created_at).toLocaleDateString("ar-SY"),
                  الحالة: o.status,
                  المبلغ: Number(o.total_amount || 0),
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
                toCsv(products.map((p) => ({
                  المنتج: p.name,
                  السعر: Number(p.price || 0),
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
              { l: "إيراد مسلّم", v: `${summary.revenue.toLocaleString("ar-SY")} ل.س` },
              { l: "متوسط قيمة الطلب", v: `${Math.round(summary.avg).toLocaleString("ar-SY")} ل.س` },
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
