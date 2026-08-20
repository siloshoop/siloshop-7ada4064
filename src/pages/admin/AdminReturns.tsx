import { useCallback, useEffect, useState } from "react";
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
import { RETURN_STATUS } from "@/lib/returnStatus";
import ReturnTimeline from "@/components/returns/ReturnTimeline";
import ReturnDetailDialog from "@/components/returns/ReturnDetailDialog";
import { Loader2, Search, RotateCcw, MessageCircle } from "lucide-react";

interface ReturnListRow {
  id: string;
  status: string;
  return_number: string | null;
  order_id: string;
  order_number: string | null;
  reason_label: string | null;
  customer_name: string | null;
  vendor_name: string | null;
  unread_count: number;
  items_count: number;
  created_at: string;
}

const FILTERS = [
  "all",
  "pending_review",
  "seller_reviewing",
  "waiting_customer",
  "approved",
  "customer_shipping",
  "seller_inspecting",
  "inspection_failed",
  "completed",
  "rejected",
] as const;

const AdminReturns = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<ReturnListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [decision, setDecision] = useState<{ row: ReturnListRow; type: "approve" | "reject" } | null>(null);
  const [note, setNote] = useState("");
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("list_returns", {
      _scope: "admin",
      _status: filter === "all" ? null : filter,
      _search: search.trim() || null,
      _limit: 100,
      _offset: 0,
    });
    setLoading(false);
    if (error) {
      toast({ title: "تعذر تحميل الإرجاعات", description: error.message, variant: "destructive" });
      return;
    }
    const payload = data as unknown as { rows?: ReturnListRow[]; total?: number } | null;
    setRows(payload?.rows ?? []);
    setTotal(payload?.total ?? 0);
  }, [filter, search, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel("returns-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "returns" }, () => void load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

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
      title="إدارة الإرجاعات"
      description="مراجعة طلبات الإرجاع، متابعة المحادثات، والفصل في الخلافات بين المشتري والبائع."
      actions={
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList className="flex flex-wrap">
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
              placeholder="بحث برقم الإرجاع أو الطلب أو الاسم..."
              className="pe-9"
            />
          </div>
          <Badge variant="secondary">{total} طلب</Badge>
        </CardContent>
      </Card>

      {loading && rows.length === 0 ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">لا توجد طلبات مطابقة</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const meta = RETURN_STATUS[r.status];
            return (
              <Card key={r.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <RotateCcw className="h-5 w-5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">
                        {r.return_number ?? r.id.slice(0, 8)} · {r.reason_label}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        الطلب: {r.order_number ?? r.order_id.slice(0, 8)} ·{" "}
                        {new Date(r.created_at).toLocaleString("ar-SY")} · {r.items_count} منتج
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {r.customer_name} ← {r.vendor_name}
                      </p>
                    </div>
                    {r.unread_count > 0 && (
                      <Badge variant="destructive" className="gap-1">
                        <MessageCircle className="h-3 w-3" /> {r.unread_count}
                      </Badge>
                    )}
                    <Badge variant={meta?.variant ?? "secondary"}>{meta?.label ?? r.status}</Badge>
                    <Button size="sm" variant="outline" onClick={() => setOpenId(r.id)}>
                      التفاصيل
                    </Button>
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
                  </div>

                  <ReturnTimeline status={r.status} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ReturnDetailDialog
        returnId={openId}
        open={!!openId}
        onOpenChange={(o) => !o && setOpenId(null)}
        onChanged={load}
      />

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
