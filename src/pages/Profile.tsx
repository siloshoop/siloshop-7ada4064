import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, User, IdCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ChangePasswordCard from "@/components/account/ChangePasswordCard";
import DeleteAccountCard from "@/components/account/DeleteAccountCard";

const Profile = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, phone, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (data) {
        setFullName(data.full_name || "");
        setPhone(data.phone || "");
        setAvatarUrl(data.avatar_url || "");
      }
      setLoading(false);
    })();
  }, [user, authLoading, navigate]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.rpc("update_own_profile", {
      _full_name: fullName || null,
      _phone: phone || null,
      _avatar_url: avatarUrl || null,
    });
    setSaving(false);
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "تم الحفظ", description: "تم تحديث ملفك الشخصي" });
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-6 max-w-2xl">
        <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <User className="h-6 w-6" /> الملف الشخصي
        </h1>
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
          <Card className="p-4 sm:p-6 space-y-3">
            <div className="flex items-center gap-2">
              <IdCard className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">معلومات الحساب</h2>
            </div>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div className="flex justify-between gap-2 sm:flex-col sm:justify-start">
                <dt className="text-muted-foreground">الاسم</dt>
                <dd className="font-medium">{fullName || "—"}</dd>
              </div>
              <div className="flex justify-between gap-2 sm:flex-col sm:justify-start">
                <dt className="text-muted-foreground">البريد الإلكتروني</dt>
                <dd className="font-medium break-all" dir="ltr">{user?.email || "—"}</dd>
              </div>
              <div className="flex justify-between gap-2 sm:flex-col sm:justify-start">
                <dt className="text-muted-foreground">رقم الهاتف</dt>
                <dd className="font-medium" dir="ltr">{phone || "—"}</dd>
              </div>
              <div className="flex justify-between gap-2 sm:flex-col sm:justify-start">
                <dt className="text-muted-foreground">تاريخ الانضمام</dt>
                <dd className="font-medium">
                  {user?.created_at
                    ? new Date(user.created_at).toLocaleDateString("ar-EG", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : "—"}
                </dd>
              </div>
            </dl>
          </Card>

          <Card className="p-4 sm:p-6 space-y-5">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={avatarUrl || undefined} />
                <AvatarFallback>{fullName.charAt(0) || "?"}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <Label htmlFor="avatar">رابط الصورة</Label>
                <Input id="avatar" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://..." />
              </div>
            </div>
            <div>
              <Label htmlFor="fullName">الاسم الكامل</Label>
              <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="phone">رقم الهاتف</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" />
            </div>
            <div>
              <Label>البريد الإلكتروني</Label>
              <Input value={user?.email || ""} disabled dir="ltr" />
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
              حفظ التغييرات
            </Button>
          </Card>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Profile;