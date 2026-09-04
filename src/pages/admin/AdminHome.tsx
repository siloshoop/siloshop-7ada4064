import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AdminLayout, { useAdminModules } from "@/components/admin/AdminLayout";
import DashboardKpiGrid, { type Kpi } from "@/components/admin/DashboardKpiGrid";
import useAdminDashboard from "@/hooks/useAdminDashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  Archive,
  BadgeCheck,
  Ban,
  CheckCircle2,
  Clock,
  DollarSign,
  Hourglass,
  PackageCheck,
  PackageSearch,
  PackageX,
  RefreshCw,
  RotateCcw,
  ShoppingBag,
  Store,
  Truck,
  Undo2,
  Users,
  XCircle,
} from "lucide-react";

const fmt = (n: number) => new Intl.NumberFormat("ar-SY").format(Math.round(n || 0));
const money = (n: number) => `${fmt(n)} ل.س`;
const shortDay = (value: string) =>
  new Date(value).toLocaleDateString("ar-SY", { day: "numeric", month: "short" });

const STATUS_LABELS: Record<string, string> = {
  pending: "قيد الانتظار",
  confirmed: "مؤكد",
  preparing: "قيد التحضير",
  ready_for_shipping: "جاهز للشحن",
  shipped: "تم الشحن",
  out_for_delivery: "تم تسليم الطلب إلى مركز الشحن",
  delivered: "تم التوصيل",
  completed: "مكتمل",
  cancelled: "ملغي",
  returned: "مُرجع",
};

const PERIODS = [
  { days: 7, label: "7 أيام" },
  { days: 30, label: "30 يوم" },
  { days: 90, label: "90 يوم" },
];

const ChartCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <Card>
    <CardHeader className="pb-2">
      <CardTitle className="text-sm font-bold">{title}</CardTitle>
    </CardHeader>
    <CardContent className="h-[240px] pt-0">{children}</CardContent>
  </Card>
);

