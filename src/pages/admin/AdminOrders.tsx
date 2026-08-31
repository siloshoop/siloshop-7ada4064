import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2, Search, Download, Eye, Snowflake, Unlock, Truck, RefreshCw,
  ExternalLink, ShieldAlert, ScrollText, MessageSquare, Lock,
} from "lucide-react";
import OrderStatusBadge from "@/components/orders/OrderStatusBadge";
import OrderTimelineLog from "@/components/orders/OrderTimelineLog";
import ShippingInfoDialog from "@/components/orders/ShippingInfoDialog";
import {
  ORDER_STATUSES, ORDER_STATUS_LABELS, changeOrderStatus, setOrderFreeze, reopenOrder,
  friendlyOrderError, normalizeStatus, type OrderStatus,
} from "@/lib/orderStatus";

type OrderRow = {
  id: string;
  order_number: string | null;
  invoice_number: string | null;
  payment_method: string | null;
  estimated_delivery: string | null;
  is_frozen: boolean | null;
  created_at: string;
  status: string;
  payment_status: string;
  total_amount: number;
  phone: string | null;
  tracking_number: string | null;
  courier_name: string | null;
  customer_id: string;
  customer_name: string | null;
  customer_email: string | null;
  items_count: number;
  vendors_count: number;
  total_count: number;
};

type OrderNote = {
  id: string;
  note: string;
  is_internal: boolean;
  author_name: string | null;
  author_role: string | null;
  created_at: string;
};

type DetailPayload = {
  order: Record<string, any>;
  items: Array<Record<string, any>>;
  payments: Array<Record<string, any>>;
  customer: Record<string, any> | null;
};

const PAY_STATUSES = ["pending", "completed", "failed", "refunded"];
const PAY_LABEL: Record<string, string> = {
  pending: "بانتظار الدفع", completed: "مدفوع", failed: "فشل", refunded: "مسترد",
};
const REOPEN_TARGETS: OrderStatus[] = ["pending", "confirmed", "preparing", "ready_for_shipping", "shipped"];
const PAGE_SIZE = 50;
const money = (n: unknown) => `${Number(n ?? 0).toLocaleString("ar-SY")} ل.س`;
const orderLabel = (r: { order_number?: string | null; id: string }) => r.order_number || `#${r.id.slice(0, 8)}`;

