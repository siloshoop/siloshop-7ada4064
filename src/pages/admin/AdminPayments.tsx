import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Search, Receipt } from "lucide-react";

interface PaymentRow {
  id: string;
  order_id: string;
  payment_method: string;
  payment_status: string;
  amount: number;
  currency: string;
  provider_reference: string | null;
  failure_reason: string | null;
  created_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "قيد الانتظار",
  paid: "مدفوع",
  completed: "مكتمل",
  failed: "فاشل",
  cancelled: "ملغي",
  refunded: "مُسترد",
};

const METHOD_LABEL: Record<string, string> = {
  cod: "دفع عند الاستلام",
  cash: "نقدي",
  sham_cash: "شام كاش",
  syriatel: "سيرياتيل كاش",
  mtn: "MTN كاش",
  card: "بطاقة",
  bank_transfer: "حوالة بنكية",
};

const statusVariant = (s: string) =>
  s === "paid" || s === "completed"
    ? "default"
    : s === "failed" || s === "cancelled"
      ? "destructive"
      : "secondary";

const money = (n: number, c: string) =>
  `${new Intl.NumberFormat("ar-SY").format(Math.round(n || 0))} ${c === "SYP" ? "ل.س" : c}`;

const FILTERS = ["all", "pending", "paid", "refunded", "failed"] as const;

const AdminPayments = () => {
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("payments")
        .select("id, order_id, payment_method, payment_status, amount, currency, provider_reference, failure_reason, created_at")
        .order("created_at", { ascending: false })
        .limit(300);
      if (cancelled) return;
      setRows((data as PaymentRow[]) ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== "all") {
        if (filter === "paid" && !["paid", "completed"].includes(r.payment_status)) return false;
        if (filter !== "paid" && r.payment_status !== filter) return false;
      }
      if (!q) return true;
      return (
        r.order_id.toLowerCase().includes(q) ||
        (r.provider_reference ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, filter, search]);

  const total = filtered
    .filter((r) => ["paid", "completed"].includes(r.payment_status))
    .reduce((s, r) => s + Number(r.amount || 0), 0);

  return (
    <AdminLayout
      title="المدفوعات"
      description="سجل المدفوعات للعرض فقط — لا يمكن تعديل حالة الدفع يدويًا من الواجهة."
      actions={
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList>
            <TabsTrigger value="all">الكل</TabsTrigger>
            <TabsTrigger value="pending">قيد الانتظار</TabsTrigger>
            <TabsTrigger value="paid">مدفوع</TabsTrigger>
            <TabsTrigger value="refunded">مُسترد</TabsTrigger>
            <TabsTrigger value="failed">فاشل</TabsTrigger>
          </TabsList>
        </Tabs>
      }
    >
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث برقم الطلب أو مرجع المزوّد..."
              className="pe-9"
            />
          </div>
          <Badge variant="secondary">{filtered.length} عملية</Badge>
          <Badge>{money(total, "SYP")} محصّلة</Badge>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">لا توجد عمليات مطابقة</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <Card key={r.id}>
              <CardContent className="flex flex-wrap items-center gap-3 p-4">
                <Receipt className="h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{money(Number(r.amount), r.currency)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    الطلب: {r.order_id.slice(0, 8)} · {new Date(r.created_at).toLocaleString("ar-SY")}
                  </p>
                  {r.provider_reference && (
                    <p className="truncate text-xs text-muted-foreground">مرجع: {r.provider_reference}</p>
                  )}
                  {r.failure_reason && (
                    <p className="truncate text-xs text-destructive">سبب الفشل: {r.failure_reason}</p>
                  )}
                </div>
                <Badge variant="outline">{METHOD_LABEL[r.payment_method] ?? r.payment_method}</Badge>
                <Badge variant={statusVariant(r.payment_status)}>
                  {STATUS_LABEL[r.payment_status] ?? r.payment_status}
                </Badge>
                <Button asChild variant="outline" size="sm">
                  <Link to={`/admin/orders?order=${r.order_id}`}>الطلب</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminPayments;
