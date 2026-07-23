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
import { Loader2, Search, Flag, Trash2, Eye, ShieldOff, ShieldCheck, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

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
      _status: statusFilter === "all" ? null : statusFilter,
      _type: typeFilter === "all" ? null : typeFilter,
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
      ({ error } = await supabase.rpc("admin_moderate_product", { _product_id: selected.target_id, _action: "hidden", _reason: note || selected.reason }));
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
      ({ error } = await supabase.rpc("admin_moderate_product", { _product_id: selected.target_id, _action: "restored", _reason: "restored from report" }));
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
          <h1 className="text-2xl font-bold">لوحة البلاغات والإشراف</h1>
        </div>

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