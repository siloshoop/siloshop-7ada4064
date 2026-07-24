import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Search, Download, Eye, XCircle, Undo2, Truck, RefreshCw, ExternalLink } from "lucide-react";

type OrderRow = {
  id: string;
  created_at: string;
  updated_at: string;
  status: string;
  payment_status: string;
  total_amount: number;
  discount_amount: number | null;
  coupon_code: string | null;
  phone: string | null;
  shipping_address: string | null;
  tracking_number: string | null;
  courier_name: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  customer_id: string;
  customer_name: string | null;
  customer_email: string | null;
  items_count: number;
  vendors_count: number;
  total_count: number;
};

type DetailPayload = {
  order: any;
  items: Array<any>;
  payments: Array<any>;
  timeline: Array<{ id: string; status: string; notes: string | null; created_at: string }>;
  customer: any;
};

const STATUSES = ["pending", "confirmed", "processing", "shipped", "out_for_delivery", "delivered", "cancelled"];
const STATUS_LABEL: Record<string, string> = {
  pending: "قيد الانتظار",
  confirmed: "مؤكد",
  processing: "قيد التجهيز",
  shipped: "تم الشحن",
  out_for_delivery: "قيد التوصيل",
  delivered: "تم التوصيل",
  cancelled: "ملغي",
};
const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  confirmed: "default",
  processing: "default",
  shipped: "default",
  out_for_delivery: "default",
  delivered: "outline",
  cancelled: "destructive",
};

const PAY_STATUSES = ["pending", "completed", "failed", "refunded"];
const PAY_LABEL: Record<string, string> = {
  pending: "بانتظار الدفع",
  completed: "مدفوع",
  failed: "فشل",
  refunded: "مسترد",
};

const PAGE_SIZE = 25;

