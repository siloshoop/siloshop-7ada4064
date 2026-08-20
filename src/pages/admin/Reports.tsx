import { useCallback, useEffect, useState } from "react";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Search, Flag, Trash2, Eye, ShieldOff, ShieldCheck, ExternalLink, BarChart3 } from "lucide-react";
import { Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";

type ReportStatus = "pending" | "under_review" | "resolved" | "rejected";
type ReportType = "product" | "seller" | "buyer" | "message" | "review";

interface ReportRow {
  id: string;
  reporter_id: string;
  reporter_name: string | null;
  reporter_email: string | null;
  report_type: ReportType;
  target_id: string;
  reason: string;
  description: string | null;
  status: ReportStatus;
  resolution_note: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  total_count: number;
}

const STATUS_LABEL: Record<ReportStatus, string> = {
  pending: "قيد الانتظار",
  under_review: "قيد المراجعة",
  resolved: "تم الحل",
  rejected: "مرفوض",
};

const STATUS_VARIANT: Record<ReportStatus, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  under_review: "default",
  resolved: "outline",
  rejected: "destructive",
};

const TYPE_LABEL: Record<ReportType, string> = {
  product: "منتج",
  seller: "بائع",
  buyer: "مشتري",
  message: "رسالة",
  review: "تقييم",
};

const PAGE_SIZE = 25;


type OrdersReportRange = "today" | "7d" | "30d" | "month" | "custom";

interface OrderReportTotals {
  orders_count: number; revenue: number; avg_order_value: number;
  cancelled_count: number; completed_count: number; returned_count: number;
}
interface OrderReportPayload {
  totals: OrderReportTotals;
  daily: Array<{ day: string; orders: number; revenue: number }>;
  monthly: Array<{ month: string; orders: number; revenue: number }>;
  top_products: Array<{ product_id: string; name: string; qty: number; revenue: number }>;
  top_sellers: Array<{ vendor_id: string; name: string; orders: number; revenue: number }>;
}

const money = (n: unknown) => `${Number(n ?? 0).toLocaleString("ar-SY")} ل.س`;

const rangeToDates = (range: OrdersReportRange, customFrom: string, customTo: string) => {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  switch (range) {
    case "today":
      return { from: startOfDay(now).toISOString(), to: now.toISOString() };
    case "7d": {
      const f = new Date(now); f.setDate(f.getDate() - 6);
      return { from: startOfDay(f).toISOString(), to: now.toISOString() };
    }
    case "30d": {
      const f = new Date(now); f.setDate(f.getDate() - 29);
      return { from: startOfDay(f).toISOString(), to: now.toISOString() };
    }
    case "month":
      return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), to: now.toISOString() };
    case "custom":
      return {
        from: customFrom ? new Date(customFrom).toISOString() : null,
        to: customTo ? new Date(customTo + "T23:59:59").toISOString() : null,
      };
  }
};

const RangeStatCard = ({ title, value }: { title: string; value: string | number }) => (
  <Card>
    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle></CardHeader>
    <CardContent><div className="text-xl font-bold">{value}</div></CardContent>
  </Card>
);