const AdminOrders = () => {
  const { toast } = useToast();

  const [rows, setRows] = useState<OrderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState("all");
  const [payStatus, setPayStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");

  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailPayload | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shippingOpen, setShippingOpen] = useState(false);

  // action forms
  const [nextStatus, setNextStatus] = useState<OrderStatus>("confirmed");
  const [override, setOverride] = useState(false);
  const [statusNote, setStatusNote] = useState("");
  const [freezeReason, setFreezeReason] = useState("");
  const [reopenStatus, setReopenStatus] = useState<OrderStatus>("confirmed");
  const [reopenReason, setReopenReason] = useState("");
  const [history, setHistory] = useState<Array<{ id: string; status: string; total_amount: number; role: string }>>([]);

  // notes thread
  const [notes, setNotes] = useState<OrderNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [noteInternal, setNoteInternal] = useState(true);
  const [savingNote, setSavingNote] = useState(false);

  // quick shipping update (update_order_shipping)
  const [shipCompany, setShipCompany] = useState("");
  const [shipTracking, setShipTracking] = useState("");
  const [shipNotes, setShipNotes] = useState("");
  const [shipEta, setShipEta] = useState("");
  const [savingShip, setSavingShip] = useState(false);

  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search); setPage(0); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
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
      toast({ title: "تعذر تحميل الطلبات", description: friendlyOrderError(error), variant: "destructive" });
      setRows([]); setTotal(0);
    } else {
      const list = (data as unknown as OrderRow[]) || [];
      setRows(list);
      setTotal(list[0]?.total_count ?? 0);
    }
    setLoading(false);
  }, [debounced, status, payStatus, from, to, page, toast]);

  useEffect(() => { void load(); }, [load]);

  const loadNotes = useCallback(async (orderId: string) => {
    setNotesLoading(true);
    const { data, error } = await supabase.rpc("list_order_notes", { _order_id: orderId });
    if (error) toast({ title: "تعذر تحميل الملاحظات", description: friendlyOrderError(error), variant: "destructive" });
    setNotes((data as unknown as OrderNote[]) || []);
    setNotesLoading(false);
  }, [toast]);

  // Realtime refresh
  useEffect(() => {
    const ch = supabase
      .channel("admin-orders-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => void load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const openOrder = useCallback(async (orderId: string, customerId?: string) => {
    setOpenId(orderId);
    setDetail(null); setDetailLoading(true);
    setStatusNote(""); setFreezeReason(""); setReopenReason("");
    setOverride(false); setNewNote(""); setNoteInternal(true);
    setShipCompany(""); setShipTracking(""); setShipNotes(""); setShipEta("");
    const [{ data: d, error }, { data: h }] = await Promise.all([
      supabase.rpc("admin_get_order_detail", { _order_id: orderId }),
      customerId
        ? supabase.rpc("admin_user_order_history", { _user_id: customerId, _limit: 10 })
        : Promise.resolve({ data: [] as unknown }),
    ]);
    if (error) toast({ title: "تعذر تحميل تفاصيل الطلب", description: friendlyOrderError(error), variant: "destructive" });
    const payload = (d as unknown as DetailPayload) || null;
    setDetail(payload);
    setHistory((h as any[]) || []);
    setNextStatus(normalizeStatus(payload?.order?.status));
    setReopenStatus("confirmed");
    setDetailLoading(false);
    void loadNotes(orderId);
  }, [toast, loadNotes]);

  const refreshDetail = async () => {
    if (!openId) return;
    await Promise.all([load(), openOrder(openId, detail?.order?.customer_id)]);
  };

  const run = async (fn: () => Promise<void>, successTitle: string) => {
    setBusy(true);
    try {
      await fn();
      toast({ title: successTitle });
      await refreshDetail();
    } catch (e) {
      toast({ title: "تعذر تنفيذ العملية", description: friendlyOrderError(e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const order = detail?.order;
  const isFrozen = !!order?.is_frozen;
  const isClosed = ["cancelled", "completed", "returned"].includes(normalizeStatus(order?.status));

  const CSV_COLUMNS: Array<{ key: keyof OrderRow; label: string }> = [
    { key: "order_number", label: "رقم الطلب" },
    { key: "invoice_number", label: "رقم الفاتورة" },
    { key: "created_at", label: "التاريخ" },
    { key: "status", label: "الحالة" },
    { key: "payment_status", label: "حالة الدفع" },
    { key: "payment_method", label: "طريقة الدفع" },
    { key: "total_amount", label: "المبلغ" },
    { key: "customer_name", label: "اسم العميل" },
    { key: "customer_email", label: "البريد الإلكتروني" },
    { key: "phone", label: "الهاتف" },
    { key: "items_count", label: "عدد المنتجات" },
    { key: "vendors_count", label: "عدد البائعين" },
    { key: "tracking_number", label: "رقم التتبع" },
    { key: "courier_name", label: "شركة الشحن" },
  ];

  const exportCSV = async () => {
    setExporting(true);
    try {
      const all: OrderRow[] = [];
      let offset = 0;
      const chunk = 200;
      let totalCount = Infinity;
      while (offset < totalCount && offset < 20000) {
        const { data, error } = await supabase.rpc("admin_list_orders", {
          _search: debounced || null,
          _status: status === "all" ? null : status,
          _payment_status: payStatus === "all" ? null : payStatus,
          _from: from ? new Date(from).toISOString() : null,
          _to: to ? new Date(to + "T23:59:59").toISOString() : null,
          _limit: chunk,
          _offset: offset,
        });
        if (error) throw error;
        const list = (data as unknown as OrderRow[]) || [];
        all.push(...list);
        totalCount = list[0]?.total_count ?? all.length;
        if (list.length === 0) break;
        offset += chunk;
      }
      const headers = CSV_COLUMNS.map((c) => c.label);
      const csv = [
        headers.join(","),
        ...all.map((r) => CSV_COLUMNS.map(({ key }) => {
          const v = (r as any)[key];
          if (v === null || v === undefined) return "";
          const str = String(v).replace(/"/g, '""');
          return /[",\n]/.test(str) ? `"${str}"` : str;
        }).join(",")),
      ].join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast({ title: "تعذر تصدير الطلبات", description: friendlyOrderError(e), variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

    <AdminLayout
      title="إدارة الطلبات"
      description="متابعة الطلبات، تجاوز الحالات، التجميد وإعادة الفتح."
      actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className="h-4 w-4 ms-1" /> تحديث
          </Button>
          <Button onClick={() => void exportCSV()} disabled={exporting || loading || !rows.length}>
            {exporting ? <Loader2 className="h-4 w-4 ms-1 animate-spin" /> : <Download className="h-4 w-4 ms-1" />} تصدير CSV
          </Button>
        </div>
      }
    >
      <Tabs defaultValue="orders" dir="rtl">
        <TabsList>
          <TabsTrigger value="orders">الطلبات</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-4">
          <Card>
            <CardContent className="grid gap-3 pt-6 md:grid-cols-6">
              <div className="relative md:col-span-2">
                <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
                  {ORDER_STATUSES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
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
              <CardTitle className="text-base">النتائج ({total.toLocaleString("ar-SY")})</CardTitle>
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
                          <td className="px-3 py-2">
                            <div className="flex flex-col">
                              <span className="font-mono text-xs font-semibold">{orderLabel(r)}</span>
                              {r.invoice_number && <span className="text-[10px] text-muted-foreground">فاتورة: {r.invoice_number}</span>}
                              {r.is_frozen && <Badge variant="destructive" className="mt-1 w-fit gap-1 text-[10px]"><Snowflake className="h-3 w-3" /> مجمّد</Badge>}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-col">
                              <span>{r.customer_name || "—"}</span>
                              <span className="text-xs text-muted-foreground">{r.customer_email || r.phone || ""}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2"><OrderStatusBadge status={r.status} /></td>
                          <td className="px-3 py-2">
                            <div className="flex flex-col gap-1">
                              <Badge variant="outline">{PAY_LABEL[r.payment_status] || r.payment_status}</Badge>
                              {r.payment_method && <span className="text-[10px] text-muted-foreground">{r.payment_method}</span>}
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2">{money(r.total_amount)}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                            {new Date(r.created_at).toLocaleDateString("ar-SY")}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" aria-label="تفاصيل" onClick={() => void openOrder(r.id, r.customer_id)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button asChild size="sm" variant="ghost" aria-label="تتبع">
                                <Link to={`/orders/track/${r.id}`}><ExternalLink className="h-4 w-4" /></Link>
                              </Button>
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
        </TabsContent>


      <Dialog open={!!openId} onOpenChange={(o) => { if (!o) { setOpenId(null); setDetail(null); setHistory([]); } }}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              تفاصيل الطلب {order?.order_number || openId?.slice(0, 8)}
              {order?.invoice_number && <span className="text-xs text-muted-foreground">فاتورة: {order.invoice_number}</span>}
              {order && <OrderStatusBadge status={order.status} />}
              {isFrozen && (
                <Badge variant="destructive" className="gap-1">
                  <Snowflake className="h-3 w-3" /> مجمّد
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>عرض ومعالجة الطلب من قِبَل الإدارة مع تسجيل كامل للعمليات.</DialogDescription>
          </DialogHeader>

          {detailLoading || !detail || !order ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 text-sm md:grid-cols-2">
                <div className="rounded border p-3">
                  <p className="mb-1 font-semibold">العميل</p>
                  <p>{detail.customer?.full_name || "—"}</p>
                  <p className="text-xs text-muted-foreground">{detail.customer?.email}</p>
                  <p className="text-xs text-muted-foreground">{detail.customer?.phone || order.phone}</p>
                  {detail.customer?.account_status && detail.customer.account_status !== "active" && (
                    <Badge variant="destructive" className="mt-1">{detail.customer.account_status}</Badge>
                  )}
                </div>
                <div className="rounded border p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <p className="font-semibold">الشحن</p>
                    <Button size="sm" variant="outline" onClick={() => setShippingOpen(true)}>
                      <Truck className="h-4 w-4 ms-1" /> تعديل
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">{order.shipping_address || "—"}</p>
                  <p className="mt-1 text-xs">شركة الشحن: {order.courier_name || "—"}</p>
                  <p className="text-xs">رقم التتبع: {order.tracking_number || "—"}</p>
                  <p className="text-xs">السائق: {order.driver_name || "—"} {order.driver_phone ? `(${order.driver_phone})` : ""}</p>
                  <p className="text-xs">
                    موعد التسليم المتوقع:{" "}
                    {order.estimated_delivery ? new Date(order.estimated_delivery).toLocaleDateString("ar-SY") : "—"}
                  </p>
                  {order.delivery_notes && <p className="mt-1 text-xs text-muted-foreground">{order.delivery_notes}</p>}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold">المنتجات ({detail.items.length}) — {money(order.total_amount)}</p>
                <div className="space-y-2">
                  {detail.items.map((it) => (
                    <div key={it.id} className="flex items-center gap-3 rounded border p-2">
                      {it.product_image && (
                        <img src={it.product_image} alt="" loading="lazy" decoding="async" className="h-12 w-12 rounded object-cover" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{it.product_name || "منتج"}</p>
                        <p className="text-xs text-muted-foreground">البائع: {it.vendor_name || "—"}</p>
                      </div>
                      <div className="whitespace-nowrap text-xs">{it.quantity} × {money(it.price)}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded border p-3">
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <ScrollText className="h-4 w-4" /> سجل الطلب الكامل (المنفّذ، الجهاز، IP)
                </p>
                <div className="max-h-72 overflow-y-auto">
                  <OrderTimelineLog orderId={order.id} />
                </div>
              </div>

              <div className="rounded border p-3 text-sm">
                <p className="mb-2 font-semibold">آخر طلبات هذا العميل</p>
                <ul className="max-h-40 space-y-1 overflow-y-auto">
                  {history.length === 0 && <li className="text-xs text-muted-foreground">—</li>}
                  {history.map((h) => (
                    <li key={`${h.role}-${h.id}`} className="flex justify-between gap-2 text-xs">
                      <Link to={`/orders/track/${h.id}`} className="underline">{h.id.slice(0, 8)}</Link>
                      <span className="text-muted-foreground">{h.role}</span>
                      <span>{ORDER_STATUS_LABELS[normalizeStatus(h.status)]}</span>
                      <span>{money(h.total_amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded border p-3">
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <MessageSquare className="h-4 w-4" /> ملاحظات الطلب
                </p>
                {notesLoading ? (
                  <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" /></div>
                ) : notes.length === 0 ? (
                  <p className="text-xs text-muted-foreground">لا توجد ملاحظات بعد.</p>
                ) : (
                  <ul className="mb-2 max-h-48 space-y-2 overflow-y-auto">
                    {notes.map((n) => (
                      <li key={n.id} className="rounded border p-2 text-xs">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="font-semibold">{n.author_name || n.author_role || "—"}</span>
                          <div className="flex items-center gap-1">
                            {n.is_internal && <Badge variant="secondary" className="gap-1 text-[10px]"><Lock className="h-3 w-3" /> داخلية</Badge>}
                            <span className="text-muted-foreground">{new Date(n.created_at).toLocaleString("ar-SY")}</span>
                          </div>
                        </div>
                        <p className="whitespace-pre-wrap">{n.note}</p>
                      </li>
                    ))}
                  </ul>
                )}
                <Textarea rows={2} value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="أضف ملاحظة..." />
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Switch id="note-internal" checked={noteInternal} onCheckedChange={setNoteInternal} />
                    <Label htmlFor="note-internal" className="text-xs">ملاحظة داخلية (غير مرئية للعميل)</Label>
                  </div>
                  <Button
                    size="sm"
                    disabled={savingNote || !newNote.trim()}
                    onClick={async () => {
                      if (!order) return;
                      setSavingNote(true);
                      const { error } = await supabase.rpc("add_order_note", {
                        _order_id: order.id, _note: newNote.trim(), _is_internal: noteInternal,
                      });
                      setSavingNote(false);
                      if (error) {
                        toast({ title: "تعذر إضافة الملاحظة", description: friendlyOrderError(error), variant: "destructive" });
                        return;
                      }
                      setNewNote("");
                      void loadNotes(order.id);
                    }}
                  >
                    {savingNote ? <Loader2 className="h-4 w-4 animate-spin" /> : "إضافة ملاحظة"}
                  </Button>
                </div>
              </div>

              <div className="rounded border p-3">
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <Truck className="h-4 w-4" /> تحديث بيانات الشحن السريع
                </p>
                <div className="grid gap-2 md:grid-cols-2">
                  <Input placeholder="شركة الشحن" value={shipCompany} onChange={(e) => setShipCompany(e.target.value)} />
                  <Input placeholder="رقم التتبع" value={shipTracking} onChange={(e) => setShipTracking(e.target.value)} />
                  <Input type="date" value={shipEta} onChange={(e) => setShipEta(e.target.value)} aria-label="موعد التسليم المتوقع" />
                  <Textarea rows={1} placeholder="ملاحظات الشحن" value={shipNotes} onChange={(e) => setShipNotes(e.target.value)} />
                </div>
                <Button
                  size="sm"
                  className="mt-2"
                  variant="outline"
                  disabled={savingShip}
                  onClick={async () => {
                    if (!order) return;
                    setSavingShip(true);
                    const { error } = await supabase.rpc("update_order_shipping", {
                      _order_id: order.id,
                      _shipping_company: shipCompany.trim() || null,
                      _tracking_number: shipTracking.trim() || null,
                      _shipping_notes: shipNotes.trim() || null,
                      _estimated_delivery: shipEta ? new Date(`${shipEta}T12:00:00`).toISOString() : null,
                    });
                    setSavingShip(false);
                    if (error) {
                      toast({ title: "تعذر تحديث الشحن", description: friendlyOrderError(error), variant: "destructive" });
                      return;
                    }
                    toast({ title: "تم تحديث بيانات الشحن" });
                    await refreshDetail();
                  }}
                >
                  {savingShip ? <Loader2 className="h-4 w-4 animate-spin" /> : "حفظ بيانات الشحن"}
                </Button>
              </div>

              {/* Admin actions */}
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2 rounded border p-3">
                  <p className="flex items-center gap-1 text-sm font-semibold">
                    <ShieldAlert className="h-4 w-4" /> تغيير / تجاوز الحالة
                  </p>
                  <Select value={nextStatus} onValueChange={(v) => setNextStatus(v as OrderStatus)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ORDER_STATUSES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Textarea rows={2} value={statusNote} onChange={(e) => setStatusNote(e.target.value)} placeholder="ملاحظة (اختياري)" />
                  <div className="flex items-center justify-between gap-2 rounded bg-muted/40 p-2">
                    <Label htmlFor="override" className="text-xs">
                      تجاوز قواعد الانتقال (يُسجَّل كتجاوز إداري)
                    </Label>
                    <Switch id="override" checked={override} onCheckedChange={setOverride} />
                  </div>
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => void run(
                      () => changeOrderStatus(order.id, nextStatus, statusNote || null, override),
                      "تم تحديث حالة الطلب",
                    )}
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "حفظ الحالة"}
                  </Button>
                </div>

                <div className="space-y-3">
                  <div className="space-y-2 rounded border p-3">
                    <p className="flex items-center gap-1 text-sm font-semibold">
                      {isFrozen ? <Unlock className="h-4 w-4" /> : <Snowflake className="h-4 w-4" />}
                      {isFrozen ? "إلغاء تجميد الطلب" : "تجميد الطلب"}
                    </p>
                    {isFrozen && order.frozen_reason && (
                      <p className="text-xs text-muted-foreground">سبب التجميد: {order.frozen_reason}</p>
                    )}
                    <Textarea rows={2} value={freezeReason} onChange={(e) => setFreezeReason(e.target.value)}
                      placeholder={isFrozen ? "سبب إلغاء التجميد" : "سبب التجميد"} />
                    <Button
                      size="sm"
                      variant={isFrozen ? "outline" : "destructive"}
                      disabled={busy}
                      onClick={() => void run(
                        () => setOrderFreeze(order.id, !isFrozen, freezeReason || null),
                        isFrozen ? "تم إلغاء التجميد" : "تم تجميد الطلب",
                      )}
                    >
                      {isFrozen ? "إلغاء التجميد" : "تجميد"}
                    </Button>
                  </div>

                  <div className="space-y-2 rounded border p-3">
                    <p className="flex items-center gap-1 text-sm font-semibold">
                      <RotateCcw className="h-4 w-4" /> إعادة فتح طلب مغلق
                    </p>
                    <Select value={reopenStatus} onValueChange={(v) => setReopenStatus(v as OrderStatus)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {REOPEN_TARGETS.map((s) => (
                          <SelectItem key={s} value={s}>{ORDER_STATUS_LABELS[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Textarea rows={2} value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} placeholder="سبب إعادة الفتح (إلزامي)" />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy || !isClosed}
                      onClick={() => void run(
                        () => reopenOrder(order.id, reopenStatus, reopenReason.trim()),
                        "تم إعادة فتح الطلب",
                      )}
                    >
                      إعادة الفتح
                    </Button>
                    {!isClosed && <p className="text-xs text-muted-foreground">الطلب غير مغلق حاليًا.</p>}
                  </div>
                </div>
              </div>

          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpenId(null); setDetail(null); }}>إغلاق</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ShippingInfoDialog
        orderId={openId}
        open={shippingOpen}
        onOpenChange={setShippingOpen}
        initial={{
          courierName: order?.courier_name,
          trackingNumber: order?.tracking_number,
          driverName: order?.driver_name,
          driverPhone: order?.driver_phone,
          deliveryNotes: order?.delivery_notes,
          estimatedDelivery: order?.estimated_delivery,
        }}
        onSaved={() => void refreshDetail()}
      />
    </AdminLayout>
  );
};

export default AdminOrders;
