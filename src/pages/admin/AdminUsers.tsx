import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Search, ShieldOff, ShieldCheck, Ban, Store } from "lucide-react";

interface ProfileRow {
  id: string;
  full_name: string | null;
  role: "customer" | "vendor";
  account_status: string;
  status_reason: string | null;
  is_banned: boolean;
  created_at: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  active: "نشط",
  suspended: "معلّق",
  banned: "محظور",
};

type Mode = "buyers" | "sellers";

const AdminUsers = ({ mode }: { mode: Mode }) => {
  const { toast } = useToast();
  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState<{ type: "ban" | "suspend"; user: ProfileRow } | null>(null);
  const [reason, setReason] = useState("");
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, role, account_status, status_reason, is_banned, created_at")
      .eq("role", mode === "buyers" ? "customer" : "vendor")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    }
    setRows((data ?? []) as ProfileRow[]);
    setLoading(false);
  }, [mode, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => (r.full_name ?? "").toLowerCase().includes(q) || r.id.includes(q));
  }, [rows, search]);

  const runAction = async () => {
    if (!action) return;
    if (!reason.trim()) {
      toast({ title: "السبب مطلوب", variant: "destructive" });
      return;
    }
    setWorking(true);
    const rpc = action.type === "ban" ? "admin_ban_user" : "admin_suspend_user";
    const { error } = await supabase.rpc(rpc, {
      _user_id: action.user.id,
      _reason: reason.trim(),
    });
    setWorking(false);
    if (error) {
      toast({ title: "تعذر تنفيذ الإجراء", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: action.type === "ban" ? "تم حظر المستخدم" : "تم تعليق المستخدم" });
    setAction(null);
    setReason("");
    void load();
  };

  const activate = async (row: ProfileRow) => {
    const { error } = await supabase.rpc("admin_activate_user", { _user_id: row.id });
    if (error) {
      toast({ title: "تعذر التنشيط", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "تم تنشيط الحساب" });
    void load();
  };

  return (
    <AdminLayout
      title={mode === "buyers" ? "إدارة المشترين" : "إدارة البائعين"}
      description={
        mode === "buyers"
          ? "استعراض حسابات المشترين وتعليقها أو حظرها عند الحاجة."
          : "استعراض حسابات البائعين وإدارة حالتها."
      }
    >
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالاسم أو المعرّف..."
              className="pe-9"
            />
          </div>
          <Badge variant="secondary">{filtered.length} حساب</Badge>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            لا توجد حسابات مطابقة
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((row) => (
            <Card key={row.id}>
              <CardContent className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{row.full_name || "بدون اسم"}</p>
                  <p className="truncate text-xs text-muted-foreground">{row.id}</p>
                  {row.status_reason && (
                    <p className="mt-1 text-xs text-destructive">السبب: {row.status_reason}</p>
                  )}
                </div>
                <Badge
                  variant={
                    row.is_banned || row.account_status === "banned"
                      ? "destructive"
                      : row.account_status === "suspended"
                        ? "secondary"
                        : "default"
                  }
                >
                  {STATUS_LABEL[row.is_banned ? "banned" : row.account_status] ?? row.account_status}
                </Badge>
                {mode === "sellers" && (
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/store/${row.id}`}>
                      <Store className="me-1 h-4 w-4" /> المتجر
                    </Link>
                  </Button>
                )}
                {row.account_status === "active" && !row.is_banned ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setAction({ type: "suspend", user: row }); setReason(""); }}
                    >
                      <ShieldOff className="me-1 h-4 w-4" /> تعليق
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => { setAction({ type: "ban", user: row }); setReason(""); }}
                    >
                      <Ban className="me-1 h-4 w-4" /> حظر
                    </Button>
                  </>
                ) : (
                  <Button variant="default" size="sm" onClick={() => activate(row)}>
                    <ShieldCheck className="me-1 h-4 w-4" /> تنشيط
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!action} onOpenChange={(o) => !o && setAction(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {action?.type === "ban" ? "حظر الحساب" : "تعليق الحساب"}
            </DialogTitle>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="اكتب سبب الإجراء (يُسجَّل في سجل النشاط)"
            maxLength={500}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAction(null)}>إلغاء</Button>
            <Button onClick={runAction} disabled={working}>
              {working && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              تأكيد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminUsers;