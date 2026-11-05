import { formatKnownPrice as money } from "@/lib/currency";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { useStaffRole } from "@/hooks/useStaffRole";
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
  email: string | null;
  roles: string[];
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
  currency?: string | null;
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
  const [failure, setFailure] = useState("");
  const [offset, setOffset] = useState(0);
  const [detail, setDetail] = useState<{
    profile: Profile; store: Record<string, unknown> | null; addresses: Record<string, unknown>[];
    products: {id: string; name: string; price: number; currency: string; stock_quantity: number; is_active: boolean}[];
    products_total: number; orders_total: number; orders: OrderRow[]; activity: ActivityRow[];
  } | null>(null);
  const { can } = useStaffPermissions();
  const { role: staffRole } = useStaffRole();

  const load = async () => {
    setLoading(true);
    setFailure("");
    try {
      const { data, error } = await supabase.rpc("admin_account_detail", { _user_id: id, _offset: offset, _limit: 20 });
      if (error) throw error;
      const result = data as unknown as typeof detail;
      setDetail(result); setProfile(result?.profile ?? null); setRoles(result?.profile.roles ?? []);
      setOrders(result?.orders ?? []); setActivity(result?.activity ?? []);
    } catch { setFailure("تعذّر تحميل معلومات الحساب؛ تحقق من صلاحياتك وأعد المحاولة."); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [id, offset]);

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

  if (failure) return <AdminLayout title="ملف المستخدم"><div role="alert" className="space-y-3"><p>{failure}</p><Button onClick={() => void load()}>إعادة المحاولة</Button></div></AdminLayout>;

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

  const canManage = can(detail?.store || profile.role === "vendor" ? "sellers.manage" : "customers.manage");
  const isActive = profile.account_status === "active" && !profile.is_banned;

  return (
    <AdminLayout
      title={profile.full_name || "مستخدم بدون اسم"}
      description="ملف موحّد يجمع الحالة والصلاحيات والطلبات وسجل النشاط."
      actions={
        canManage && <div className="flex flex-wrap gap-2">
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
          <Button variant="outline" size="sm" onClick={forceLogout} disabled={working} hidden={staffRole !== "admin" && staffRole !== "super_admin"}>
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
            <p className="break-all">البريد: {profile.email || "—"}</p>
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
                <Link to={`/orders/${o.id}`} key={`${o.id}-${o.role}`} className="flex items-center gap-2 text-sm">
                  <ShoppingBag className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">
                    {o.id.slice(0, 8)} · {new Date(o.created_at).toLocaleDateString("ar-SY")}
                  </span>
                  <Badge variant="outline">{o.status}</Badge>
                  <span className="whitespace-nowrap text-xs">{money(o.total_amount, o.currency)}</span>
                </Link>
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

      {detail?.store && <section className="mt-6 space-y-3">
        <h2 className="text-lg font-semibold">المتجر</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          {Object.entries({store_name:"اسم المتجر",owner_name:"المالك",contact_email:"بريد المتجر",contact_phone:"هاتف المتجر",governorate:"المحافظة",city:"المدينة",address:"العنوان",status:"حالة المتجر",store_description:"الوصف",working_hours:"ساعات العمل",shipping_policy:"سياسة الشحن",return_policy:"سياسة الإرجاع",business_info:"معلومات النشاط",rejection_reason:"سبب الرفض أو التعليق",submitted_at:"تقديم الطلب",reviewed_at:"مراجعة الطلب"}).map(([key,label]) => <div key={key}><dt className="text-muted-foreground">{label}</dt><dd className="break-words">{String(detail.store?.[key] ?? "—")}</dd></div>)}
        </dl>
        <p className="text-sm">محافظات الشحن: {detail.store.shipping_all_provinces ? "جميع المحافظات" : (Array.isArray(detail.store.shipping_provinces) ? detail.store.shipping_provinces.join("، ") : "—")}</p>
        <h2 className="pt-3 text-lg font-semibold">المنتجات ({detail.products_total})</h2>
        {detail.products.length===0 ? <p className="text-muted-foreground">لا توجد منتجات</p> : detail.products.map((p) => <div key={p.id} className="flex flex-wrap items-center gap-3 border-b py-3 text-sm"><Link to={`/product/${p.id}`} className="flex-1 font-medium">{p.name}</Link><span>{money(p.price,p.currency)}</span><span>المخزون: {p.stock_quantity}</span><Badge variant={p.is_active ? "default" : "secondary"}>{p.is_active ? "نشط" : "غير نشط"}</Badge></div>)}
      </section>}
      {!!detail?.addresses.length && <section className="mt-6 space-y-3"><h2 className="text-lg font-semibold">عناوين التوصيل</h2>{detail.addresses.map((a,i)=><p key={i} className="border-b py-2 text-sm">{Object.entries(a).filter(([k])=>!["id","user_id","created_at","updated_at"].includes(k)).map(([,v])=>String(v??"")).join(" · ")}</p>)}</section>}
      <div className="my-4 flex items-center justify-center gap-3">
        <Button variant="outline" disabled={offset===0} onClick={()=>setOffset((n)=>Math.max(0,n-20))}>السابق</Button><span>{Math.floor(offset/20)+1}</span>
        <Button variant="outline" disabled={offset+20>=Math.max(detail?.products_total ?? 0,detail?.orders_total ?? 0)} onClick={()=>setOffset((n)=>n+20)}>التالي</Button>
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
