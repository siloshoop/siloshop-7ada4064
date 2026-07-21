import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Search, CheckCircle2, XCircle, PauseCircle, PlayCircle, Trash2, FileText, Eye } from "lucide-react";

type Status = "pending" | "approved" | "rejected" | "suspended";

interface AppRow {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  store_name: string | null;
  contact_phone: string | null;
  governorate: string | null;
  status: Status;
  rejection_reason: string | null;
  identity_document_url: string | null;
  business_document_url: string | null;
  store_description: string | null;
  address: string | null;
  submitted_at: string | null;
  created_at: string | null;
  products_count: number;
  orders_count: number;
}

const statusStyles: Record<Status, string> = {
  pending: "bg-amber-500",
  approved: "bg-emerald-500",
  rejected: "bg-red-500",
  suspended: "bg-slate-500",
};
const statusLabel: Record<Status, string> = {
  pending: "قيد المراجعة",
  approved: "مقبول",
  rejected: "مرفوض",
  suspended: "موقوف",
};

const SellerManagement = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<AppRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Status | "all">("pending");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<AppRow | null>(null);
  const [rejecting, setRejecting] = useState<AppRow | null>(null);
  const [suspending, setSuspending] = useState<AppRow | null>(null);
  const [deleting, setDeleting] = useState<AppRow | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [docUrls, setDocUrls] = useState<{ id?: string; biz?: string }>({});

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_seller_applications");
    if (error) toast({ title: "خطأ في التحميل", description: error.message, variant: "destructive" });
    setRows((data as AppRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let list = rows;
    if (tab !== "all") list = list.filter(r => r.status === tab);
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      list = list.filter(r =>
        (r.store_name ?? "").toLowerCase().includes(s) ||
        (r.full_name ?? "").toLowerCase().includes(s) ||
        (r.email ?? "").toLowerCase().includes(s) ||
        (r.contact_phone ?? "").toLowerCase().includes(s)
      );
    }
    return list;
  }, [rows, tab, q]);

  const counts = useMemo(() => ({
    all: rows.length,
    pending: rows.filter(r => r.status === "pending").length,
    approved: rows.filter(r => r.status === "approved").length,
    rejected: rows.filter(r => r.status === "rejected").length,
    suspended: rows.filter(r => r.status === "suspended").length,
  }), [rows]);

  const openDetails = async (row: AppRow) => {
    setSelected(row);
    setDocUrls({});
    const paths = [row.identity_document_url, row.business_document_url].filter(Boolean) as string[];
    if (paths.length) {
      const { data } = await supabase.storage.from("seller-documents").createSignedUrls(paths, 60 * 15);
      const map: { id?: string; biz?: string } = {};
      data?.forEach((s, i) => {
        if (paths[i] === row.identity_document_url) map.id = s.signedUrl ?? undefined;
        if (paths[i] === row.business_document_url) map.biz = s.signedUrl ?? undefined;
      });
      setDocUrls(map);
    }
  };

  const runAction = async (fn: () => any, successMsg: string) => {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: successMsg });
    await load();
    return true;
  };

  const approve = (r: AppRow) =>
    runAction(() => supabase.rpc("approve_seller_application", { _app_id: r.id }), "تمت الموافقة");

  const reject = async () => {
    if (!rejecting || !reason.trim()) return;
    const ok = await runAction(
      () => supabase.rpc("reject_seller_application", { _app_id: rejecting.id, _reason: reason }),
      "تم رفض الطلب"
    );
    if (ok) { setRejecting(null); setReason(""); setSelected(null); }
  };

  const suspend = async () => {
    if (!suspending) return;
    const ok = await runAction(
      () => supabase.rpc("suspend_seller", { _user_id: suspending.user_id, _reason: reason || null }),
      "تم إيقاف الحساب"
    );
    if (ok) { setSuspending(null); setReason(""); setSelected(null); }
  };

  const reactivate = (r: AppRow) =>
    runAction(() => supabase.rpc("reactivate_seller", { _user_id: r.user_id }), "تمت إعادة التفعيل");

  const remove = async () => {
    if (!deleting) return;
    const ok = await runAction(
      () => supabase.rpc("delete_seller_account", { _user_id: deleting.user_id }),
      "تم حذف حساب البائع"
    );
    if (ok) { setDeleting(null); setSelected(null); }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">إدارة البائعين</h1>
          <p className="text-muted-foreground">مراجعة طلبات البائعين وإدارة حساباتهم.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {(["all","pending","approved","rejected","suspended"] as const).map(k => (
            <Card key={k} className={tab === k ? "ring-2 ring-primary" : ""} role="button" onClick={() => setTab(k)}>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">{k === "all" ? "الكل" : statusLabel[k as Status]}</p>
                <p className="text-2xl font-bold">{counts[k]}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle>الطلبات</CardTitle>
            <div className="relative w-full max-w-xs">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم أو الإيميل..." className="pr-9" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : filtered.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">لا توجد طلبات</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>المتجر</TableHead>
                      <TableHead>البائع</TableHead>
                      <TableHead>الهاتف</TableHead>
                      <TableHead>المحافظة</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>المنتجات</TableHead>
                      <TableHead>الطلبات</TableHead>
                      <TableHead>إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.store_name || "—"}</TableCell>
                        <TableCell>
                          <div className="text-sm">{r.full_name || "—"}</div>
                          <div className="text-xs text-muted-foreground">{r.email}</div>
                        </TableCell>
                        <TableCell className="text-sm">{r.contact_phone || "—"}</TableCell>
                        <TableCell className="text-sm">{r.governorate || "—"}</TableCell>
                        <TableCell><Badge className={statusStyles[r.status]}>{statusLabel[r.status]}</Badge></TableCell>
                        <TableCell>{r.products_count}</TableCell>
                        <TableCell>{r.orders_count}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" onClick={() => openDetails(r)}>
                            <Eye className="h-4 w-4 ml-1" /> مراجعة
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
      </main>
      <Footer />

      {/* Details dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>ملف البائع</DialogTitle>
            <DialogDescription>مراجعة كاملة قبل اتخاذ القرار.</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold">{selected.store_name || "—"}</h3>
                  <p className="text-sm text-muted-foreground">{selected.full_name} · {selected.email}</p>
                </div>
                <Badge className={statusStyles[selected.status]}>{statusLabel[selected.status]}</Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <Field label="الهاتف" value={selected.contact_phone} />
                <Field label="المحافظة" value={selected.governorate} />
                <Field label="العنوان" value={selected.address} />
                <Field label="تاريخ التسجيل" value={selected.created_at ? new Date(selected.created_at).toLocaleDateString("ar") : null} />
                <Field label="عدد المنتجات" value={String(selected.products_count)} />
                <Field label="عدد الطلبات" value={String(selected.orders_count)} />
              </div>

              {selected.store_description && (
                <div>
                  <p className="text-sm font-semibold mb-1">وصف المتجر</p>
                  <p className="text-sm text-muted-foreground">{selected.store_description}</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <DocLink label="وثيقة الهوية" url={docUrls.id} present={!!selected.identity_document_url} />
                <DocLink label="الوثيقة التجارية" url={docUrls.biz} present={!!selected.business_document_url} />
              </div>

              {selected.rejection_reason && (
                <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 p-3 text-sm">
                  <p className="font-semibold text-red-700 dark:text-red-300">سبب الرفض/الإيقاف الحالي</p>
                  <p className="text-red-700 dark:text-red-200">{selected.rejection_reason}</p>
                </div>
              )}

              <DialogFooter className="flex-wrap gap-2">
                {(selected.status === "pending" || selected.status === "rejected") && (
                  <>
                    <Button onClick={() => approve(selected)} disabled={busy} className="bg-emerald-600 hover:bg-emerald-700">
                      <CheckCircle2 className="h-4 w-4 ml-1" /> موافقة
                    </Button>
                    <Button variant="destructive" onClick={() => { setRejecting(selected); setReason(""); }}>
                      <XCircle className="h-4 w-4 ml-1" /> رفض
                    </Button>
                  </>
                )}
                {selected.status === "approved" && (
                  <Button variant="outline" onClick={() => { setSuspending(selected); setReason(""); }}>
                    <PauseCircle className="h-4 w-4 ml-1" /> إيقاف
                  </Button>
                )}
                {selected.status === "suspended" && (
                  <Button onClick={() => reactivate(selected)} disabled={busy} className="bg-emerald-600 hover:bg-emerald-700">
                    <PlayCircle className="h-4 w-4 ml-1" /> إعادة تفعيل
                  </Button>
                )}
                <Button variant="destructive" onClick={() => setDeleting(selected)}>
                  <Trash2 className="h-4 w-4 ml-1" /> حذف
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject */}
      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>رفض طلب البائع</DialogTitle>
            <DialogDescription>يجب توضيح سبب الرفض ليطّلع عليه البائع.</DialogDescription>
          </DialogHeader>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="سبب الرفض..." rows={4} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>إلغاء</Button>
            <Button variant="destructive" onClick={reject} disabled={busy || !reason.trim()}>تأكيد الرفض</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspend */}
      <Dialog open={!!suspending} onOpenChange={(o) => !o && setSuspending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إيقاف حساب البائع</DialogTitle>
            <DialogDescription>يمكن للبائع رؤية سبب الإيقاف.</DialogDescription>
          </DialogHeader>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="سبب الإيقاف (اختياري)..." rows={4} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspending(null)}>إلغاء</Button>
            <Button variant="destructive" onClick={suspend} disabled={busy}>تأكيد الإيقاف</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف حساب البائع؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف طلب البائع وإزالة صلاحيات البيع من الحساب. لا يمكن التراجع.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-destructive text-destructive-foreground">حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const Field = ({ label, value }: { label: string; value: string | null | undefined }) => (
  <div>
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="font-medium">{value || "—"}</p>
  </div>
);

const DocLink = ({ label, url, present }: { label: string; url?: string; present: boolean }) => (
  <div className="rounded-lg border p-3 flex items-center justify-between">
    <div className="flex items-center gap-2">
      <FileText className="h-5 w-5 text-primary" />
      <span className="text-sm font-medium">{label}</span>
    </div>
    {present && url ? (
      <a href={url} target="_blank" rel="noreferrer" className="text-sm text-primary underline">فتح</a>
    ) : (
      <span className="text-xs text-muted-foreground">غير مرفوع</span>
    )}
  </div>
);

export default SellerManagement;