const AdminHome = () => {
  const { modules } = useAdminModules();
  const [days, setDays] = useState(30);
  const { data, loading, refreshing, error, reload } = useAdminDashboard(days);

  const kpis = useMemo<Kpi[]>(() => {
    if (!data) return [];
    const { orders, revenue, users, products } = data;
    return [
      { label: "إجمالي الإيرادات", value: money(revenue.total), hint: `متوسط الطلب ${money(revenue.avg_order_value)}`, icon: DollarSign, tone: "primary", href: "/admin/revenue" },
      { label: "إيرادات اليوم", value: money(revenue.today), hint: `${fmt(orders.today)} طلب اليوم`, icon: DollarSign, tone: "success", href: "/admin/revenue" },
      { label: "إيرادات الشهر", value: money(revenue.month), hint: `آخر ${days} يوم: ${money(revenue.period)}`, icon: DollarSign, tone: "success", href: "/admin/revenue" },
      { label: "إجمالي الطلبات", value: fmt(orders.total), hint: `${fmt(orders.period)} خلال ${days} يوم`, icon: ShoppingBag, tone: "primary", href: "/admin/orders" },
      { label: "طلبات قيد الانتظار", value: fmt(orders.pending), hint: "بحاجة إلى تأكيد", icon: Hourglass, tone: "warning", href: "/admin/orders?status=pending" },
      { label: "قيد التحضير", value: fmt(orders.preparing), hint: "لدى البائعين", icon: Clock, tone: "warning", href: "/admin/orders?status=preparing" },
      { label: "جاهز للشحن", value: fmt(orders.ready_for_shipping), hint: "بانتظار الشاحن", icon: PackageCheck, tone: "default", href: "/admin/orders?status=ready_for_shipping" },
      { label: "تم الشحن", value: fmt(orders.shipped), hint: `${fmt(orders.out_for_delivery)} في مركز الشحن`, icon: Truck, tone: "default", href: "/admin/orders?status=shipped" },
      { label: "تم التوصيل", value: fmt(orders.delivered), hint: "بانتظار الإكمال", icon: CheckCircle2, tone: "success", href: "/admin/orders?status=delivered" },
      { label: "مكتملة", value: fmt(orders.completed), hint: "مغلقة نهائياً", icon: BadgeCheck, tone: "success", href: "/admin/orders?status=completed" },
      { label: "ملغاة", value: fmt(orders.cancelled), hint: `${fmt(orders.frozen)} طلب مجمّد`, icon: XCircle, tone: "danger", href: "/admin/orders?status=cancelled" },
      { label: "بائعون نشطون", value: fmt(users.sellers_approved), hint: `${fmt(users.sellers_suspended)} موقوف`, icon: Store, tone: "primary", href: "/admin/sellers" },
      { label: "طلبات بائعين معلّقة", value: fmt(users.sellers_pending), hint: "بحاجة إلى مراجعة", icon: Hourglass, tone: "warning", href: "/admin/seller-applications" },
      { label: "عملاء نشطون", value: fmt(users.active_customers), hint: `${fmt(users.new_period)} مستخدم جديد`, icon: Users, tone: "primary", href: "/admin/buyers" },
      { label: "حسابات موقوفة", value: fmt(users.suspended), hint: `${fmt(users.banned)} محظور`, icon: Ban, tone: "danger", href: "/admin/buyers" },
      { label: "إجمالي المنتجات", value: fmt(products.total), hint: `${fmt(products.active)} منشور`, icon: PackageSearch, tone: "primary", href: "/admin/products" },
      { label: "منتجات معلّقة", value: fmt(products.pending), hint: "بانتظار الموافقة", icon: Hourglass, tone: "warning", href: "/admin/products?status=pending" },
      { label: "منتجات مقبولة", value: fmt(products.approved), hint: "معتمدة", icon: CheckCircle2, tone: "success", href: "/admin/products?status=approved" },
      { label: "منتجات مرفوضة", value: fmt(products.rejected), hint: "بحاجة إلى تعديل", icon: XCircle, tone: "danger", href: "/admin/products?status=rejected" },
      { label: "منتجات مؤرشفة", value: fmt(products.archived), hint: "غير منشورة", icon: Archive, tone: "default", href: "/admin/products" },
      { label: "مخزون منخفض", value: fmt(products.low_stock), hint: "5 قطع أو أقل", icon: AlertTriangle, tone: "warning", href: "/admin/products" },
      { label: "نفدت الكمية", value: fmt(products.out_of_stock), hint: "بحاجة إلى تزويد", icon: PackageX, tone: "danger", href: "/admin/products" },
      { label: "بلاغات مفتوحة", value: fmt(users.reports_pending), hint: "بحاجة إلى إجراء", icon: AlertTriangle, tone: "danger", href: "/admin/reports" },
    ];
  }, [data, days]);

  const series = useMemo(
    () => (data?.series ?? []).map((point) => ({ ...point, label: shortDay(point.day) })),
    [data],
  );
  const usersSeries = useMemo(
    () => (data?.users_series ?? []).map((point) => ({ ...point, label: shortDay(point.day) })),
    [data],
  );

  return (
    <AdminLayout
      title="لوحة تحكم الإدارة"
      description="مؤشرات مباشرة لكل عمليات المنصة: الطلبات، الإيرادات، البائعون والمنتجات."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {PERIODS.map((period) => (
            <Button
              key={period.days}
              size="sm"
              variant={days === period.days ? "default" : "outline"}
              onClick={() => setDays(period.days)}
            >
              {period.label}
            </Button>
          ))}
          <Button size="sm" variant="outline" onClick={reload} disabled={refreshing} className="gap-1.5">
            <RefreshCw className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            تحديث
          </Button>
        </div>
      }
    >
      {error && (
        <Card className="mb-4 border-destructive/40">
          <CardContent className="flex items-center gap-2 p-4 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" /> تعذّر تحميل المؤشرات: {error}
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 12 }).map((_, index) => (
            <Skeleton key={index} className="h-[92px] rounded-lg" />
          ))}
        </div>
      ) : (
        <DashboardKpiGrid kpis={kpis} />
      )}

      {!loading && data && (
        <>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <ChartCard title={`الإيرادات — آخر ${days} يوم`}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series}>
                  <defs>
                    <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={70} />
                  <Tooltip
                    formatter={(value: number) => money(value)}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, direction: "rtl" }}
                  />
                  <Area type="monotone" dataKey="revenue" name="الإيرادات" stroke="hsl(var(--primary))" fill="url(#revenueFill)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title={`الطلبات — آخر ${days} يوم`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} width={40} />
                  <Tooltip
                    formatter={(value: number) => fmt(value)}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, direction: "rtl" }}
                  />
                  <Bar dataKey="orders" name="الطلبات" fill="hsl(var(--accent))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title={`المستخدمون الجدد — آخر ${days} يوم`}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={usersSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} width={40} />
                  <Tooltip
                    formatter={(value: number) => fmt(value)}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, direction: "rtl" }}
                  />
                  <Line type="monotone" dataKey="users" name="مستخدمون جدد" stroke="hsl(var(--success))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold">أحدث الطلبات</CardTitle>
              </CardHeader>
              <CardContent className="max-h-[240px] space-y-2 overflow-y-auto pt-0">
                {data.latest_orders.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">لا توجد طلبات بعد</p>
                ) : (
                  data.latest_orders.map((order) => (
                    <Link
                      key={order.id}
                      to={`/admin/orders?order=${order.id}`}
                      className="flex items-center gap-3 rounded-lg border border-border/60 p-2.5 text-sm transition-colors hover:bg-muted/60"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{order.customer_name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          #{order.id.slice(0, 8)} — {new Date(order.created_at).toLocaleString("ar-SY")}
                        </p>
                      </div>
                      <Badge variant="secondary" className="shrink-0 text-[10px]">
                        {STATUS_LABELS[order.status] ?? order.status}
                      </Badge>
                      <span className="shrink-0 font-bold text-primary">{money(order.total_amount)}</span>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold">الأكثر مبيعاً</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {data.top_products.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">لا توجد مبيعات في هذه الفترة</p>
                ) : (
                  data.top_products.map((product, index) => (
                    <Link
                      key={product.id}
                      to={`/product/${product.id}`}
                      className="flex items-center gap-3 rounded-lg p-2 text-sm transition-colors hover:bg-muted/60"
                    >
                      <span className="w-5 text-center text-xs font-bold text-muted-foreground">{index + 1}</span>
                      {product.image_url ? (
                        <img src={product.image_url} alt="" loading="lazy" width={40} height={40} className="h-10 w-10 rounded-md object-cover" />
                      ) : (
                        <span className="h-10 w-10 rounded-md bg-muted" />
                      )}
                      <span className="min-w-0 flex-1 truncate font-medium">{product.name}</span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{fmt(product.units)} قطعة</span>
                      <span className="shrink-0 font-bold text-primary">{money(product.revenue)}</span>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold">أفضل البائعين</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {data.top_sellers.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">لا توجد مبيعات في هذه الفترة</p>
                ) : (
                  data.top_sellers.map((seller, index) => (
                    <Link
                      key={seller.id}
                      to={`/admin/users/${seller.id}`}
                      className="flex items-center gap-3 rounded-lg p-2 text-sm transition-colors hover:bg-muted/60"
                    >
                      <span className="w-5 text-center text-xs font-bold text-muted-foreground">{index + 1}</span>
                      <Store className="h-4 w-4 text-primary" />
                      <span className="min-w-0 flex-1 truncate font-medium">{seller.name}</span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{fmt(seller.orders)} طلب</span>
                      <span className="shrink-0 font-bold text-primary">{money(seller.revenue)}</span>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <h2 className="mb-4 mt-10 flex items-center gap-2 text-lg font-bold">
        <RotateCcw className="h-4 w-4 text-primary" /> وحدات الإدارة
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {modules
          .filter((module) => module.href !== "/admin")
          .map((module) => (
            <Link key={module.href} to={module.href} className="group">
              <Card className="h-full transition-transform group-hover:-translate-y-0.5 group-hover:shadow-lg">
                <CardContent className="flex items-start gap-3 p-4">
                  <span className="rounded-lg bg-primary/10 p-2 text-primary">
                    <module.icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-semibold">
                      {module.label}
                      {module.comingSoon && <Badge variant="secondary" className="text-[10px]">قريبًا</Badge>}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{module.description}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
      </div>
    </AdminLayout>
  );
};

export default AdminHome;
