import { useEffect, useMemo, useState } from "react";
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
import { RETURN_STATUS, RETURN_REASONS } from "@/lib/returnStatus";
import { Loader2, Search, RotateCcw } from "lucide-react";

interface ReturnRow {
  id: string;
  order_id: string;
  customer_id: string;
  vendor_id: string;
  reason: string;
  notes: string | null;
  status: string;
  review_note: string | null;
  created_at: string;
}

const FILTERS = ["all", "pending", "under_review", "approved", "rejected", "refunded"] as const;

const reasonLabel = (v: string) =>
  RETURN_REASONS.find((r) => r.value === v)?.label ?? v;

const AdminReturns = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<ReturnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [search, setSearch] = useState("");
  const [decision, setDecision] = useState<{ row: ReturnRow; type: "approve" | "reject" } | null>(null);
  const [note, setNote] = useState("");
  const [working, setWorking] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("returns")
      .select("id, order_id, customer_id, vendor_id, reason, notes, status, review_note, created_at")
      .order("created_at", { ascending: false })
      .limit(300);
    setRows((data as ReturnRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (!q) return true;
      return r.order_id.toLowerCase().includes(q) || r.id.toLowerCase().includes(q);
    });
  }, [rows, filter, search]);

  const resolve = async () => {
    if (!decision) return;
    if (note.trim().length < 5) {
      toast({ title: "اكتب سبب القرار", variant: "destructive" });
      return;
    }
    setWorking(true);
    const { error } = await supabase.rpc("admin_resolve_return_dispute", {
      _return_id: decision.row.id,
      _decision: decision.type,
      _note: note.trim(),
      _ip_address: null,
      _user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    });
    setWorking(false);
    if (error) {
      toast({ title: "تعذر تنفيذ القرار", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: decision.type === "approve" ? "تمت الموافقة على الإرجاع" : "تم رفض الإرجاع" });
    setDecision(null);
    setNote("");
    void load();
  };

  return (
    <AdminLayout
      title="الإرجاعات والاستبدال"
      description="مراجعة طلبات الإرجاع والفصل في الخلافات بين المشتري والبائع."
      actions={
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList>
            {FILTERS.map((f) => (
              <TabsTrigger key={f} value={f}>
                {f === "all" ? "الكل" : RETURN_STATUS[f]?.label ?? f}
              </TabsTrigger>
            ))}
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
              placeholder="بحث برقم الطلب أو رقم الإرجاع..."
              className="pe-9"
            />
          </div>
          <Badge variant="secondary">{filtered.length} طلب</Badge>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">لا توجد طلبات مطابقة</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const meta = RETURN_STATUS[r.status];
            return (
              <Card key={r.id}>
                <CardContent className="flex flex-wrap items-center gap-3 p-4">
                  <RotateCcw className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{reasonLabel(r.reason)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      الطلب: {r.order_id.slice(0, 8)} · {new Date(r.created_at).toLocaleString("ar-SY")}
                    </p>
                    {r.notes && <p className="truncate text-xs text-muted-foreground">{r.notes}</p>}
                    {r.review_note && (
                      <p className="truncate text-xs text-primary">ملاحظة المراجعة: {r.review_note}</p>
                    )}
                  </div>
                  <Badge variant={meta?.variant ?? "secondary"}>{meta?.label ?? r.status}</Badge>
                  <Button
                    size="sm"
                    onClick={() => { setDecision({ row: r, type: "approve" }); setNote(""); }}
                    disabled={r.status === "approved"}
                  >
                    موافقة
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => { setDecision({ row: r, type: "reject" }); setNote(""); }}
                    disabled={r.status === "rejected"}
                  >
                    رفض
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!decision} onOpenChange={(o) => !o && setDecision(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {decision?.type === "approve" ? "الموافقة على الإرجاع" : "رفض طلب الإرجاع"}
            </DialogTitle>
          </DialogHeader>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="سبب القرار (يُرسل للمشتري والبائع ويُسجَّل في السجل)"
            maxLength={500}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecision(null)}>إلغاء</Button>
            <Button onClick={resolve} disabled={working}>
              {working && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              تأكيد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminReturns;
