import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout, { useAdminModules } from "@/components/admin/AdminLayout";
import { FUTURE_MODULES } from "@/components/admin/adminModules";
import useFeatureFlags from "@/hooks/useFeatureFlags";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users, Store, ShoppingBag, DollarSign, PackageSearch, Flag, Loader2,
} from "lucide-react";

interface Analytics {
  users: { total: number; customers: number; vendors: number };
  sellers: { approved: number; pending: number };
  orders: { total: number; pending: number; revenue_total: number; revenue_period: number };
  products: { total: number; pending: number };
  reports: { pending: number };
}

const fmt = (n: number) =>
  new Intl.NumberFormat("ar-SY").format(Math.round(n || 0));
const money = (n: number) => `${fmt(n)} ل.س`;

const AdminHome = () => {
  const { modules } = useAdminModules();
  const { isEnabled } = useFeatureFlags();
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: res } = await supabase.rpc("admin_get_analytics", { _days: 30 });
      if (cancelled) return;
      setData((res as unknown as Analytics) ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const kpis = data
    ? [
        { label: "المستخدمون", value: fmt(data.users.total), hint: `${fmt(data.users.customers)} مشترٍ`, icon: Users },
        { label: "البائعون المعتمدون", value: fmt(data.sellers.approved), hint: `${fmt(data.sellers.pending)} طلب قيد المراجعة`, icon: Store },
        { label: "الطلبات", value: fmt(data.orders.total), hint: `${fmt(data.orders.pending)} قيد الانتظار`, icon: ShoppingBag },
        { label: "إيرادات 30 يوم", value: money(data.orders.revenue_period), hint: `الإجمالي ${money(data.orders.revenue_total)}`, icon: DollarSign },
        { label: "منتجات بانتظار المراجعة", value: fmt(data.products.pending), hint: `${fmt(data.products.total)} منتج إجمالاً`, icon: PackageSearch },
        { label: "بلاغات مفتوحة", value: fmt(data.reports.pending), hint: "بحاجة إلى إجراء", icon: Flag },
      ]
    : [];

  const hiddenFuture = FUTURE_MODULES.filter((m) => !m.featureFlag || !isEnabled(m.featureFlag));

  return (
    <AdminLayout
      title="لوحة تحكم الإدارة"
      description="إدارة كاملة للمنصة: المستخدمون، المتاجر، المنتجات، الطلبات والمحتوى."
    >
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {kpis.map((k) => (
            <Card key={k.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{k.label}</CardTitle>
                <k.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{k.value}</div>
                <p className="mt-1 text-xs text-muted-foreground">{k.hint}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <h2 className="mb-4 mt-10 text-lg font-bold">وحدات الإدارة</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modules
          .filter((m) => m.href !== "/admin")
          .map((m) => (
            <Link key={m.href} to={m.href} className="group">
              <Card className="h-full transition-transform group-hover:-translate-y-0.5 group-hover:shadow-lg">
                <CardContent className="flex items-start gap-3 p-5">
                  <span className="rounded-lg bg-primary/10 p-2 text-primary">
                    <m.icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-semibold">
                      {m.label}
                      {m.comingSoon && <Badge variant="secondary" className="text-[10px]">قريبًا</Badge>}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
      </div>

      {hiddenFuture.length > 0 && (
        <>
          <h2 className="mb-3 mt-10 text-lg font-bold">وحدات مستقبلية (غير مفعّلة)</h2>
          <Card>
            <CardContent className="space-y-3 p-5">
              {hiddenFuture.map((m) => (
                <div key={m.href} className="flex items-center gap-3 text-sm">
                  <m.icon className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{m.label}</span>
                  <span className="text-muted-foreground">— {m.description}</span>
                  <Badge variant="outline" className="ms-auto">مخفية</Badge>
                </div>
              ))}
              <p className="pt-2 text-xs text-muted-foreground">
                تظهر هذه الوحدات تلقائياً بعد تفعيل خصائصها من صفحة{" "}
                <Link to="/admin/features" className="text-primary underline">خصائص المنصة</Link>.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </AdminLayout>
  );
};

export default AdminHome;