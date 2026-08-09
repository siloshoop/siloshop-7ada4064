import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, DollarSign, ShoppingBag, TrendingUp, Truck } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

interface Analytics {
  orders: {
    total: number; delivered: number; cancelled: number; period_count: number;
    revenue_total: number; revenue_period: number; avg_order_value: number;
  };
  daily_orders: { day: string; orders: number; revenue: number }[];
}

const RANGES = [7, 30, 90, 365];
const money = (n: number) =>
  `${new Intl.NumberFormat("ar-SY").format(Math.round(n || 0))} ل.س`;

const Revenue = () => {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: res } = await supabase.rpc("admin_get_analytics", { _days: days });
      if (cancelled) return;
      setData((res as unknown as Analytics) ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [days]);

  const cards = data
    ? [
        { label: `إيرادات آخر ${days} يوم`, value: money(data.orders.revenue_period), icon: DollarSign },
        { label: "الإيرادات الإجمالية", value: money(data.orders.revenue_total), icon: TrendingUp },
        { label: "متوسط قيمة الطلب", value: money(data.orders.avg_order_value), icon: ShoppingBag },
        { label: "طلبات تم توصيلها", value: new Intl.NumberFormat("ar-SY").format(data.orders.delivered), icon: Truck },
      ]
    : [];

  return (
    <AdminLayout
      title="الإيرادات"
      description="الإيرادات محسوبة من الطلبات المدفوعة عند الاستلام (COD) للبائعين المحليين."
      actions={
        <Tabs value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <TabsList>
            {RANGES.map((r) => (
              <TabsTrigger key={r} value={String(r)}>{r} يوم</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      }
    >
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((c) => (
              <Card key={c.label}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{c.label}</CardTitle>
                  <c.icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">{c.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-base">الإيرادات اليومية</CardTitle>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.daily_orders ?? []}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => money(v)} />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}
    </AdminLayout>
  );
};

export default Revenue;