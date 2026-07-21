import { Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, MapPin, Bell, Lock, LogOut, Shield, HeartHandshake } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const items = [
  { to: "/profile", icon: User, title: "الملف الشخصي", desc: "الاسم، رقم الهاتف، الصورة" },
  { to: "/account/addresses", icon: MapPin, title: "العناوين", desc: "إدارة عناوين الشحن" },
  { to: "/notifications/settings", icon: Bell, title: "الإشعارات", desc: "تفضيلات التنبيهات" },
  { to: "/followed-brands", icon: HeartHandshake, title: "العلامات المتابعة", desc: "العلامات التجارية التي تتابعها" },
  { to: "/forgot-password", icon: Lock, title: "كلمة المرور", desc: "تغيير كلمة المرور" },
];

const Settings = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-6 max-w-3xl">
        <h1 className="text-2xl font-bold mb-2 flex items-center gap-2">
          <Shield className="h-6 w-6" /> الإعدادات
        </h1>
        <p className="text-muted-foreground mb-6">{user?.email}</p>

        <div className="grid gap-3">
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