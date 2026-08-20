import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import SellerLayout from "@/components/seller/SellerLayout";
import SellerOrderDetailSheet from "@/components/seller/SellerOrderDetailSheet";
import OrderStatusBadge from "@/components/orders/OrderStatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Loader2, Search, Package, Clock, Boxes, Truck, Home, XCircle, Wallet, Lock, ChevronRight, ChevronLeft,
} from "lucide-react";
import { ORDER_STATUSES, normalizeStatus } from "@/lib/orderStatus";
import { fetchSellerOrders, type SellerOrderRow } from "@/lib/sellerOrders";
import { useToast } from "@/hooks/use-toast";

const PAGE_SIZE = 20;

interface Kpis {
  pending: number;
  preparing: number;
  shipped: number;
  delivered: number;
  cancelled: number;
  revenue: number;
}

const VendorOrders = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [rows, setRows] = useState<SellerOrderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);
  const [selectedOrder, setSelectedOrder] = useState<SellerOrderRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [kpis, setKpis] = useState<Kpis>({ pending: 0, preparing: 0, shipped: 0, delivered: 0, cancelled: 0, revenue: 0 });

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { rows: data, total: count } = await fetchSellerOrders({
        search: search.trim() || undefined,
        status,
        from: dateFrom ? new Date(`${dateFrom}T00:00:00`).toISOString() : null,
        to: dateTo ? new Date(`${dateTo}T23:59:59`).toISOString() : null,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setRows(data);
      setTotal(count);
    } catch (e) {
      toast({
        title: "خطأ",
        description: (e as { message?: string })?.message || "فشل في جلب الطلبات",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user, search, status, dateFrom, dateTo, page, toast]);

  const loadKpis = useCallback(async () => {
    if (!user) return;
    try {
      const { rows: all } = await fetchSellerOrders({ limit: 1000, offset: 0 });
      const next: Kpis = { pending: 0, preparing: 0, shipped: 0, delivered: 0, cancelled: 0, revenue: 0 };
      for (const r of all) {
        const s = normalizeStatus(r.status);
        if (s === "pending") next.pending++;
        else if (s === "preparing" || s === "confirmed") next.preparing++;
        else if (s === "shipped" || s === "out_for_delivery" || s === "ready_for_shipping") next.shipped++;
        else if (s === "delivered" || s === "completed") next.delivered++;
        else if (s === "cancelled" || s === "returned") next.cancelled++;
        if (s !== "cancelled" && s !== "returned") next.revenue += Number(r.vendor_subtotal || 0);
      }
      setKpis(next);
    } catch {
      /* non-fatal */
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadKpis(); }, [loadKpis]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`vendor-orders-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        load();
        loadKpis();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, load, loadKpis]);

  useEffect(() => { setPage(0); }, [search, status, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const kpiCards = useMemo(() => ([
    { label: "قيد الانتظار", value: kpis.pending, icon: Clock, token: "--status-pending" },
    { label: "قيد التجهيز", value: kpis.preparing, icon: Boxes, token: "--status-preparing" },
    { label: "تم الشحن", value: kpis.shipped, icon: Truck, token: "--status-shipped" },
    { label: "تم التسليم", value: kpis.delivered, icon: Home, token: "--status-delivered" },
    { label: "ملغي", value: kpis.cancelled, icon: XCircle, token: "--status-cancelled" },
  ]), [kpis]);

  const openOrder = (order: SellerOrderRow) => {
    setSelectedOrder(order);
    setSheetOpen(true);
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <SellerLayout title="إدارة الطلبات" description="تتبع طلبات عملائك وحدّث حالتها لحظيًا">
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {kpiCards.map((k) => (
            <Card key={k.label}>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-lg p-2" style={{ backgroundColor: `hsl(var(${k.token}) / 0.12)` }}>
                  <k.icon className="h-4 w-4" style={{ color: `hsl(var(${k.token}))` }} />
                </div>
                <div>
                  <p className="text-lg font-bold">{k.value}</p>
                  <p className="text-xs text-muted-foreground">{k.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-lg bg-primary/10 p-2">
                <Wallet className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-lg font-bold">{kpis.revenue.toLocaleString("ar-SY")} ل.س</p>
                <p className="text-xs text-muted-foreground">إيرادات فعّالة</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="flex flex-wrap items-end gap-3 p-4">
            <div className="min-w-[220px] flex-1">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="بحث برقم الطلب، الهاتف أو اسم المنتج"
                  className="pr-9"
                />
              </div>
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="كل الحالات" />
              </SelectTrigger>
              <SelectContent className="bg-background">
                <SelectItem value="all">كل الحالات</SelectItem>
                {ORDER_STATUSES.map((s) => (
                  <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[150px]" />
              <span className="text-sm text-muted-foreground">إلى</span>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[150px]" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
                <Package className="h-10 w-10" />
                <p>لا توجد طلبات مطابقة</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table dir="rtl">
                  <TableHeader>
                    <TableRow>
                      <TableHead>رقم الطلب</TableHead>
                      <TableHead>التاريخ</TableHead>
                      <TableHead>العميل</TableHead>
                      <TableHead>المدينة</TableHead>
                      <TableHead>المنتجات</TableHead>
                      <TableHead>الإجمالي</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((order) => (
                      <TableRow key={order.id} className="cursor-pointer" onClick={() => openOrder(order)}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            #{order.order_number || order.id.slice(0, 8)}
                            {order.is_frozen && <Lock className="h-3.5 w-3.5 text-destructive" />}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString("ar-SY", { year: "numeric", month: "short", day: "numeric" })}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{order.customer_name || "غير متوفر"}</div>
                          <div className="text-xs text-muted-foreground">{order.customer_phone || ""}</div>
                        </TableCell>
                        <TableCell className="text-sm">{order.city || "—"}</TableCell>
                        <TableCell className="text-sm">{order.items_count}</TableCell>
                        <TableCell className="text-sm font-semibold">
                          {Number(order.vendor_subtotal || 0).toLocaleString("ar-SY")} ل.س
                        </TableCell>
                        <TableCell><OrderStatusBadge status={order.status} /></TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); openOrder(order); }}>
                            التفاصيل
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {total > 0 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>إجمالي {total} طلب</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <span>صفحة {page + 1} من {totalPages}</span>
              <Button variant="outline" size="icon" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <SellerOrderDetailSheet
        order={selectedOrder}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onChanged={() => { load(); loadKpis(); }}
      />
    </SellerLayout>
  );
};

export default VendorOrders;
