import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, Eye, EyeOff, Star, RefreshCw } from "lucide-react";

interface ReviewRow {
  id: string;
  product_id: string;
  product_name: string | null;
  user_id: string;
  author_name: string | null;
  rating: number;
  comment: string | null;
  image_url: string | null;
  is_hidden: boolean;
  hidden_reason: string | null;
  created_at: string;
}

const STATUSES = [
  { value: "all", label: "الكل" },
  { value: "visible", label: "ظاهرة" },
  { value: "hidden", label: "مخفية" },
] as const;

const AdminReviews = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [hideTarget, setHideTarget] = useState<ReviewRow | null>(null);
  const [reason, setReason] = useState("");
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_reviews", {
      _status: status,
      _search: search.trim() || null,
      _limit: 300,
    });
    if (error) {
      toast({ title: "تعذر تحميل التقييمات", description: error.message, variant: "destructive" });
    }
    setRows(((data ?? []) as ReviewRow[]));
    setLoading(false);
  }, [status, search, toast]);

  useEffect(() => { void load(); }, [load]);

  const stats = useMemo(() => ({
    total: rows.length,
    hidden: rows.filter((r) => r.is_hidden).length,
    low: rows.filter((r) => r.rating <= 2).length,
  }), [rows]);

  const hideReview = async () => {
    if (!hideTarget) return;
    if (reason.trim().length < 5) {
      toast({ title: "اكتب سبب الإخفاء (5 أحرف على الأقل)", variant: "destructive" });
      return;
    }
    setWorking(true);
    const { error } = await supabase.rpc("admin_hide_review", {
      _review_id: hideTarget.id,
      _reason: reason.trim(),
    });
    setWorking(false);
    if (error) {
      toast({ title: "تعذر إخفاء التقييم", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "تم إخفاء التقييم" });
    setHideTarget(null);
    setReason("");
    void load();
  };

  const unhide = async (row: ReviewRow) => {
    const { error } = await supabase.rpc("admin_unhide_review", { _review_id: row.id });
    if (error) {
      toast({ title: "تعذر إظهار التقييم", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "تم إظهار التقييم" });
    void load();
  };

  return (
    <AdminLayout
      title="مراجعة التقييمات"
      description="إخفاء التقييمات المسيئة أو المخالفة وإعادة إظهارها مع تسجيل السبب"
      actions={
        <Button variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="me-2 h-4 w-4" /> تحديث
        </Button>
      }
    >
      <div className="mb-4 grid grid-cols-3 gap-3">
        {[
          { label: "إجمالي المعروض", value: stats.total },
          { label: "مخفية", value: stats.hidden },
          { label: "تقييم منخفض (≤2)", value: stats.low },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-bold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs value={status} onValueChange={setStatus}>
          <TabsList>
            {STATUSES.map((s) => (
              <TabsTrigger key={s.value} value={s.value}>{s.label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث بالتعليق أو المنتج أو الكاتب..."
            className="pe-9"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : rows.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">لا توجد تقييمات مطابقة</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={r.id} className={r.is_hidden ? "border-destructive/40" : undefined}>
              <CardContent className="flex flex-wrap items-start gap-4 p-4">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-1 text-sm font-semibold">
                      <Star className="h-4 w-4 fill-warning text-warning" /> {r.rating}
                    </span>
                    <span className="truncate text-sm font-medium">{r.product_name ?? "منتج محذوف"}</span>
                    {r.is_hidden && <Badge variant="destructive">مخفي</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {r.comment?.trim() || "بدون تعليق"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {r.author_name ?? "مستخدم"} — {new Date(r.created_at).toLocaleString("ar")}
                  </p>
                  {r.is_hidden && r.hidden_reason && (
                    <p className="text-xs text-destructive">سبب الإخفاء: {r.hidden_reason}</p>
                  )}
                </div>
                {r.image_url && (
                  <img src={r.image_url} alt="صورة التقييم" loading="lazy" className="h-16 w-16 rounded-md object-cover" />
                )}
                {r.is_hidden ? (
                  <Button size="sm" variant="outline" onClick={() => void unhide(r)}>
                    <Eye className="me-2 h-4 w-4" /> إظهار
                  </Button>
                ) : (
                  <Button size="sm" variant="destructive" onClick={() => { setHideTarget(r); setReason(""); }}>
                    <EyeOff className="me-2 h-4 w-4" /> إخفاء
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!hideTarget} onOpenChange={(o) => !o && setHideTarget(null)}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>إخفاء التقييم</DialogTitle></DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="سبب الإخفاء (يُسجَّل في سجل التدقيق)"
            maxLength={500}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setHideTarget(null)}>إلغاء</Button>
            <Button variant="destructive" disabled={working} onClick={() => void hideReview()}>
              {working && <Loader2 className="me-2 h-4 w-4 animate-spin" />} تأكيد الإخفاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminReviews;
