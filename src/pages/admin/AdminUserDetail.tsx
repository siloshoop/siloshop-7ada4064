import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Ban, ShieldOff, ShieldCheck, LogOut, ShoppingBag } from "lucide-react";

interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: string;
  account_status: string;
  status_reason: string | null;
  is_banned: boolean;
  created_at: string | null;
}

interface OrderRow {
  id: string;
  created_at: string;
  status: string;
  total_amount: number;
  role: string;
}

interface ActivityRow {
  id: string;
  action_type: string;
  created_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  active: "نشط",
  suspended: "معلّق",
  banned: "محظور",
};

const money = (n: number) => `${new Intl.NumberFormat("ar-SY").format(Math.round(n || 0))} ل.س`;

const AdminUserDetail = () => {
  const { id = "" } = useParams();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<"ban" | "suspend" | null>(null);
  const [reason, setReason] = useState("");
  const [working, setWorking] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: p }, { data: r }, { data: o }, { data: a }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, phone, role, account_status, status_reason, is_banned, created_at")
        .eq("id", id)
        .maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", id),
      supabase.rpc("admin_user_order_history", { _user_id: id, _limit: 20 }),
      supabase
        .from("activity_logs")
        .select("id, action_type, created_at")
        .eq("user_id", id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    setProfile((p as Profile) ?? null);
    setRoles(((r as { role: string }[]) ?? []).map((x) => x.role));
    setOrders((o as OrderRow[]) ?? []);
    setActivity((a as ActivityRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  const runAction = async () => {
    if (!action || !profile) return;
    if (reason.trim().length < 5) {
      toast({ title: "اكتب سبب الإجراء", variant: "destructive" });
      return;
    }
    setWorking(true);
    const { error } =
      action === "ban"
        ? await supabase.rpc("admin_ban_user", { _user_id: profile.id, _reason: reason.trim() })
        : await supabase.rpc("admin_suspend_user", { _user_id: profile.id, _reason: reason.trim() });
    setWorking(false);
    if (error) {
      toast({ title: "تعذر تنفيذ الإجراء", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: action === "ban" ? "تم حظر الحساب" : "تم تعليق الحساب" });
    setAction(null);
    setReason("");
    void load();
  };

  const activate = async () => {
    if (!profile) return;
    const { error } = await supabase.rpc("admin_activate_user", { _user_id: profile.id });
    if (error) {
      toast({ title: "تعذر التنشيط", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "تم تنشيط الحساب" });
    void load();
  };

  const forceLogout = async () => {
    if (!profile) return;
    setWorking(true);
    const { error } = await supabase.functions.invoke("admin-force-logout", {
      body: { user_id: profile.id },
    });
    setWorking(false);
    if (error) {
      toast({ title: "تعذر إخراج المستخدم", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "تم إخراج المستخدم من كل الأجهزة" });
  };

  if (loading) {
    return (
      <AdminLayout title="ملف المستخدم">
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  if (!profile) {
    return (
      <AdminLayout title="ملف المستخدم">
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            لا يوجد مستخدم بهذا المعرّف
          </CardContent>
        </Card>
      </AdminLayout>
    );
  }

  const isActive = profile.account_status === "active" && !profile.is_banned;

  return (
    <AdminLayout
      title={profile.full_name || "مستخدم بدون اسم"}
      description="ملف موحّد يجمع الحالة والصلاحيات والطلبات وسجل النشاط."
      actions={
        <div className="flex flex-wrap gap-2">
          {isActive ? (
            <>
              <Button variant="outline" size="sm" onClick={() => { setAction("suspend"); setReason(""); }}>
                <ShieldOff className="me-1 h-4 w-4" /> تعليق
              </Button>
              <Button variant="destructive" size="sm" onClick={() => { setAction("ban"); setReason(""); }}>
                <Ban className="me-1 h-4 w-4" /> حظر
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={activate}>
              <ShieldCheck className="me-1 h-4 w-4" /> تنشيط
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={forceLogout} disabled={working}>
            <LogOut className="me-1 h-4 w-4" /> إخراج من الأجهزة
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-base">الحساب</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-xs text-muted-foreground" dir="ltr">{profile.id}</p>
            <p>الهاتف: {profile.phone || "—"}</p>
            <p>النوع: {profile.role === "vendor" ? "بائع" : "مشتري"}</p>
            <div className="flex items-center gap-1">
              <span>الحالة:</span>
              <Badge variant={isActive ? "default" : "destructive"}>
                {STATUS_LABEL[profile.is_banned ? "banned" : profile.account_status] ?? profile.account_status}
              </Badge>
            </div>
            {profile.status_reason && (
              <p className="text-xs text-destructive">السبب: {profile.status_reason}</p>
            )}
            <p className="text-xs text-muted-foreground">
              انضم: {profile.created_at ? new Date(profile.created_at).toLocaleDateString("ar-SY") : "—"}
            </p>
            <div className="flex flex-wrap gap-1 pt-1">
              {roles.length === 0 ? (
                <span className="text-xs text-muted-foreground">لا صلاحيات إضافية</span>
              ) : (
                roles.map((r) => <Badge key={r} variant="secondary">{r}</Badge>)
              )}
            </div>
            {profile.role === "vendor" && (
              <Button asChild variant="outline" size="sm" className="mt-2">
                <Link to={`/store/${profile.id}`}>عرض المتجر</Link>
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">آخر الطلبات</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {orders.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا توجد طلبات</p>
            ) : (
              orders.map((o) => (
                <div key={`${o.id}-${o.role}`} className="flex items-center gap-2 text-sm">
                  <ShoppingBag className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">
                    {o.id.slice(0, 8)} · {new Date(o.created_at).toLocaleDateString("ar-SY")}
                  </span>
                  <Badge variant="outline">{o.status}</Badge>
                  <span className="whitespace-nowrap text-xs">{money(Number(o.total_amount))}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">سجل النشاط</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا يوجد نشاط مسجَّل</p>
            ) : (
              activity.map((a) => (
                <div key={a.id} className="flex items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">{a.action_type}</span>
                  <span className="whitespace-nowrap text-xs text-muted-foreground">
                    {new Date(a.created_at).toLocaleString("ar-SY")}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!action} onOpenChange={(o) => !o && setAction(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>{action === "ban" ? "حظر الحساب" : "تعليق الحساب"}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="سبب الإجراء (يُسجَّل في سجل التدقيق)"
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

export default AdminUserDetail;
