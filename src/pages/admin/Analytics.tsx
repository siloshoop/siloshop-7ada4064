import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users, UserCheck, UserX, Store, ShoppingBag, DollarSign, Package,
  Boxes, AlertCircle, Flag, TrendingUp, Loader2, Activity, ShieldAlert,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid, Legend, PieChart, Pie, Cell,
} from "recharts";

interface AnalyticsPayload {
  period_days: number;
  generated_at: string;
  users: {
    total: number; customers: number; vendors: number; admins: number;
    banned: number; suspended: number; active_period: number; new_period: number;
  };
  sellers: { approved: number; pending: number; rejected: number; suspended: number; total: number };
  orders: {
    total: number; pending: number; processing: number; delivered: number;
    cancelled: number; returned: number; period_count: number;
    revenue_total: number; revenue_period: number; avg_order_value: number;
  };
  products: {
    total: number; active: number; platform: number; seller: number;
    pending: number; approved: number; rejected: number; out_of_stock: number;
  };
  reports: { total: number; pending: number; under_review: number; resolved: number; rejected: number };
  daily_users: { day: string; count: number }[];
  daily_orders: { day: string; orders: number; revenue: number }[];
}

const RANGES = [
  { label: "7 أيام", value: 7 },
  { label: "30 يوم", value: 30 },
  { label: "90 يوم", value: 90 },
  { label: "سنة", value: 365 },
];

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "#10b981", "#f59e0b", "#3b82f6", "#ef4444"];

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("ar-SY", { maximumFractionDigits: 0 }).format(Math.round(n || 0)) + " ل.س";

const StatCard = ({
  title, value, hint, icon: Icon, tone = "primary",
}: { title: string; value: string | number; hint?: string; icon: any; tone?: string }) => (
  <Card className={`border-r-4 border-r-${tone}`}>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </CardContent>
  </Card>
);

