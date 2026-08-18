import { useEffect, useMemo, useState } from "react";
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

interface StoreRow {
  id: string;
  user_id: string;
  store_name: string | null;
  city: string | null;
  logo_url: string | null;
  status: string;
  rejection_reason: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  approved: "نشط",
  suspended: "معلّق",
  pending: "قيد المراجعة",
  rejected: "مرفوض",
};

const AdminStores = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<StoreRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [suspendTarget, setSuspendTarget] = useState<StoreRow | null>(null);
  const [reason, setReason] = useState("");
  const [working, setWorking] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("seller_applications")
      .select("id, user_id, store_name, city, logo_url, status, rejection_reason")
      .in("status", ["approved", "suspended"])
      .order("store_name", { ascending: true });
    const list = (data as StoreRow[]) ?? [];
    setRows(list);

    const { data: products } = await supabase
      .from("products")
      .select("vendor_id")
      .eq("is_active", true)
      .limit(5000);
    const tally: Record<string, number> = {};
    for (const p of products ?? []) tally[p.vendor_id] = (tally[p.vendor_id] ?? 0) + 1;
    setCounts(tally);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        (r.store_name ?? "").toLowerCase().includes(q) ||
        (r.city ?? "").toLowerCase().includes(q) ||
        r.user_id.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const suspend = async () => {
    if (!suspendTarget) return;
    if (reason.trim().length < 5) {
      toast({ title: "اكتب سبب التعليق", variant: "destructive" });
      return;
    }
    setWorking(true);
    const { error } = await supabase.rpc("suspend_seller", {
      _user_id: suspendTarget.user_id,
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
    const { error } = await supabase.rpc("reactivate_seller", { _user_id: row.user_id });
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
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث باسم المتجر أو المدينة..."
              className="pe-9"
            />
          </div>
          <Badge variant="secondary">{filtered.length} متجر</Badge>
        </CardContent>
      </Card>

      {loading ? (
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
                {r.logo_url ? (
                  <img
                    src={r.logo_url}
                    alt={r.store_name ?? "شعار المتجر"}
                    loading="lazy"
                    className="h-10 w-10 rounded-md object-cover"
                  />
                ) : (
                  <Store className="h-5 w-5 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{r.store_name || "متجر بدون اسم"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.city || "—"} · {counts[r.user_id] ?? 0} منتج
                  </p>
                  {r.status === "suspended" && r.rejection_reason && (
                    <p className="truncate text-xs text-destructive">السبب: {r.rejection_reason}</p>
                  )}
                </div>
                <Badge variant={r.status === "approved" ? "default" : "secondary"}>
                  {STATUS_LABEL[r.status] ?? r.status}
                </Badge>
                <Button asChild variant="outline" size="sm">
                  <Link to={`/store/${r.user_id}`}>عرض المتجر</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to={`/admin/users/${r.user_id}`}>الحساب</Link>
                </Button>
                {r.status === "approved" ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => { setSuspendTarget(r); setReason(""); }}
                  >
                    <ShieldOff className="me-1 h-4 w-4" /> تعليق
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => void reactivate(r)}>
                    <ShieldCheck className="me-1 h-4 w-4" /> تنشيط
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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
