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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, ShieldCheck, UserCog } from "lucide-react";

type AppRole = "customer" | "vendor" | "admin" | "super_admin" | "moderator";

const ROLE_LABEL: Record<AppRole, string> = {
  customer: "مشتري",
  vendor: "بائع",
  moderator: "مشرف",
  admin: "مدير",
  super_admin: "مدير عام",
};

const MANAGED_ROLES: AppRole[] = ["moderator", "admin", "super_admin"];

interface RoleRow { user_id: string; role: AppRole }

const AdminRoles = () => {
  const { toast } = useToast();
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [targetId, setTargetId] = useState("");
  const [role, setRole] = useState<AppRole>("moderator");
  const [reason, setReason] = useState("");
  const [working, setWorking] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("role", MANAGED_ROLES);
    const rows = (data as RoleRow[]) ?? [];
    setRoles(rows);
    const ids = [...new Set(rows.map((r) => r.user_id))];
    if (ids.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", ids);
      setNames(
        Object.fromEntries((profiles ?? []).map((p) => [p.id, p.full_name || "بدون اسم"])),
      );
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const map = new Map<string, AppRole[]>();
    for (const r of roles) map.set(r.user_id, [...(map.get(r.user_id) ?? []), r.role]);
    return [...map.entries()].filter(([id]) => {
      if (!q) return true;
      return id.toLowerCase().includes(q) || (names[id] ?? "").toLowerCase().includes(q);
    });
  }, [roles, search, names]);

  const apply = async (userId: string, r: AppRole, grant: boolean, why: string) => {
    setWorking(true);
    const { error } = await supabase.rpc("admin_set_user_role", {
      _user_id: userId,
      _role: r,
      _grant: grant,
      _reason: why || null,
    });
    setWorking(false);
    if (error) {
      toast({
        title: "تعذر تعديل الصلاحية",
        description: error.message.includes("not_authorized")
          ? "هذا الإجراء متاح للمدير العام فقط"
          : error.message,
        variant: "destructive",
      });
      return false;
    }
    toast({ title: grant ? "تم منح الصلاحية" : "تم سحب الصلاحية" });
    void load();
    return true;
  };

  return (
    <AdminLayout
      title="الأدوار والصلاحيات"
      description="منح أو سحب صلاحيات الإدارة. متاح للمدير العام فقط، وكل تغيير يُسجَّل في سجل التدقيق."
      actions={
        <Button onClick={() => { setDialogOpen(true); setTargetId(""); setReason(""); }}>
          <UserCog className="me-1 h-4 w-4" /> منح صلاحية
        </Button>
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
          <Badge variant="secondary">{grouped.length} حساب إداري</Badge>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : grouped.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">لا توجد حسابات إدارية</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {grouped.map(([id, list]) => (
            <Card key={id}>
              <CardContent className="flex flex-wrap items-center gap-3 p-4">
                <ShieldCheck className="h-5 w-5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{names[id] ?? "بدون اسم"}</p>
                  <p className="truncate text-xs text-muted-foreground">{id}</p>
                </div>
                {list.map((r) => (
                  <Badge key={r} variant={r === "super_admin" ? "default" : "secondary"}>
                    {ROLE_LABEL[r]}
                  </Badge>
                ))}
                <Button asChild variant="outline" size="sm">
                  <Link to={`/admin/users/${id}`}>الملف</Link>
                </Button>
                {list.map((r) => (
                  <Button
                    key={`revoke-${r}`}
                    variant="destructive"
                    size="sm"
                    disabled={working}
                    onClick={() => void apply(id, r, false, "سحب من لوحة الأدوار")}
                  >
                    سحب {ROLE_LABEL[r]}
                  </Button>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>منح صلاحية إدارية</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              placeholder="معرّف المستخدم (UUID)"
            />
            <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MANAGED_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="سبب المنح (يُسجَّل في سجل التدقيق)"
              maxLength={300}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button
              disabled={working || !/^[0-9a-f-]{36}$/i.test(targetId.trim())}
              onClick={async () => {
                const ok = await apply(targetId.trim(), role, true, reason.trim());
                if (ok) setDialogOpen(false);
              }}
            >
              {working && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              منح
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminRoles;
