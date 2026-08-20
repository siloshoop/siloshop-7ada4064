import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, RefreshCw, Ticket } from "lucide-react";

interface CouponRow {
  id: string;
  code: string;
  vendor_id: string;
  vendor_name: string | null;
  discount_type: string;
  discount_value: number;
  min_purchase: number | null;
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

const AdminCoupons = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<CouponRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_coupons", {
      _search: search.trim() || null,
      _limit: 300,
    });
    if (error) {
      toast({ title: "تعذر تحميل الكوبونات", description: error.message, variant: "destructive" });
    }
    setRows(((data ?? []) as CouponRow[]));
    setLoading(false);
  }, [search, toast]);

  useEffect(() => { void load(); }, [load]);

  const stats = useMemo(() => {
    const now = Date.now();
    return {
      total: rows.length,
      active: rows.filter((r) => r.is_active && (!r.expires_at || new Date(r.expires_at).getTime() > now)).length,
      expired: rows.filter((r) => r.expires_at && new Date(r.expires_at).getTime() <= now).length,
      uses: rows.reduce((sum, r) => sum + (r.used_count || 0), 0),
    };
  }, [rows]);

  const toggle = async (row: CouponRow, next: boolean) => {
    setBusy(row.id);
    const { error } = await supabase.rpc("admin_set_coupon_active", {
      _coupon_id: row.id,
      _is_active: next,
      _reason: next ? "تشغيل من الإدارة" : "إيقاف من الإدارة",
    });
    setBusy(null);
    if (error) {
      toast({ title: "تعذر تحديث الكوبون", description: error.message, variant: "destructive" });
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, is_active: next } : r)));
    toast({ title: next ? "تم تشغيل الكوبون" : "تم إيقاف الكوبون" });
  };

  return (
    <AdminLayout
      title="كوبونات البائعين"
      description="مراقبة أكواد الخصم في المنصة وإيقاف المخالف منها مع تسجيل الإجراء"
      actions={
        <Button variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="me-2 h-4 w-4" /> تحديث
        </Button>
      }
    >
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "إجمالي الكوبونات", value: stats.total },
          { label: "فعّالة", value: stats.active },
          { label: "منتهية", value: stats.expired },
          { label: "مرات الاستخدام", value: stats.uses },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-bold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="relative mb-4">
        <Search className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث بالكود أو اسم البائع..."
          className="pe-9"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : rows.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">لا توجد كوبونات</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const expired = r.expires_at ? new Date(r.expires_at).getTime() <= Date.now() : false;
            return (
              <Card key={r.id}>
                <CardContent className="flex flex-wrap items-center gap-4 p-4">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="rounded-md bg-primary/10 p-2 text-primary"><Ticket className="h-4 w-4" /></span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-semibold">{r.code}</span>
                        {expired && <Badge variant="secondary">منتهي</Badge>}
                        {!r.is_active && <Badge variant="destructive">موقوف</Badge>}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {r.vendor_name ?? "بائع"} — {r.discount_type === "percentage" ? `${r.discount_value}%` : `${r.discount_value} ل.س`}
                        {r.min_purchase ? ` — حد أدنى ${r.min_purchase} ل.س` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        استُخدم {r.used_count}{r.max_uses ? ` من ${r.max_uses}` : ""}
                        {r.expires_at ? ` — ينتهي ${new Date(r.expires_at).toLocaleDateString("ar")}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {busy === r.id && <Loader2 className="h-4 w-4 animate-spin" />}
                    <Switch
                      checked={r.is_active}
                      onCheckedChange={(v) => void toggle(r, v)}
                      disabled={busy === r.id}
                      aria-label="تشغيل/إيقاف الكوبون"
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminCoupons;
