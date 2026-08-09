import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import SellerLayout from "@/components/seller/SellerLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, ShoppingBag, Undo2, Boxes, Wallet, Clock, AlertTriangle, PlusCircle } from "lucide-react";
import { LOW_STOCK_THRESHOLD, moderationBadgeClass, moderationLabel } from "@/lib/productModeration";

interface ProductRow {
  id: string;
  name: string;
  stock_quantity: number | null;
  moderation_status: string | null;
}

const currency = (n: number) => `${n.toLocaleString("ar-SY")} ل.س`;

const SellerHome = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [stats, setStats] = useState({
    total_orders: 0, completed_orders: 0, returned_orders: 0, products_sold: 0, estimated_revenue: 0,
  });

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const [{ data: prods }, { data: sales }] = await Promise.all([
        supabase
          .from("products")
          .select("id,name,stock_quantity,moderation_status")
          .eq("vendor_id", user.id)
          .order("created_at", { ascending: false }),
        supabase.rpc("get_vendor_sales_stats"),
      ]);
      const s: any = Array.isArray(sales) ? sales[0] : sales;
      setProducts((prods as ProductRow[]) ?? []);
      setStats({
        total_orders: Number(s?.total_orders ?? 0),
        completed_orders: Number(s?.completed_orders ?? 0),
        returned_orders: Number(s?.returned_orders ?? 0),
        products_sold: Number(s?.products_sold ?? 0),
        estimated_revenue: Number(s?.estimated_revenue ?? 0),
      });
      setLoading(false);
    })();
  }, [user]);

  const pending = products.filter((p) => p.moderation_status === "pending");
  const lowStock = products.filter((p) => (p.stock_quantity ?? 0) <= LOW_STOCK_THRESHOLD);

  const kpis = [
    { label: "المنتجات", value: products.length, icon: Package },
    { label: "الطلبات", value: stats.total_orders, icon: ShoppingBag },
    { label: "طلبات مكتملة", value: stats.completed_orders, icon: ShoppingBag },
    { label: "المرتجعات", value: stats.returned_orders, icon: Undo2 },
    { label: "قطع مبيعة", value: stats.products_sold, icon: Boxes },
    { label: "إيراد تقديري (الدفع عند الاستلام)", value: currency(stats.estimated_revenue), icon: Wallet },
  ];

  return (
    <SellerLayout
      title="لوحة البائع"
      description="كل ما يتعلق بالبيع في مكان واحد"
      actions={
        <Button asChild>
          <Link to="/dashboard/add-product"><PlusCircle className="me-2 h-4 w-4" /> إضافة منتج</Link>
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="p-4">
              <k.icon className="mb-2 h-4 w-4 text-primary" />
              <p className="text-xs text-muted-foreground">{k.label}</p>
              {loading ? <Skeleton className="mt-1 h-6 w-16" /> : <p className="text-lg font-bold">{k.value}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-amber-500" /> منتجات قيد مراجعة الإدارة ({pending.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <Skeleton className="h-20 w-full" />
            ) : pending.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا توجد منتجات بانتظار المراجعة.</p>
            ) : (
              pending.slice(0, 6).map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg border p-2">
                  <span className="truncate text-sm">{p.name}</span>
                  <Badge className={moderationBadgeClass(p.moderation_status)} variant="secondary">
                    {moderationLabel(p.moderation_status)}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-destructive" /> تنبيهات المخزون ({lowStock.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <Skeleton className="h-20 w-full" />
            ) : lowStock.length === 0 ? (
              <p className="text-sm text-muted-foreground">المخزون بحالة جيدة.</p>
            ) : (
              lowStock.slice(0, 6).map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg border p-2">
                  <span className="truncate text-sm">{p.name}</span>
                  <Badge variant={(p.stock_quantity ?? 0) === 0 ? "destructive" : "secondary"}>
                    {(p.stock_quantity ?? 0) === 0 ? "نفذت الكمية" : `متبقي ${p.stock_quantity}`}
                  </Badge>
                </div>
              ))
            )}
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link to="/seller/inventory">إدارة المخزون</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </SellerLayout>
  );
};

export default SellerHome;
