import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Plus, ShieldAlert, Undo2 } from "lucide-react";
import { VIOLATION_REASON_CODES, violationSeverityClass, violationSeverityLabel } from "@/lib/violations";
import { logAdminAction } from "@/lib/auditLog";

interface ViolationRow {
  id: string;
  vendor_id: string;
  severity: string;
  reason_code: string;
  reason: string | null;
  status: string;
  created_at: string;
}

interface SellerOption {
  id: string;
  full_name: string | null;
}

const SellerViolationsAdmin = () => {
  const { toast } = useToast();
  const [tab, setTab] = useState<"active" | "revoked">("active");
  const [rows, setRows] = useState<ViolationRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [sellers, setSellers] = useState<SellerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [open, setOpen] = useState(false);
  const [vendorId, setVendorId] = useState("");
  const [severity, setSeverity] = useState("warning");
  const [reasonCode, setReasonCode] = useState(VIOLATION_REASON_CODES[0]);
  const [reason, setReason] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("seller_violations")
      .select("id,vendor_id,severity,reason_code,reason,status,created_at")
      .eq("status", tab)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) toast({ title: "تعذّر تحميل المخالفات", description: error.message, variant: "destructive" });
    const list = (data ?? []) as ViolationRow[];
    setRows(list);
    const ids = [...new Set(list.map((r) => r.vendor_id))];
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id,full_name").in("id", ids);
      setNames(Object.fromEntries((profs ?? []).map((p) => [p.id, p.full_name ?? "بائع"])));
    }
    setLoading(false);
  }, [tab, toast]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const loadSellers = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id,full_name")
        .eq("role", "vendor")
        .order("created_at", { ascending: false })
        .limit(300);
      setSellers((data ?? []) as SellerOption[]);
    };
    void loadSellers();
  }, []);

  const issue = async () => {
    if (!vendorId) {
      toast({ title: "اختر البائع أولاً", variant: "destructive" });
      return;
    }
    setWorking(true);
    const { error } = await supabase.rpc("admin_issue_violation", {
      _vendor_id: vendorId,
      _severity: severity,
      _reason_code: reasonCode,
      _reason: reason.trim() || null,
    });
    setWorking(false);
    if (error) {
      toast({ title: "تعذّر إصدار المخالفة", description: error.message, variant: "destructive" });
      return;
    }
    await logAdminAction("seller_violation_issued", { vendor_id: vendorId, severity, reason_code: reasonCode });
    toast({ title: "تم إصدار المخالفة وإشعار البائع" });
    setOpen(false);
    setReason("");
    setVendorId("");
    void load();
  };

  const revoke = async (row: ViolationRow) => {
    setWorking(true);
    const { error } = await supabase.rpc("admin_revoke_violation", { _violation_id: row.id, _note: null });
    setWorking(false);
    if (error) {
      toast({ title: "تعذّر إلغاء المخالفة", description: error.message, variant: "destructive" });
      return;
    }
    await logAdminAction("seller_violation_revoked", { violation_id: row.id, vendor_id: row.vendor_id });
    toast({ title: "تم إلغاء المخالفة" });
    void load();
  };

  const filtered = rows.filter((r) => {
    const q = search.trim();
    if (!q) return true;
    return (names[r.vendor_id] ?? "").includes(q) || r.reason_code.includes(q);
  });

  return (
    <AdminLayout
      title="المخالفات والإنذارات"
      description="إصدار الإنذارات والمخالفات على البائعين ومتابعتها. 3 مخالفات سارية توقف الحساب تلقائياً."
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="me-2 h-4 w-4" /> إصدار مخالفة</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>إصدار إنذار / مخالفة</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>البائع</Label>
                <Select value={vendorId} onValueChange={setVendorId}>
                  <SelectTrigger><SelectValue placeholder="اختر البائع" /></SelectTrigger>
                  <SelectContent>
                    {sellers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.full_name ?? s.id.slice(0, 8)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>الدرجة</Label>
                <Select value={severity} onValueChange={setSeverity}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="warning">إنذار (لا يُحتسب)</SelectItem>
                    <SelectItem value="strike">مخالفة</SelectItem>
                    <SelectItem value="suspension">إيقاف فوري للحساب</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>سبب المخالفة</Label>
                <Select value={reasonCode} onValueChange={setReasonCode}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {VIOLATION_REASON_CODES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>تفاصيل إضافية (اختياري)</Label>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={issue} disabled={working}>
                {working && <Loader2 className="me-2 h-4 w-4 animate-spin" />} إصدار وإشعار البائع
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "active" | "revoked")}>
            <TabsList>
              <TabsTrigger value="active">سارية</TabsTrigger>
              <TabsTrigger value="revoked">ملغاة</TabsTrigger>
            </TabsList>
          </Tabs>
          <Input
            className="min-w-[200px] flex-1"
            placeholder="بحث باسم البائع أو السبب"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">لا توجد مخالفات في هذه القائمة.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <Card key={r.id}>
              <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-semibold">
                    <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                    {names[r.vendor_id] ?? "بائع"}
                  </p>
                  <p className="text-sm">{r.reason_code}</p>
                  {r.reason && <p className="text-sm text-muted-foreground">{r.reason}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("ar-SY")}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className={violationSeverityClass(r.severity)}>
                    {violationSeverityLabel(r.severity)}
                  </Badge>
                  {r.status === "active" && (
                    <Button variant="outline" size="sm" onClick={() => revoke(r)} disabled={working}>
                      <Undo2 className="me-2 h-4 w-4" /> إلغاء
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AdminLayout>
  );
};

export default SellerViolationsAdmin;
