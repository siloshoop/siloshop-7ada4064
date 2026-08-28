import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SYRIAN_GOVERNORATES } from "@/lib/syrianGovernorates";
import { Loader2, ShieldCheck, Clock, XCircle, PauseCircle, Upload, ImageIcon } from "lucide-react";

type SellerStatus = "pending" | "approved" | "rejected" | "suspended";

interface Application {
  id: string;
  status: SellerStatus;
  store_name: string | null;
  owner_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  store_description: string | null;
  address: string | null;
  governorate: string | null;
  city: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  rejection_reason: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
}

const statusMeta: Record<SellerStatus, { label: string; color: string; icon: any; description: string }> = {
  pending: { label: "قيد المراجعة", color: "bg-warning", icon: Clock, description: "طلبك قيد المراجعة من قبل الإدارة. لا يمكنك نشر المنتجات أو استلام الطلبات حتى الموافقة." },
  approved: { label: "مقبول", color: "bg-success", icon: ShieldCheck, description: "تمت الموافقة على متجرك. يمكنك الآن الوصول إلى لوحة البائع ونشر المنتجات." },
  rejected: { label: "مرفوض", color: "bg-destructive", icon: XCircle, description: "تم رفض طلبك. يمكنك تعديل بياناتك وإعادة التقديم." },
  suspended: { label: "موقوف", color: "bg-muted-foreground", icon: PauseCircle, description: "تم إيقاف متجرك مؤقتاً. يرجى التواصل مع الإدارة." },
};

const SellerApplication = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [app, setApp] = useState<Application | null>(null);
  const [saving, setSaving] = useState(false);

  const [storeName, setStoreName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [governorate, setGovernorate] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [coverPath, setCoverPath] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  const signedUrl = async (path: string | null) => {
    if (!path) return null;
    const { data } = await supabase.storage.from("store-assets").createSignedUrl(path, 3600);
    return data?.signedUrl ?? null;
  };

  const loadApplication = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("seller_applications")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    setEmail(user.email ?? "");
    if (data) {
      const a = data as unknown as Application;
      setApp(a);
      setStoreName(a.store_name ?? "");
      setOwnerName(a.owner_name ?? "");
      setEmail(a.contact_email ?? user.email ?? "");
      setPhone(a.contact_phone ?? "");
      setGovernorate(a.governorate ?? "");
      setCity(a.city ?? "");
      setAddress(a.address ?? "");
      setDescription(a.store_description ?? "");
      setLogoPath(a.logo_url);
      setCoverPath(a.cover_image_url);
      setLogoPreview(await signedUrl(a.logo_url));
      setCoverPreview(await signedUrl(a.cover_image_url));
    } else {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("id", user.id)
        .maybeSingle();
      if (profile) {
        setOwnerName(profile.full_name ?? "");
        setPhone(profile.phone ?? "");
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user) loadApplication();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, kind: "logo" | "cover") => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "الملف يجب أن يكون صورة", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "حجم الصورة كبير", description: "الحد الأقصى 5 ميجابايت", variant: "destructive" });
      return;
    }
    kind === "logo" ? setUploadingLogo(true) : setUploadingCover(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/${kind}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("store-assets").upload(path, file, { upsert: true });
    if (error) {
      toast({ title: "فشل رفع الصورة", description: error.message, variant: "destructive" });
    } else {
      const url = await signedUrl(path);
      if (kind === "logo") { setLogoPath(path); setLogoPreview(url); }
      else { setCoverPath(path); setCoverPreview(url); }
      toast({ title: "تم رفع الصورة" });
    }
    kind === "logo" ? setUploadingLogo(false) : setUploadingCover(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (storeName.trim().length < 2) { toast({ title: "اسم المتجر مطلوب", variant: "destructive" }); return; }
    if (ownerName.trim().length < 2) { toast({ title: "اسم المالك مطلوب", variant: "destructive" }); return; }
    if (!email.includes("@")) { toast({ title: "البريد الإلكتروني غير صالح", variant: "destructive" }); return; }
    if (phone.trim().length < 6) { toast({ title: "رقم الهاتف مطلوب", variant: "destructive" }); return; }
    if (!governorate) { toast({ title: "المحافظة مطلوبة", variant: "destructive" }); return; }
    if (city.trim().length < 2) { toast({ title: "المدينة مطلوبة", variant: "destructive" }); return; }

    setSaving(true);
    const { error } = await supabase.rpc("submit_seller_application", {
      _store_name: storeName,
      _owner_name: ownerName,
      _contact_email: email,
      _contact_phone: phone,
      _governorate: governorate,
      _city: city,
      _address: address || undefined,
      _store_description: description || undefined,
      _logo_url: logoPath || undefined,
      _cover_image_url: coverPath || undefined,
    });
    setSaving(false);
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "تم إرسال الطلب", description: "طلبك الآن قيد المراجعة، سنعلمك بالنتيجة قريباً." });
    await loadApplication();
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const status = app?.status;
  const isEditable = !status || status === "pending" || status === "rejected";
  const meta = status ? statusMeta[status] : null;
  const StatusIcon = meta?.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <Navbar />
      <main className="container mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">افتح متجرك</h1>
          <p className="text-muted-foreground mt-2">
            أكمل بيانات متجرك لإرسال طلب البيع. يجب اعتماد المتجر من الإدارة قبل نشر المنتجات أو استلام الطلبات.
          </p>
        </div>

        {meta && StatusIcon && (
          <Card className="mb-6 border-l-4" style={{ borderLeftColor: "hsl(var(--primary))" }}>
            <CardContent className="pt-6 flex items-start gap-4">
              <div className={`rounded-full p-3 text-primary-foreground ${meta.color}`}>
                <StatusIcon className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-lg">حالة الطلب:</span>
                  <Badge className={meta.color}>{meta.label}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{meta.description}</p>
                {status === "rejected" && app?.rejection_reason && (
                  <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                    <p className="font-semibold mb-1">سبب الرفض</p>
                    <p className="text-sm">{app.rejection_reason}</p>
                  </div>
                )}
                {status === "approved" && (
                  <Button className="mt-3" onClick={() => navigate("/dashboard")}>
                    الذهاب إلى لوحة البائع
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>معلومات المتجر</CardTitle>
            <CardDescription>
              {isEditable ? "الحقول المعلّمة بـ * إجبارية." : "لا يمكن تعديل الطلب في الوضع الحالي."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>اسم المتجر *</Label>
                  <Input value={storeName} onChange={(e) => setStoreName(e.target.value)} disabled={!isEditable} maxLength={100} />
                </div>
                <div className="space-y-2">
                  <Label>اسم المالك *</Label>
                  <Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} disabled={!isEditable} maxLength={100} />
                </div>
                <div className="space-y-2">
                  <Label>رقم الهاتف *</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} disabled={!isEditable} dir="ltr" placeholder="09XXXXXXXX" maxLength={20} />
                </div>
                <div className="space-y-2">
                  <Label>البريد الإلكتروني *</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!isEditable} dir="ltr" maxLength={255} />
                </div>
                <div className="space-y-2">
                  <Label>المحافظة *</Label>
                  <Select value={governorate} onValueChange={setGovernorate} disabled={!isEditable}>
                    <SelectTrigger><SelectValue placeholder="اختر المحافظة" /></SelectTrigger>
                    <SelectContent>
                      {SYRIAN_GOVERNORATES.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>المدينة *</Label>
                  <Input value={city} onChange={(e) => setCity(e.target.value)} disabled={!isEditable} maxLength={100} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>العنوان (اختياري)</Label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} disabled={!isEditable} maxLength={255} />
              </div>

              <div className="space-y-2">
                <Label>وصف المتجر (اختياري)</Label>
                <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} disabled={!isEditable} maxLength={1000} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>شعار المتجر (اختياري)</Label>
                  <div className="flex items-center gap-3">
                    {logoPreview ? (
                      <img src={logoPreview} alt="شعار المتجر" className="h-14 w-14 rounded-lg object-cover border" loading="lazy" />
                    ) : (
                      <div className="h-14 w-14 rounded-lg border flex items-center justify-center text-muted-foreground">
                        <ImageIcon className="h-5 w-5" />
                      </div>
                    )}
                    <Input type="file" accept="image/*" disabled={!isEditable || uploadingLogo} onChange={(e) => handleUpload(e, "logo")} />
                    {uploadingLogo && <Loader2 className="h-4 w-4 animate-spin" />}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>صورة الغلاف (اختياري)</Label>
                  <div className="flex items-center gap-3">
                    {coverPreview ? (
                      <img src={coverPreview} alt="غلاف المتجر" className="h-14 w-24 rounded-lg object-cover border" loading="lazy" />
                    ) : (
                      <div className="h-14 w-24 rounded-lg border flex items-center justify-center text-muted-foreground">
                        <ImageIcon className="h-5 w-5" />
                      </div>
                    )}
                    <Input type="file" accept="image/*" disabled={!isEditable || uploadingCover} onChange={(e) => handleUpload(e, "cover")} />
                    {uploadingCover && <Loader2 className="h-4 w-4 animate-spin" />}
                  </div>
                </div>
              </div>

              {isEditable && (
                <Button type="submit" size="lg" disabled={saving} className="w-full md:w-auto">
                  {saving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Upload className="ml-2 h-4 w-4" />}
                  {status === "rejected" ? "إعادة تقديم الطلب" : "إرسال الطلب للمراجعة"}
                </Button>
              )}
              <p className="text-xs text-muted-foreground">
                بإرسال الطلب فإنك توافق على{" "}
                <a href="/terms" className="text-primary hover:underline">الشروط والأحكام</a>
                {" "}و{" "}
                <a href="/privacy" className="text-primary hover:underline">سياسة الخصوصية</a>
              </p>
            </form>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default SellerApplication;