const AdminOrders = () => {
  const { isAdmin, loading: adminLoading } = useAdminCheck();
  const { toast } = useToast();

  const [rows, setRows] = useState<OrderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState<string>("all");
  const [payStatus, setPayStatus] = useState<string>("all");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");

  const [openDetail, setOpenDetail] = useState<OrderRow | null>(null);
  const [detail, setDetail] = useState<DetailPayload | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  // action forms
  const [nextStatus, setNextStatus] = useState<string>("processing");
  const [tracking, setTracking] = useState("");
  const [courier, setCourier] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [history, setHistory] = useState<Array<{ id: string; created_at: string; status: string; total_amount: number; role: string }>>([]);

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search); setPage(0); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_orders", {
      _search: debounced || null,
      _status: status === "all" ? null : status,
      _payment_status: payStatus === "all" ? null : payStatus,
      _from: from ? new Date(from).toISOString() : null,
      _to: to ? new Date(to + "T23:59:59").toISOString() : null,
      _limit: PAGE_SIZE,
      _offset: page * PAGE_SIZE,
    });
    if (error) {
      toast({ title: "تعذر تحميل الطلبات", description: error.message, variant: "destructive" });
      setRows([]); setTotal(0);
    } else {
      const list = (data as OrderRow[]) || [];
      setRows(list);
      setTotal(list[0]?.total_count ?? 0);
    }
    setLoading(false);
  }, [isAdmin, debounced, status, payStatus, from, to, page, toast]);

  useEffect(() => { load(); }, [load]);

  // Realtime refresh on order changes
  useEffect(() => {
    if (!isAdmin) return;
    const ch = supabase
      .channel("admin-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [isAdmin, load]);

  const openOrder = async (row: OrderRow) => {
    setOpenDetail(row);
    setDetail(null); setDetailLoading(true);
    setNextStatus(row.status || "processing");
    setTracking(row.tracking_number || "");
    setCourier(row.courier_name || "");
    setStatusNote(""); setCancelReason(""); setRefundReason("");
    const [{ data: d, error }, { data: h }] = await Promise.all([
      supabase.rpc("admin_get_order_detail", { _order_id: row.id }),
      supabase.rpc("admin_user_order_history", { _user_id: row.customer_id, _limit: 10 }),
    ]);
    if (error) toast({ title: "تعذر تحميل تفاصيل الطلب", description: error.message, variant: "destructive" });
    setDetail((d as unknown as DetailPayload) || null);
    setHistory((h as any[]) || []);
    setDetailLoading(false);
  };

  const closeDetail = () => { setOpenDetail(null); setDetail(null); setHistory([]); };

  const doUpdateStatus = async () => {
    if (!openDetail) return;
    setBusy(true);
    const { error } = await supabase.rpc("admin_update_order_status", {
      _order_id: openDetail.id,
      _status: nextStatus,
      _tracking_number: tracking || null,
      _courier_name: courier || null,
      _note: statusNote || null,
    });
    setBusy(false);
    if (error) return toast({ title: "تعذر التحديث", description: error.message, variant: "destructive" });
    toast({ title: "تم تحديث حالة الطلب" });
    await Promise.all([load(), openOrder(openDetail)]);
  };

  const doCancel = async () => {
    if (!openDetail) return;
    if (!cancelReason.trim()) return toast({ title: "يرجى إدخال سبب الإلغاء", variant: "destructive" });
    setBusy(true);
    const { error } = await supabase.rpc("admin_cancel_order", { _order_id: openDetail.id, _reason: cancelReason.trim() });
    setBusy(false);
    if (error) return toast({ title: "تعذر الإلغاء", description: error.message, variant: "destructive" });
    toast({ title: "تم إلغاء الطلب" });
    await Promise.all([load(), openOrder(openDetail)]);
  };

  const doRefund = async () => {
    if (!openDetail) return;
    if (!refundReason.trim()) return toast({ title: "يرجى إدخال سبب الاسترداد", variant: "destructive" });
    setBusy(true);
    const { error } = await supabase.rpc("admin_refund_order", { _order_id: openDetail.id, _reason: refundReason.trim() });
    setBusy(false);
    if (error) return toast({ title: "تعذر الاسترداد", description: error.message, variant: "destructive" });
    toast({ title: "تم تسجيل الاسترداد" });
    await Promise.all([load(), openOrder(openDetail)]);
  };

  const exportCSV = async () => {
    // Export current filter set (up to 1000 rows)
    const { data, error } = await supabase.rpc("admin_list_orders", {
      _search: debounced || null,
      _status: status === "all" ? null : status,
      _payment_status: payStatus === "all" ? null : payStatus,
      _from: from ? new Date(from).toISOString() : null,
      _to: to ? new Date(to + "T23:59:59").toISOString() : null,
      _limit: 1000,
      _offset: 0,
    });
    if (error) return toast({ title: "تعذر تصدير الطلبات", description: error.message, variant: "destructive" });
    const list = (data as OrderRow[]) || [];
    const headers = [
      "id","created_at","status","payment_status","total_amount","discount_amount","coupon_code",
      "customer_name","customer_email","phone","items_count","vendors_count","tracking_number","courier_name","delivered_at",
    ];
    const csv = [
      headers.join(","),
      ...list.map((r) => headers.map((h) => {
        const v = (r as any)[h];
        if (v === null || v === undefined) return "";
        const s = String(v).replace(/"/g, '""');
        return /[",\n]/.test(s) ? `"${s}"` : s;
      }).join(",")),
    ].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `orders-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  if (adminLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
    );
  }
  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">إدارة الطلبات</h1>
            <p className="text-sm text-muted-foreground">عرض كل الطلبات، البحث، الفلترة، التتبع، الإلغاء، والاسترداد.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className="h-4 w-4 ml-1" /> تحديث
            </Button>
            <Button onClick={exportCSV} disabled={loading || !rows.length}>
              <Download className="h-4 w-4 ml-1" /> تصدير CSV
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6 grid gap-3 md:grid-cols-6">
            <div className="md:col-span-2 relative">
              <Search className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث برقم الطلب، الهاتف، الاسم، البريد، رقم التتبع..."
                className="pr-9"
              />
            </div>
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(0); }}>
              <SelectTrigger><SelectValue placeholder="الحالة" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحالات</SelectItem>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={payStatus} onValueChange={(v) => { setPayStatus(v); setPage(0); }}>
              <SelectTrigger><SelectValue placeholder="حالة الدفع" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل حالات الدفع</SelectItem>
                {PAY_STATUSES.map((s) => <SelectItem key={s} value={s}>{PAY_LABEL[s]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(0); }} aria-label="من تاريخ" />
            <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(0); }} aria-label="إلى تاريخ" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">النتائج ({total.toLocaleString("ar")})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : rows.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">لا توجد طلبات مطابقة.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-right">الطلب</th>
                      <th className="px-3 py-2 text-right">العميل</th>
                      <th className="px-3 py-2 text-right">الحالة</th>
                      <th className="px-3 py-2 text-right">الدفع</th>
                      <th className="px-3 py-2 text-right">المبلغ</th>
                      <th className="px-3 py-2 text-right">التاريخ</th>
                      <th className="px-3 py-2 text-right">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="border-t">
                        <td className="px-3 py-2 font-mono text-xs">{r.id.slice(0, 8)}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col">
                            <span>{r.customer_name || "—"}</span>
                            <span className="text-xs text-muted-foreground">{r.customer_email || r.phone || ""}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2"><Badge variant={STATUS_VARIANT[r.status] || "default"}>{STATUS_LABEL[r.status] || r.status}</Badge></td>
                        <td className="px-3 py-2"><Badge variant="outline">{PAY_LABEL[r.payment_status] || r.payment_status}</Badge></td>
                        <td className="px-3 py-2 whitespace-nowrap">{Number(r.total_amount).toLocaleString("ar")} ل.س</td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("ar")}</td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => openOrder(r)}><Eye className="h-4 w-4" /></Button>
                            <Button asChild size="sm" variant="ghost"><Link to={`/orders/track/${r.id}`}><ExternalLink className="h-4 w-4" /></Link></Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">صفحة {page + 1} من {totalPages}</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 0 || loading} onClick={() => setPage((p) => Math.max(0, p - 1))}>السابق</Button>
            <Button size="sm" variant="outline" disabled={page + 1 >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>التالي</Button>
          </div>
        </div>
      </main>

      <Dialog open={!!openDetail} onOpenChange={(o) => !o && closeDetail()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تفاصيل الطلب {openDetail?.id.slice(0, 8)}</DialogTitle>
            <DialogDescription>عرض ومعالجة الطلب من قِبَل الإدارة.</DialogDescription>
          </DialogHeader>

          {detailLoading || !detail ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2 text-sm">
                <div className="rounded border p-3">
                  <p className="font-semibold mb-1">العميل</p>
                  <p>{detail.customer?.full_name || "—"}</p>
                  <p className="text-muted-foreground text-xs">{detail.customer?.email}</p>
                  <p className="text-muted-foreground text-xs">{detail.customer?.phone || openDetail?.phone}</p>
                  {detail.customer?.account_status && detail.customer.account_status !== "active" && (
                    <Badge variant="destructive" className="mt-1">{detail.customer.account_status}</Badge>
                  )}
                </div>
                <div className="rounded border p-3">
                  <p className="font-semibold mb-1">الشحن</p>
                  <p className="text-xs text-muted-foreground">{detail.order?.shipping_address || "—"}</p>
                  <p className="text-xs mt-1">شركة الشحن: {detail.order?.courier_name || "—"}</p>
                  <p className="text-xs">رقم التتبع: {detail.order?.tracking_number || "—"}</p>
                </div>
              </div>

              <div>
                <p className="font-semibold mb-2 text-sm">المنتجات ({detail.items.length})</p>
                <div className="space-y-2">
                  {detail.items.map((it: any) => (
                    <div key={it.id} className="flex items-center gap-3 rounded border p-2">
                      {it.product_image && <img src={it.product_image} alt="" className="h-12 w-12 rounded object-cover" />}
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm">{it.product_name || "منتج"}</p>
                        <p className="text-xs text-muted-foreground">البائع: {it.vendor_name || "—"}</p>
                      </div>
                      <div className="text-xs whitespace-nowrap">{it.quantity} × {Number(it.price).toLocaleString("ar")} ل.س</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 text-sm">
                <div className="rounded border p-3">
                  <p className="font-semibold mb-2">الجدول الزمني</p>
                  <ul className="space-y-1 max-h-40 overflow-y-auto">
                    {detail.timeline.length === 0 && <li className="text-xs text-muted-foreground">لا توجد أحداث.</li>}
                    {detail.timeline.map((t) => (
                      <li key={t.id} className="text-xs">
                        <span className="text-muted-foreground">{new Date(t.created_at).toLocaleString("ar")}</span>
                        {" — "}<b>{STATUS_LABEL[t.status] || t.status}</b>
                        {t.notes ? ` — ${t.notes}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded border p-3">
                  <p className="font-semibold mb-2">آخر طلبات هذا العميل</p>
                  <ul className="space-y-1 max-h-40 overflow-y-auto">
                    {history.length === 0 && <li className="text-xs text-muted-foreground">—</li>}
                    {history.map((h) => (
                      <li key={`${h.role}-${h.id}`} className="text-xs flex justify-between gap-2">
                        <Link to={`/orders/track/${h.id}`} className="underline">{h.id.slice(0, 8)}</Link>
                        <span className="text-muted-foreground">{h.role}</span>
                        <span>{STATUS_LABEL[h.status] || h.status}</span>
                        <span>{Number(h.total_amount).toLocaleString("ar")} ل.س</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Actions */}
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded border p-3 space-y-2">
                  <p className="font-semibold text-sm flex items-center gap-1"><Truck className="h-4 w-4" /> تحديث الحالة والشحن</p>
                  <Select value={nextStatus} onValueChange={setNextStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input value={courier} onChange={(e) => setCourier(e.target.value)} placeholder="شركة الشحن" />
                  <Input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="رقم التتبع" />
                  <Textarea value={statusNote} onChange={(e) => setStatusNote(e.target.value)} placeholder="ملاحظة (اختياري)" rows={2} />
                  <Button onClick={doUpdateStatus} disabled={busy} size="sm">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "حفظ التحديث"}
                  </Button>
                </div>

                <div className="space-y-3">
                  <div className="rounded border p-3 space-y-2">
                    <p className="font-semibold text-sm flex items-center gap-1 text-destructive"><XCircle className="h-4 w-4" /> إلغاء الطلب</p>
                    <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="سبب الإلغاء" rows={2} />
                    <Button size="sm" variant="destructive" onClick={doCancel} disabled={busy || ["delivered","cancelled"].includes(openDetail?.status || "")}>
                      تأكيد الإلغاء
                    </Button>
                  </div>
                  <div className="rounded border p-3 space-y-2">
                    <p className="font-semibold text-sm flex items-center gap-1"><Undo2 className="h-4 w-4" /> استرداد المبلغ</p>
                    <Textarea value={refundReason} onChange={(e) => setRefundReason(e.target.value)} placeholder="سبب الاسترداد" rows={2} />
                    <Button size="sm" variant="outline" onClick={doRefund} disabled={busy || openDetail?.payment_status === "refunded"}>
                      تسجيل الاسترداد
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeDetail}>إغلاق</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

export default AdminOrders;