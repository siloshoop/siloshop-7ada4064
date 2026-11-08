import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, Store, ShieldOff, ShieldCheck } from "lucide-react";

import { loadAdminAccounts, type AdminAccount as StoreRow } from "@/lib/adminAccounts";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";

/** Store logo with the store icon as a fallback when the picture is missing or fails to load. */
const StoreLogo = ({ url, name }: { url?: string | null; name?: string | null }) => {
  const [failed, setFailed] = useState(false);
  if (!url || failed) return <Store className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />;
  return (
    <img
      src={url}
      alt={name ?? "شعار المتجر"}
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-10 w-10 shrink-0 rounded-md object-cover"
    />
  );
};

const STATUS_LABEL: Record<string, string> = {
  approved: "نشط",
  suspended: "معلّق",
  pending: "قيد المراجعة",
  rejected: "مرفوض",
};

const AdminStores = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<StoreRow[]>([]);
  const [failure, setFailure] = useState("");
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const { can } = useStaffPermissions();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [suspendTarget, setSuspendTarget] = useState<StoreRow | null>(null);
  const [reason, setReason] = useState("");
  const [working, setWorking] = useState(false);

  const load = async () => {
    setLoading(true);
    setFailure("");
    try { const result = await loadAdminAccounts("stores", search.trim(), offset); setRows(result.rows); setTotal(result.total); }
    catch { setFailure("تعذّر تحميل المتاجر؛ أعد المحاولة."); setRows([]); }
    finally { setLoading(false); }
  };
  useEffect(() => { const timer=setTimeout(() => void load(),250); return () => clearTimeout(timer); }, [search,offset]);
  const filtered = rows;

  const suspend = async () => {
    if (!suspendTarget) return;
    if (reason.trim().length < 5) {
      toast({ title: "اكتب سبب التعليق", variant: "destructive" });
      return;
    }
    setWorking(true);
    const { error } = await supabase.rpc("suspend_seller", {
      _user_id: suspendTarget.id,
      _reason: reason.trim(),
    });
    setWorking(false);
    if (error) {
      toast({ title: "تعذر تعليق المتجر", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "تم تعليق المتجر", description: "أصبحت منتجاته غير معروضة للمشترين." });
    setSuspendTarget(null);
    setReason("");
    void load();
  };

  const reactivate = async (row: StoreRow) => {
    const { error } = await supabase.rpc("reactivate_seller", { _user_id: row.id });
    if (error) {
      toast({ title: "تعذر إعادة التنشيط", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "تم إعادة تنشيط المتجر" });
    void load();
  };

  return (
    <AdminLayout
      title="المتاجر"
      description="إدارة متاجر البائعين المعتمدة. تعليق المتجر يخفي منتجاته دون المساس بالطلبات السابقة."
    >
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-0 basis-full flex-1 sm:basis-auto">
            <Search className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
              placeholder="بحث باسم المتجر أو المدينة..."
              className="pe-9"
            />
          </div>
          <Badge variant="secondary">{total} متجر</Badge>
        </CardContent>
      </Card>

      {failure ? <div role="alert" className="space-y-3 py-8"><p>{failure}</p><Button onClick={() => void load()}>إعادة المحاولة</Button></div> : loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">لا توجد متاجر مطابقة</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <Card key={r.id}>
              <CardContent className="flex flex-wrap items-center gap-3 p-4">
                <div className="flex w-full min-w-0 items-start gap-3 sm:w-auto sm:flex-1">
                <StoreLogo url={r.logo_url} name={r.store_name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{r.store_name || "متجر بدون اسم"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.city || "—"} · {r.products_count} منتج · {r.orders_count} طلب
                  </p>
                  <p className="text-sm">{r.owner_name || r.full_name || "—"} · {r.governorate || "—"}</p>
                  <p dir="ltr" className="break-all text-xs">{r.contact_email || r.email || "—"} · {r.contact_phone || r.phone || "—"}</p>
                  <p className="text-xs text-muted-foreground">{r.address || "—"}</p>
                  {r.store_status === "suspended" && r.rejection_reason && (
                    <p className="truncate text-xs text-destructive">السبب: {r.rejection_reason}</p>
                  )}
                </div>
                </div>
                <Badge variant={r.store_status === "approved" ? "default" : "secondary"}>
                  {STATUS_LABEL[r.store_status ?? ""] ?? r.store_status}
                </Badge>
                <Button asChild variant="outline" size="sm">
                  <Link to={`/store/${r.id}`}>عرض المتجر</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to={`/admin/users/${r.id}`}>الحساب</Link>
                </Button>
                {can("sellers.manage") && (r.store_status === "approved" ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => { setSuspendTarget(r); setReason(""); }}
                  >
                    <ShieldOff className="me-1 h-4 w-4" /> تعليق
                  </Button>
                ) : r.store_status === "suspended" ? (
                  <Button size="sm" onClick={() => void reactivate(r)}>
                    <ShieldCheck className="me-1 h-4 w-4" /> تنشيط
                  </Button>
                ) : <Button asChild variant="outline" size="sm"><Link to="/admin/seller-applications">مراجعة الطلب</Link></Button>)}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="my-4 flex items-center justify-center gap-3">
        <Button variant="outline" disabled={offset===0 || loading} onClick={() => setOffset((n)=>Math.max(0,n-50))}>السابق</Button>
        <span>{Math.floor(offset/50)+1} / {Math.max(1,Math.ceil(total/50))}</span>
        <Button variant="outline" disabled={offset+50>=total || loading} onClick={() => setOffset((n)=>n+50)}>التالي</Button>
      </div>
      <Dialog open={!!suspendTarget} onOpenChange={(o) => !o && setSuspendTarget(null)}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>تعليق المتجر</DialogTitle></DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="سبب التعليق (يُسجَّل ويُبلَّغ به البائع)"
            maxLength={500}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendTarget(null)}>إلغاء</Button>
            <Button onClick={suspend} disabled={working}>
              {working && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              تأكيد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminStores;