const OrdersReportSection = () => {
  const { toast } = useToast();
  const [range, setRange] = useState<OrdersReportRange>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [data, setData] = useState<OrderReportPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { from, to } = rangeToDates(range, customFrom, customTo);
      const { data: res, error } = await supabase.rpc("order_reports", { _from: from, _to: to });
      if (cancelled) return;
      if (error) {
        toast({ title: "تعذر تحميل تقرير الطلبات", description: error.message, variant: "destructive" });
        setData(null);
      } else {
        setData((res as unknown as OrderReportPayload) || null);
      }
      setLoading(false);
    };
    if (range !== "custom" || (customFrom && customTo)) void load();
    return () => { cancelled = true; };
  }, [range, customFrom, customTo, toast]);

  const totals = data?.totals;
  const daily = (data?.daily || []).map((d) => ({
    day: new Date(d.day).toLocaleDateString("ar-SY", { month: "short", day: "numeric" }),
    orders: Number(d.orders), revenue: Number(d.revenue),
  }));
  const monthly = (data?.monthly || []).map((m) => ({
    month: m.month, orders: Number(m.orders), revenue: Number(m.revenue),
  }));
  const topProducts = data?.top_products || [];
  const topSellers = data?.top_sellers || [];

  return (
    <div className="space-y-4">
      <Tabs value={range} onValueChange={(v) => setRange(v as OrdersReportRange)}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="today">اليوم</TabsTrigger>
          <TabsTrigger value="7d">7 أيام</TabsTrigger>
          <TabsTrigger value="30d">30 يوم</TabsTrigger>
          <TabsTrigger value="month">هذا الشهر</TabsTrigger>
          <TabsTrigger value="custom">نطاق مخصص</TabsTrigger>
        </TabsList>
      </Tabs>

      {range === "custom" && (
        <div className="flex flex-wrap gap-2">
          <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} aria-label="من تاريخ" />
          <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} aria-label="إلى تاريخ" />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : !data ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">لا توجد بيانات لهذه الفترة.</CardContent></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <RangeStatCard title="عدد الطلبات" value={totals?.orders_count ?? 0} />
            <RangeStatCard title="الإيرادات" value={money(totals?.revenue)} />
            <RangeStatCard title="متوسط قيمة الطلب" value={money(totals?.avg_order_value)} />
            <RangeStatCard title="الملغاة" value={totals?.cancelled_count ?? 0} />
            <RangeStatCard title="المكتملة" value={totals?.completed_count ?? 0} />
            <RangeStatCard title="المرتجعة" value={totals?.returned_count ?? 0} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">الطلبات والإيرادات اليومية</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[260px]">
                  {daily.length === 0 ? (
                    <p className="flex h-full items-center justify-center text-sm text-muted-foreground">لا توجد بيانات يومية.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={daily}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="orders" name="الطلبات" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="revenue" name="الإيرادات" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">الطلبات الشهرية</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[260px]">
                  {monthly.length === 0 ? (
                    <p className="flex h-full items-center justify-center text-sm text-muted-foreground">لا توجد بيانات شهرية.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthly}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="orders" name="الطلبات" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">أفضل المنتجات</CardTitle></CardHeader>
              <CardContent className="p-0">
                {topProducts.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">لا توجد بيانات.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40 text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 text-right">المنتج</th>
                          <th className="px-3 py-2 text-right">الكمية</th>
                          <th className="px-3 py-2 text-right">الإيرادات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topProducts.map((p) => (
                          <tr key={p.product_id} className="border-t">
                            <td className="px-3 py-2">{p.name || "—"}</td>
                            <td className="px-3 py-2">{p.qty}</td>
                            <td className="whitespace-nowrap px-3 py-2">{money(p.revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">أفضل البائعين</CardTitle></CardHeader>
              <CardContent className="p-0">
                {topSellers.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">لا توجد بيانات.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40 text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 text-right">البائع</th>
                          <th className="px-3 py-2 text-right">الطلبات</th>
                          <th className="px-3 py-2 text-right">الإيرادات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topSellers.map((v) => (
                          <tr key={v.vendor_id} className="border-t">
                            <td className="px-3 py-2">{v.name || "—"}</td>
                            <td className="px-3 py-2">{v.orders}</td>
                            <td className="whitespace-nowrap px-3 py-2">{money(v.revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

const Reports = () => {
  const { isAdmin, loading: adminLoading } = useAdminCheck();
  const { toast } = useToast();
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [selected, setSelected] = useState<ReportRow | null>(null);
  const [note, setNote] = useState("");
  const [newStatus, setNewStatus] = useState<ReportStatus>("under_review");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_reports", {
      _status: (statusFilter === "all" ? null : statusFilter) as ReportStatus | null,
      _type: (typeFilter === "all" ? null : typeFilter) as ReportType | null,
      _search: debounced || null,
      _limit: PAGE_SIZE,
      _offset: page * PAGE_SIZE,
    });
    if (error) {
      toast({ title: "تعذر تحميل البلاغات", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    const list = (data || []) as ReportRow[];
    setRows(list);
    setTotal(list[0]?.total_count ? Number(list[0].total_count) : 0);
    setLoading(false);
  }, [isAdmin, statusFilter, typeFilter, debounced, page, toast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!isAdmin) return;
    const ch = supabase
      .channel("reports-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "reports" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [isAdmin, load]);

  const openDetail = (r: ReportRow) => {
    setSelected(r);
    setNote(r.resolution_note || "");
    setNewStatus(r.status === "pending" ? "under_review" : r.status);
  };

  const updateStatus = async (status: ReportStatus) => {
    if (!selected) return;
    setBusy(true);
    const { error } = await supabase.rpc("admin_update_report", {
      _report_id: selected.id,
      _status: status,
      _note: note.trim() || null,
    });
    setBusy(false);
    if (error) {
      toast({ title: "تعذر تحديث البلاغ", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "تم تحديث البلاغ" });
    setSelected(null);
    load();
  };

  const takeContentAction = async () => {
    if (!selected) return;
    setBusy(true);
    let error: any = null;
    if (selected.report_type === "message") {
      ({ error } = await supabase.rpc("admin_delete_message", { _message_id: selected.target_id }));
    } else if (selected.report_type === "review") {
      ({ error } = await supabase.rpc("admin_hide_review", { _review_id: selected.target_id, _reason: note || selected.reason }));
    } else if (selected.report_type === "product") {
      ({ error } = await supabase.rpc("admin_moderate_product", { _product_id: selected.target_id, _action: "hide", _reason: note || selected.reason }));
    } else if (selected.report_type === "seller") {
      ({ error } = await supabase.rpc("suspend_seller", { _user_id: selected.target_id, _reason: note || selected.reason }));
    } else if (selected.report_type === "buyer") {
      ({ error } = await supabase.rpc("admin_suspend_user", { _user_id: selected.target_id, _reason: note || selected.reason }));
    }
    if (error) {
      setBusy(false);
      toast({ title: "تعذر تنفيذ الإجراء", description: error.message, variant: "destructive" });
      return;
    }
    // Mark report resolved
    await supabase.rpc("admin_update_report", {
      _report_id: selected.id,
      _status: "resolved",
      _note: (note || selected.reason) + " — تم اتخاذ إجراء على المحتوى",
    });
    setBusy(false);
    toast({ title: "تم تنفيذ الإجراء وحل البلاغ" });
    setSelected(null);
    load();
  };

  const restoreContent = async () => {
    if (!selected) return;
    setBusy(true);
    let error: any = null;
    if (selected.report_type === "review") {
      ({ error } = await supabase.rpc("admin_unhide_review", { _review_id: selected.target_id }));
    } else if (selected.report_type === "product") {
      ({ error } = await supabase.rpc("admin_moderate_product", { _product_id: selected.target_id, _action: "restore", _reason: "restored from report" }));
    } else if (selected.report_type === "seller") {
      ({ error } = await supabase.rpc("reactivate_seller", { _user_id: selected.target_id }));
    } else if (selected.report_type === "buyer") {
      ({ error } = await supabase.rpc("admin_activate_user", { _user_id: selected.target_id }));
    }
    setBusy(false);
    if (error) {
      toast({ title: "تعذر الاستعادة", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "تم استعادة المحتوى" });
  };

  const targetLink = (r: ReportRow) => {
    switch (r.report_type) {
      case "product": return `/product/${r.target_id}`;
      case "seller": return `/vendor/${r.target_id}/ratings`;
      case "buyer": return `/dashboard/users`;
      case "review":
      case "message": return null;
    }
  };

  if (adminLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="min-h-screen flex flex-col" dir="rtl">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-6 max-w-6xl">
        <div className="flex items-center gap-2 mb-6">
          <Flag className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">لوحة البلاغات والتقارير</h1>
        </div>

        <div className="mb-8">
          <OrdersReportSection />
        </div>

        <div className="mb-8">
          <ReturnsReportSection />
        </div>

        <h2 className="text-lg font-bold mb-3">البلاغات والإشراف</h2>



        <Card className="mb-4">
          <CardContent className="pt-6 grid gap-3 md:grid-cols-4">
            <div className="relative md:col-span-2">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                placeholder="ابحث بالسبب أو الوصف أو معرف البلاغ/الهدف"
                className="pr-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
              <SelectTrigger><SelectValue placeholder="الحالة" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحالات</SelectItem>
                <SelectItem value="pending">قيد الانتظار</SelectItem>
                <SelectItem value="under_review">قيد المراجعة</SelectItem>
                <SelectItem value="resolved">تم الحل</SelectItem>
                <SelectItem value="rejected">مرفوض</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(0); }}>
              <SelectTrigger><SelectValue placeholder="النوع" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأنواع</SelectItem>
                <SelectItem value="product">منتج</SelectItem>
                <SelectItem value="seller">بائع</SelectItem>
                <SelectItem value="buyer">مشتري</SelectItem>
                <SelectItem value="message">رسالة</SelectItem>
                <SelectItem value="review">تقييم</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : rows.length === 0 ? (
          <Card><CardContent className="py-16 text-center text-muted-foreground">لا توجد بلاغات مطابقة.</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => (
              <Card key={r.id} className="hover:border-primary/40 transition-colors">
                <CardContent className="pt-5 flex flex-col md:flex-row md:items-center gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                      <Badge variant="outline">{TYPE_LABEL[r.report_type]}</Badge>
                      <span className="text-xs text-muted-foreground">#{r.id.slice(0, 8)}</span>
                      <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("ar-EG")}</span>
                    </div>
                    <p className="font-medium truncate">{r.reason}</p>
                    {r.description && <p className="text-sm text-muted-foreground line-clamp-2">{r.description}</p>}
                    <p className="text-xs text-muted-foreground">
                      المُبلِّغ: {r.reporter_name || r.reporter_email || r.reporter_id.slice(0, 8)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {targetLink(r) && (
                      <Button asChild variant="outline" size="sm">
                        <Link to={targetLink(r)!} target="_blank">
                          <ExternalLink className="h-4 w-4 ml-1" /> الهدف
                        </Link>
                      </Button>
                    )}
                    <Button size="sm" onClick={() => openDetail(r)}>
                      <Eye className="h-4 w-4 ml-1" /> مراجعة
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between mt-6">
            <p className="text-sm text-muted-foreground">
              الصفحة {page + 1} من {totalPages} — إجمالي {total}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>السابق</Button>
              <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>التالي</Button>
            </div>
          </div>
        )}
      </main>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent dir="rtl" className="max-w-2xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Flag className="h-5 w-5" /> تفاصيل البلاغ
                </DialogTitle>
                <DialogDescription>
                  #{selected.id.slice(0, 8)} — {TYPE_LABEL[selected.report_type]} — {new Date(selected.created_at).toLocaleString("ar-EG")}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">السبب</p>
                  <p className="font-medium">{selected.reason}</p>
                </div>
                {selected.description && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">تفاصيل المُبلِّغ</p>
                    <p className="whitespace-pre-wrap">{selected.description}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">المُبلِّغ</p>
                    <p>{selected.reporter_name || selected.reporter_email || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">الهدف</p>
                    <p className="font-mono text-xs break-all">{selected.target_id}</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1">ملاحظة إدارية / قرار</p>
                  <Textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 2000))} rows={3} placeholder="اكتب ملاحظتك أو سبب القرار" />
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1">الحالة الجديدة</p>
                  <Select value={newStatus} onValueChange={(v) => setNewStatus(v as ReportStatus)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">قيد الانتظار</SelectItem>
                      <SelectItem value="under_review">قيد المراجعة</SelectItem>
                      <SelectItem value="resolved">تم الحل</SelectItem>
                      <SelectItem value="rejected">مرفوض</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
                <div className="flex flex-wrap gap-2">
                  <Button variant="destructive" size="sm" onClick={takeContentAction} disabled={busy}>
                    <ShieldOff className="h-4 w-4 ml-1" />
                    {selected.report_type === "message" ? "حذف الرسالة" :
                      selected.report_type === "review" ? "إخفاء التقييم" :
                      selected.report_type === "product" ? "إخفاء المنتج" :
                      selected.report_type === "seller" ? "إيقاف البائع" :
                      "إيقاف الحساب"}
                  </Button>
                  {selected.report_type !== "message" && (
                    <Button variant="outline" size="sm" onClick={restoreContent} disabled={busy}>
                      <ShieldCheck className="h-4 w-4 ml-1" /> استعادة
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setSelected(null)} disabled={busy}>إغلاق</Button>
                  <Button onClick={() => updateStatus(newStatus)} disabled={busy}>
                    {busy && <Loader2 className="h-4 w-4 animate-spin ml-1" />}
                    حفظ الحالة
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

export default Reports;