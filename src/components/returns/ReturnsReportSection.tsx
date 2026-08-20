import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { returnStatusLabel } from "@/lib/returnStatus";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface ReturnsReport {
  total_returns: number;
  total_orders: number;
  return_rate: number;
  by_status: Record<string, number>;
  top_products: { product_id: string; product_name: string; qty: number; requests: number }[];
  top_reasons: { reason: string; label: string; c: number }[];
  top_vendors: { vendor_id: string; vendor_name: string; c: number }[];
  top_customers: { customer_id: string; customer_name: string; c: number }[];
}

const RANGES = { "7d": 7, "30d": 30, "90d": 90 } as const;
type RangeKey = keyof typeof RANGES;

const Stat = ({ title, value }: { title: string; value: string | number }) => (
  <Card>
    <CardHeader className="pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="text-xl font-bold">{value}</div>
    </CardContent>
  </Card>
);

/** Returns analytics (admin sees platform-wide, sellers see their own store). */
const ReturnsReportSection = ({ vendorId = null }: { vendorId?: string | null }) => {
  const { toast } = useToast();
  const [range, setRange] = useState<RangeKey>("30d");
  const [data, setData] = useState<ReturnsReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const from = new Date(Date.now() - RANGES[range] * 86400000).toISOString();
      const { data: res, error } = await supabase.rpc("return_reports", {
        _from: from,
        _to: new Date().toISOString(),
        _vendor_id: vendorId,
      });
      if (cancelled) return;
      if (error) {
        toast({ title: "تعذر تحميل تقرير الإرجاعات", description: error.message, variant: "destructive" });
        setData(null);
      } else {
        setData(res as unknown as ReturnsReport);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [range, vendorId, toast]);

  const reasons = (data?.top_reasons ?? []).map((r) => ({ name: r.label, count: Number(r.c) }));
  const statuses = Object.entries(data?.by_status ?? {});

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">تقارير الإرجاعات</h2>
        <Tabs value={range} onValueChange={(v) => setRange(v as RangeKey)}>
          <TabsList>
            <TabsTrigger value="7d">7 أيام</TabsTrigger>
            <TabsTrigger value="30d">30 يوم</TabsTrigger>
            <TabsTrigger value="90d">90 يوم</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      ) : !data ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">لا توجد بيانات لهذه الفترة.</CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Stat title="عدد طلبات الإرجاع" value={data.total_returns} />
            <Stat title="عدد الطلبات" value={data.total_orders} />
            <Stat title="نسبة الإرجاع" value={`${data.return_rate}%`} />
          </div>

          {statuses.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">التوزيع حسب الحالة</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {statuses.map(([s, c]) => (
                  <Badge key={s} variant="secondary">
                    {returnStatusLabel(s)}: {c}
                  </Badge>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">أكثر أسباب الإرجاع</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[240px]">
                  {reasons.length === 0 ? (
                    <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      لا توجد بيانات.
                    </p>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={reasons}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">أكثر المنتجات المرتجعة</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {data.top_products.length === 0 ? (
                  <p className="text-muted-foreground">لا توجد بيانات.</p>
                ) : (
                  data.top_products.map((p) => (
                    <div key={p.product_id ?? p.product_name} className="flex items-center justify-between gap-2">
                      <span className="truncate">{p.product_name}</span>
                      <Badge variant="outline">
                        {p.qty} قطعة · {p.requests} طلب
                      </Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {data.top_vendors.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">البائعون بأعلى معدل إرجاع</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {data.top_vendors.map((v) => (
                  <div key={v.vendor_id} className="flex items-center justify-between gap-2">
                    <span className="truncate">{v.vendor_name}</span>
                    <Badge variant="outline">{v.c} إرجاع</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default ReturnsReportSection;