const AdminAnalytics = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [days, setDays] = useState(30);
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      const { data: res, error: err } = await supabase.rpc("admin_get_analytics", { _days: days });
      if (cancelled) return;
      if (err) {
        setError(err.message || "تعذر تحميل الإحصائيات");
        setLoading(false);
        return;
      }
      setData(res as unknown as AnalyticsPayload);
      setLoading(false);
    };
    if (user) void load();
    return () => { cancelled = true; };
  }, [user, days]);

  const orderStatusData = useMemo(() => {
    if (!data) return [];
    return [
      { name: "قيد الانتظار", value: data.orders.pending },
      { name: "قيد المعالجة", value: data.orders.processing },
      { name: "تم التوصيل", value: data.orders.delivered },
      { name: "ملغي", value: data.orders.cancelled },
      { name: "مرتجع", value: data.orders.returned },
    ].filter(x => x.value > 0);
  }, [data]);

  const productMixData = useMemo(() => {
    if (!data) return [];
    return [
      { name: "منتجات المنصة", value: data.products.platform },
      { name: "منتجات البائعين", value: data.products.seller },
    ].filter(x => x.value > 0);
  }, [data]);

  const dailyOrdersFormatted = useMemo(() => {
    if (!data) return [];
    return data.daily_orders.map(d => ({
      day: new Date(d.day).toLocaleDateString("ar-SY", { month: "short", day: "numeric" }),
      orders: Number(d.orders),
      revenue: Number(d.revenue),
    }));
  }, [data]);

  const dailyUsersFormatted = useMemo(() => {
    if (!data) return [];
    return data.daily_users.map(d => ({
      day: new Date(d.day).toLocaleDateString("ar-SY", { month: "short", day: "numeric" }),
      count: Number(d.count),
    }));
  }, [data]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <TrendingUp className="h-7 w-7 text-primary" /> لوحة التحليلات والإحصائيات
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              نظرة شاملة على أداء المنصة — المستخدمون، الطلبات، الإيرادات، والمنتجات.
            </p>
          </div>
          <Tabs value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <TabsList>
              {RANGES.map(r => (
                <TabsTrigger key={r.value} value={String(r.value)}>{r.label}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <Card className="border-destructive/40">
            <CardContent className="pt-6 flex items-center gap-3 text-destructive">
              <ShieldAlert className="h-5 w-5" /> {error}
            </CardContent>
          </Card>
        ) : data ? (
          <>
            {/* Primary KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
              <StatCard title="إجمالي المستخدمين" value={data.users.total}
                hint={`${data.users.customers} مشتري • ${data.users.vendors} بائع`} icon={Users} />
              <StatCard title="المستخدمون النشطون" value={data.users.active_period}
                hint={`آخر ${data.period_days} يوم`} icon={Activity} />
              <StatCard title="مستخدمون جدد" value={data.users.new_period}
                hint={`خلال ${data.period_days} يوم`} icon={UserCheck} />
              <StatCard title="محظورون / موقوفون" value={data.users.banned + data.users.suspended}
                hint={`${data.users.banned} حظر • ${data.users.suspended} إيقاف`} icon={UserX} />

              <StatCard title="إجمالي الطلبات" value={data.orders.total}
                hint={`${data.orders.period_count} خلال الفترة`} icon={ShoppingBag} />
              <StatCard title="الإيرادات (كلي)" value={formatCurrency(data.orders.revenue_total)}
                hint="الطلبات المسلّمة فقط" icon={DollarSign} />
              <StatCard title="إيرادات الفترة" value={formatCurrency(data.orders.revenue_period)}
                hint={`متوسط طلب: ${formatCurrency(data.orders.avg_order_value)}`} icon={TrendingUp} />
              <StatCard title="بلاغات معلقة" value={data.reports.pending + data.reports.under_review}
                hint={`الإجمالي: ${data.reports.total}`} icon={Flag} />
            </div>

            {/* Seller / Product KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4 mb-8">
              <StatCard title="بائعون مقبولون" value={data.sellers.approved} icon={Store} />
              <StatCard title="طلبات بائع معلقة" value={data.sellers.pending} icon={AlertCircle} />
              <StatCard title="بائعون موقوفون" value={data.sellers.suspended} icon={UserX} />
              <StatCard title="منتجات المنصة" value={data.products.platform} icon={Boxes} />
              <StatCard title="منتجات البائعين" value={data.products.seller} icon={Package} />
              <StatCard title="منتجات بانتظار المراجعة" value={data.products.pending}
                hint={`مرفوضة: ${data.products.rejected}`} icon={AlertCircle} />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">الإيرادات اليومية</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dailyOrdersFormatted}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v: number, n: string) => n === "revenue" ? formatCurrency(v) : v} />
                        <Legend />
                        <Line type="monotone" dataKey="revenue" name="الإيرادات" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">الطلبات اليومية</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dailyOrdersFormatted}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="orders" name="الطلبات" fill="hsl(var(--primary))" radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <Card>
                <CardHeader><CardTitle className="text-base">مستخدمون جدد يوميًا</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dailyUsersFormatted}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="count" name="مستخدمون" fill="hsl(var(--accent))" radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">توزيع حالات الطلبات</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={orderStatusData} dataKey="value" nameKey="name"
                          cx="50%" cy="50%" innerRadius={45} outerRadius={90} paddingAngle={3}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                          {orderStatusData.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">توزيع المنتجات</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={productMixData} dataKey="value" nameKey="name"
                          cx="50%" cy="50%" innerRadius={45} outerRadius={90} paddingAngle={3}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                          {productMixData.map((_, i) => (
                            <Cell key={i} fill={COLORS[(i + 2) % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => navigate("/dashboard/users")}>إدارة المستخدمين</Button>
              <Button variant="outline" onClick={() => navigate("/dashboard/sellers")}>إدارة البائعين</Button>
              <Button variant="outline" onClick={() => navigate("/dashboard/admin-orders")}>الطلبات</Button>
              <Button variant="outline" onClick={() => navigate("/dashboard/reports")}>البلاغات</Button>
              <Button variant="outline" onClick={() => navigate("/dashboard/platform-products")}>منتجات المنصة</Button>
            </div>

            <p className="text-xs text-muted-foreground mt-6 text-center">
              آخر تحديث: {new Date(data.generated_at).toLocaleString("ar-SY")}
            </p>
          </>
        ) : null}
      </main>
      <Footer />
    </div>
  );
};

export default AdminAnalytics;