import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User, MapPin, Bell, Lock, LogOut, Shield, HeartHandshake, Store } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const items = [
  { to: "/profile", icon: User, title: "الملف الشخصي", desc: "الاسم، رقم الهاتف، الصورة" },
  { to: "/account/addresses", icon: MapPin, title: "العناوين", desc: "إدارة عناوين الشحن" },
  { to: "/notifications/settings", icon: Bell, title: "الإشعارات", desc: "تفضيلات التنبيهات" },
  { to: "/followed-brands", icon: HeartHandshake, title: "العلامات المتابعة", desc: "العلامات التجارية التي تتابعها" },
  { to: "/forgot-password", icon: Lock, title: "كلمة المرور", desc: "تغيير كلمة المرور" },
];

const sellerStatusMeta: Record<string, { label: string; color: string; desc: string }> = {
  pending: { label: "قيد المراجعة", color: "bg-amber-500", desc: "طلب متجرك قيد مراجعة الإدارة" },
  approved: { label: "متجر مفعّل", color: "bg-emerald-500", desc: "متجرك مفعّل — اذهب إلى لوحة البائع" },
  rejected: { label: "مرفوض", color: "bg-destructive", desc: "تم رفض الطلب — يمكنك التعديل وإعادة التقديم" },
  suspended: { label: "موقوف", color: "bg-slate-500", desc: "تم إيقاف متجرك مؤقتاً" },
};

const Settings = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [sellerStatus, setSellerStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("seller_applications")
        .select("status")
        .eq("user_id", user.id)
        .maybeSingle();
      setSellerStatus(data?.status ?? null);
    })();
  }, [user]);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-6 max-w-3xl">
        <h1 className="text-2xl font-bold mb-2 flex items-center gap-2">
          <Shield className="h-6 w-6" /> الإعدادات
        </h1>
        <p className="text-muted-foreground mb-6">{user?.email}</p>

        <div className="grid gap-3">
          <Link to="/seller/application">
            <Card className="p-4 flex items-center gap-4 hover:bg-accent transition-colors border-primary/30">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Store className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold">{sellerStatus ? "متجري" : "افتح متجر"}</p>
                  {sellerStatus && (
                    <Badge className={sellerStatusMeta[sellerStatus]?.color}>
                      {sellerStatusMeta[sellerStatus]?.label}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {sellerStatus
                    ? sellerStatusMeta[sellerStatus]?.desc
                    : "قدّم طلب البيع وابدأ بعرض منتجاتك بعد موافقة الإدارة"}
                </p>
              </div>
            </Card>
          </Link>

          {items.map(({ to, icon: Icon, title, desc }) => (
            <Link key={to} to={to}>
              <Card className="p-4 flex items-center gap-4 hover:bg-accent transition-colors">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold">{title}</p>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </div>
              </Card>
            </Link>
          ))}

          <Button
            variant="destructive"
            className="mt-4"
            onClick={async () => {
              await signOut();
              navigate("/");
            }}
          >
            <LogOut className="h-4 w-4 ml-2" />
            تسجيل الخروج
          </Button>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Settings;