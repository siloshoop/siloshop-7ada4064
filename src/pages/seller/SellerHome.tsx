import { Link } from "react-router-dom";
import { useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import SellerLayout from "@/components/seller/SellerLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle, Boxes, Clock, Eye, MessageSquare, Package, PlusCircle, RefreshCw, ShoppingBag,
  Star, Undo2, Wallet,
} from "lucide-react";
import useSellerDashboard from "@/hooks/useSellerDashboard";
import { ORDER_STATUS_LABELS } from "@/lib/orderStatus";

const currency = (n: number) => `${Math.round(Number(n) || 0).toLocaleString("ar-SY")} ل.س`;
const num = (n: number) => (Number(n) || 0).toLocaleString("ar-SY");
const shortDate = (d: string) => new Date(d).toLocaleDateString("ar-SY", { day: "numeric", month: "short" });

const SellerHome = () => {
  const [days, setDays] = useState(30);
  const { data, loading, refreshing, error, reload } = useSellerDashboard(days);

  const s = data?.sales ?? {};
  const o = data?.orders ?? {};
  const p = data?.products ?? {};
  const e = data?.engagement ?? {};
  const w = data?.wallet;

  const views = Number(e.views_period ?? 0);
  const conversion = views > 0 ? ((Number(o.period ?? 0) / views) * 100).toFixed(1) : "0.0";

  const groups: { title: string; items: { label: string; value: string; icon: typeof Wallet; tone?: string }[] }[] = [
    {
      title: "المبيعات والأرصدة",
      items: [
        { label: "مبيعات اليوم", value: currency(Number(s.today ?? 0)), icon: Wallet },
        { label: "مبيعات الأمس", value: currency(Number(s.yesterday ?? 0)), icon: Wallet },
        { label: "مبيعات الأسبوع", value: currency(Number(s.week ?? 0)), icon: Wallet },
        { label: "مبيعات الشهر", value: currency(Number(s.month ?? 0)), icon: Wallet },
        { label: "إجمالي الإيراد", value: currency(Number(s.total ?? 0)), icon: Wallet },
        { label: "الرصيد القابل للسحب", value: currency(Number(w?.withdrawable ?? 0)), icon: Wallet, tone: "text-primary" },
        { label: "رصيد معلّق", value: currency(Number(w?.pending_revenue ?? 0)), icon: Clock },
        { label: "قطع مبيعة", value: num(Number(s.units_sold ?? 0)), icon: Boxes },
      ],
    },
    {
      title: "الطلبات",
      items: [
        { label: "إجمالي الطلبات", value: num(Number(o.total ?? 0)), icon: ShoppingBag },
        { label: "بانتظار التأكيد", value: num(Number(o.pending ?? 0)), icon: ShoppingBag },
        { label: "قيد التجهيز", value: num(Number(o.preparing ?? 0)), icon: ShoppingBag },
        { label: "جاهز للشحن", value: num(Number(o.ready_for_shipping ?? 0)), icon: ShoppingBag },
        { label: "تم الشحن", value: num(Number(o.shipped ?? 0)), icon: ShoppingBag },
        { label: "في مركز الشحن", value: num(Number(o.out_for_delivery ?? 0)), icon: ShoppingBag },
        { label: "تم التسليم", value: num(Number(o.delivered ?? 0)), icon: ShoppingBag },
        { label: "مكتملة", value: num(Number(o.completed ?? 0)), icon: ShoppingBag },
        { label: "ملغاة", value: num(Number(o.cancelled ?? 0)), icon: AlertTriangle },
      ],
    },
    {
      title: "المنتجات والأداء",
      items: [
        { label: "إجمالي المنتجات", value: num(Number(p.total ?? 0)), icon: Package },
        { label: "منتجات نشطة", value: num(Number(p.active ?? 0)), icon: Package },
        { label: "قيد المراجعة", value: num(Number(p.pending ?? 0)), icon: Clock },
        { label: "مرفوضة", value: num(Number(p.rejected ?? 0)), icon: AlertTriangle },
        { label: "مؤرشفة", value: num(Number(p.archived ?? 0)), icon: Package },
        { label: "نفذت الكمية", value: num(Number(p.out_of_stock ?? 0)), icon: AlertTriangle },
        { label: "مخزون منخفض", value: num(Number(p.low_stock ?? 0)), icon: AlertTriangle },
        { label: "مشاهدات المنتجات", value: num(views), icon: Eye },
        { label: "معدل التحويل", value: `${conversion}%`, icon: Eye },
        { label: "متوسط التقييم", value: `${Number(e.avg_rating ?? 0)} / 5`, icon: Star },
        { label: "رسائل غير مقروءة", value: num(Number(e.unread_messages ?? 0)), icon: MessageSquare },
        { label: "عملاء", value: num(Number(e.customers ?? 0)), icon: Boxes },
      ],
    },
  ];

  const series = (data?.series ?? []).map((pt) => ({ ...pt, label: shortDate(pt.date) }));

  return (
    <SellerLayout
      title="لوحة البائع"
      description="مركز إدارة متجرك — بيانات مباشرة من قاعدة البيانات"
      actions={
        <div className="flex items-center gap-2">
          <Tabs value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <TabsList>
              <TabsTrigger value="7">٧ أيام</TabsTrigger>
              <TabsTrigger value="30">٣٠ يوم</TabsTrigger>
              <TabsTrigger value="90">٩٠ يوم</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" size="icon" onClick={reload} aria-label="تحديث" disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
          <Button asChild>
            <Link to="/dashboard/add-product"><PlusCircle className="me-2 h-4 w-4" /> إضافة منتج</Link>
          </Button>
        </div>
      }
    >
      {error && (
        <Card className="mb-4 border-destructive/40">
          <CardContent className="p-4 text-sm text-destructive">تعذّر تحميل بيانات اللوحة: {error}</CardContent>
        </Card>
      )}

      {groups.map((g) => (
        <section key={g.title} className="mb-6">
          <h2 className="mb-3 text-sm font-bold text-muted-foreground">{g.title}</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
            {g.items.map((k) => (
              <Card key={k.label}>
                <CardContent className="p-4">
                  <k.icon className="mb-2 h-4 w-4 text-primary" />
                  <p className="text-xs text-muted-foreground">{k.label}</p>
                  {loading ? (
                    <Skeleton className="mt-1 h-6 w-16" />
                  ) : (
                    <p className={`text-base font-bold ${k.tone ?? ""}`}>{k.value}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ))}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">الإيرادات</CardTitle></CardHeader>
          <CardContent className="h-64">
            {loading ? <Skeleton className="h-full w-full" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={60} />
                  <Tooltip formatter={(v: number) => currency(v)} />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.2)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">الطلبات</CardTitle></CardHeader>
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
          <CardHeader className="pb-2"><CardTitle className="text-base">الزوّار (مشاهدات المنتجات)</CardTitle></CardHeader>
          <CardContent className="h-64">
            {loading ? <Skeleton className="h-full w-full" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={40} />
                  <Tooltip />
                  <Line type="monotone" dataKey="views" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">الأكثر مبيعاً</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {loading ? <Skeleton className="h-40 w-full" /> : (data?.top_products ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">لا توجد مبيعات بعد.</p>
            ) : (
              data!.top_products.map((tp) => (
                <Link key={tp.id} to={`/product/${tp.id}`} className="flex items-center gap-3 rounded-lg border p-2 hover:bg-muted">
                  <img src={tp.image_url || "/placeholder.svg"} alt={tp.name} loading="lazy" className="h-10 w-10 rounded-md object-cover" />
                  <span className="min-w-0 flex-1 truncate text-sm">{tp.name}</span>
                  <Badge variant="secondary">{num(tp.units)} قطعة</Badge>
                  <span className="text-xs text-muted-foreground">{currency(tp.revenue)}</span>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">أحدث الطلبات</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {loading ? <Skeleton className="h-40 w-full" /> : (data?.latest_orders ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">لا توجد طلبات بعد.</p>
            ) : (
              data!.latest_orders.map((ord) => (
                <div key={ord.id} className="flex items-center justify-between gap-2 rounded-lg border p-2 text-sm">
                  <span className="font-mono text-xs">#{ord.id.slice(0, 8)}</span>
                  <Badge variant="secondary">{ORDER_STATUS_LABELS[ord.status ?? "pending"] ?? ord.status}</Badge>
                  <span className="text-xs text-muted-foreground">{currency(ord.total_amount)}</span>
                </div>
              ))
            )}
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link to="/dashboard/orders">كل الطلبات</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">أحدث التقييمات والرسائل</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {loading ? <Skeleton className="h-40 w-full" /> : (
              <>
                {(data?.latest_reviews ?? []).map((r) => (
                  <div key={r.id} className="rounded-lg border p-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Star className="h-3.5 w-3.5 text-primary" />
                      <span className="font-bold">{r.rating}/5</span>
                      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{r.product_name}</span>
                    </div>
                    {r.comment && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{r.comment}</p>}
                  </div>
                ))}
                {(data?.latest_messages ?? []).map((m) => (
                  <Link key={m.id} to="/messages" className="flex items-center gap-2 rounded-lg border p-2 text-sm hover:bg-muted">
                    <MessageSquare className="h-3.5 w-3.5 text-primary" />
                    <span className="min-w-0 flex-1 truncate text-xs">{m.content || "مرفق"}</span>
                    {!m.is_read && <Badge variant="destructive" className="text-[10px]">جديد</Badge>}
                  </Link>
                ))}
                {(data?.latest_reviews ?? []).length === 0 && (data?.latest_messages ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground">لا يوجد نشاط جديد.</p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </SellerLayout>
  );
};

export default SellerHome;
