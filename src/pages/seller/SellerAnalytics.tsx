import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import SellerLayout from "@/components/seller/SellerLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import useSellerDashboard from "@/hooks/useSellerDashboard";

const currency = (n: number) => `${Math.round(Number(n) || 0).toLocaleString("ar-SY")} ل.س`;
const num = (n: number) => (Number(n) || 0).toLocaleString("ar-SY");
const shortDate = (d: string) => new Date(d).toLocaleDateString("ar-SY", { day: "numeric", month: "short" });

const SellerAnalytics = () => {
  const [days, setDays] = useState(30);
  const { data, loading } = useSellerDashboard(days);

  const o = data?.orders ?? {};
  const e = data?.engagement ?? {};
  const s = data?.sales ?? {};
  const series = (data?.series ?? []).map((pt) => ({ ...pt, label: shortDate(pt.date) }));

  const views = Number(e.views_period ?? 0);
  const ordersPeriod = Number(o.period ?? 0);
  const conversion = views > 0 ? ((ordersPeriod / views) * 100).toFixed(1) : "0.0";
  const totalOrders = Number(o.total ?? 0);
  const returnRate = totalOrders > 0 ? ((Number(o.returns_total ?? 0) / totalOrders) * 100).toFixed(1) : "0.0";
  const cancelRate = totalOrders > 0 ? ((Number(o.cancelled ?? 0) / totalOrders) * 100).toFixed(1) : "0.0";

  const kpis = [
    { label: `إيراد آخر ${days} يوم`, value: currency(Number(s.period ?? 0)) },
    { label: "طلبات الفترة", value: num(ordersPeriod) },
    { label: "زوّار (مشاهدات)", value: num(views) },
    { label: "معدل التحويل", value: `${conversion}%` },
    { label: "معدل الإرجاع", value: `${returnRate}%` },
    { label: "معدل الإلغاء", value: `${cancelRate}%` },
    { label: "متوسط التقييم", value: `${Number(e.avg_rating ?? 0)} / 5` },
    { label: "عملاء", value: num(Number(e.customers ?? 0)) },
    { label: "متابعو المتجر", value: num(Number(e.followers ?? 0)) },
  ];

  const top = data?.top_products ?? [];
  const worst = [...top].sort((a, b) => a.units - b.units).slice(0, 5);

  return (
    <SellerLayout
      title="تحليلات المتجر"
      description="مؤشرات الأداء والاتجاهات"
      actions={
        <Tabs value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <TabsList>
            <TabsTrigger value="7">٧ أيام</TabsTrigger>
            <TabsTrigger value="30">٣٠ يوم</TabsTrigger>
            <TabsTrigger value="90">٩٠ يوم</TabsTrigger>
          </TabsList>
        </Tabs>
      }
    >
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{k.label}</p>
              {loading ? <Skeleton className="mt-1 h-6 w-16" /> : <p className="text-base font-bold">{k.value}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">الإيراد مقابل الزوّار</CardTitle></CardHeader>
          <CardContent className="h-64">
            {loading ? <Skeleton className="h-full w-full" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={60} />
                  <Tooltip />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.2)" />
                  <Area type="monotone" dataKey="views" stroke="hsl(var(--accent))" fill="hsl(var(--accent) / 0.15)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">الطلبات اليومية</CardTitle></CardHeader>
          <CardContent className="h-64">
            {loading ? <Skeleton className="h-full w-full" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={40} />
                  <Tooltip />
                  <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">أفضل المنتجات</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {loading ? <Skeleton className="h-40 w-full" /> : top.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا توجد مبيعات بعد.</p>
            ) : top.map((tp) => (
              <Link key={tp.id} to={`/product/${tp.id}`} className="flex items-center gap-3 rounded-lg border p-2 hover:bg-muted">
                <span className="min-w-0 flex-1 truncate text-sm">{tp.name}</span>
                <Badge variant="secondary">{num(tp.units)}</Badge>
                <span className="text-xs text-muted-foreground">{currency(tp.revenue)}</span>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">الأقل مبيعاً</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {loading ? <Skeleton className="h-40 w-full" /> : worst.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا توجد بيانات كافية.</p>
            ) : worst.map((tp) => (
              <Link key={tp.id} to={`/product/${tp.id}`} className="flex items-center gap-3 rounded-lg border p-2 hover:bg-muted">
                <span className="min-w-0 flex-1 truncate text-sm">{tp.name}</span>
                <Badge variant="outline">{num(tp.units)}</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </SellerLayout>
  );
};

export default SellerAnalytics;
