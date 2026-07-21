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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SYRIAN_GOVERNORATES } from "@/lib/syrianGovernorates";
import { Loader2, ShieldCheck, Clock, XCircle, PauseCircle, Upload, FileCheck2 } from "lucide-react";

type SellerStatus = "pending" | "approved" | "rejected" | "suspended";

interface Application {
  id: string;
  status: SellerStatus;
  store_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  store_description: string | null;
  address: string | null;
  governorate: string | null;
  identity_document_url: string | null;
  business_document_url: string | null;
  rejection_reason: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
}

const statusMeta: Record<SellerStatus, { label: string; color: string; icon: any; description: string }> = {
  pending: { label: "قيد المراجعة", color: "bg-amber-500", icon: Clock, description: "طلبك قيد المراجعة من قبل الإدارة. سنعلمك بمجرد اتخاذ القرار." },
  approved: { label: "مقبول", color: "bg-emerald-500", icon: ShieldCheck, description: "تمت الموافقة على حسابك. يمكنك الآن الوصول إلى لوحة البائع." },
  rejected: { label: "مرفوض", color: "bg-red-500", icon: XCircle, description: "تم رفض طلبك. يمكنك تعديل بياناتك وإعادة التقديم." },
  suspended: { label: "موقوف", color: "bg-slate-500", icon: PauseCircle, description: "تم إيقاف حسابك مؤقتاً. يرجى التواصل مع الإدارة." },
};

const SellerApplication = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [app, setApp] = useState<Application | null>(null);
  const [saving, setSaving] = useState(false);

  const [storeName, setStoreName] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [governorate, setGovernorate] = useState("");
  const [identityUrl, setIdentityUrl] = useState<string | null>(null);
  const [businessUrl, setBusinessUrl] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState(false);
  const [uploadingBiz, setUploadingBiz] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  const loadApplication = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("seller_applications")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) {
      setApp(data as Application);
      setStoreName(data.store_name ?? "");
      setPhone(data.contact_phone ?? "");
      setDescription(data.store_description ?? "");
      setAddress(data.address ?? "");
      setGovernorate(data.governorate ?? "");
      setIdentityUrl(data.identity_document_url);
      setBusinessUrl(data.business_document_url);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user) loadApplication();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const uploadDoc = async (file: File, kind: "identity" | "business") => {
    if (!user) return null;
    const ext = file.name.split(".").pop() || "bin";
    const path = `${user.id}/${kind}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("seller-documents").upload(path, file, { upsert: true });
    if (error) {
      toast({ title: "فشل رفع الملف", description: error.message, variant: "destructive" });
      return null;
    }
    return path;
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, kind: "identity" | "business") => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast({ title: "حجم الملف كبير", description: "الحد الأقصى 8 ميجابايت", variant: "destructive" });
      return;
    }
    kind === "identity" ? setUploadingId(true) : setUploadingBiz(true);
    const path = await uploadDoc(file, kind);
    if (path) {
      kind === "identity" ? setIdentityUrl(path) : setBusinessUrl(path);
      toast({ title: "تم رفع الملف" });
    }
    kind === "identity" ? setUploadingId(false) : setUploadingBiz(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName.trim() || storeName.trim().length < 2) {
      toast({ title: "اسم المتجر مطلوب", variant: "destructive" }); return;
    }
    if (!phone.trim() || phone.trim().length < 6) {
      toast({ title: "رقم الهاتف مطلوب", variant: "destructive" }); return;
    }
    if (!identityUrl) {
      toast({ title: "وثيقة الهوية مطلوبة", variant: "destructive" }); return;
    }
    setSaving(true);
    const { error } = await supabase.rpc("submit_seller_application", {
      _store_name: storeName,
      _contact_email: user?.email ?? "",
      _contact_phone: phone,
      _store_description: description || null,
      _address: address || null,
      _governorate: governorate || null,
      _identity_document_url: identityUrl,
      _business_document_url: businessUrl,
    });
    setSaving(false);
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "تم إرسال الطلب", description: "سنراجع طلبك ونعلمك بالنتيجة قريباً." });
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
          <h1 className="text-3xl font-bold">طلب حساب البائع</h1>
          <p className="text-muted-foreground mt-2">
            يجب اعتماد حسابك من قبل الإدارة قبل أن تتمكن من إضافة المنتجات والبيع.
          </p>
        </div>

        {meta && StatusIcon && (
          <Card className="mb-6 border-l-4" style={{ borderLeftColor: "hsl(var(--primary))" }}>
            <CardContent className="pt-6 flex items-start gap-4">
              <div className={`rounded-full p-3 text-white ${meta.color}`}>
                <StatusIcon className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-lg">حالة الطلب:</span>
                  <Badge className={meta.color}>{meta.label}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{meta.description}</p>
                {status === "rejected" && app?.rejection_reason && (
                  <Alert className="mt-3 border-red-200 bg-red-50 dark:bg-red-950/20">
                    <AlertTitle>سبب الرفض</AlertTitle>
                    <AlertDescription>{app.rejection_reason}</AlertDescription>
                  </Alert>
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
              {isEditable ? "أكمل البيانات وارفع الوثائق المطلوبة لإرسال الطلب." : "لا يمكن تعديل الطلب في الوضع الحالي."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>اسم المتجر *</Label>
                  <Input value={storeName} onChange={(e) => setStoreName(e.target.value)} disabled={!isEditable} />
                </div>
                <div className="space-y-2">
                  <Label>رقم الهاتف *</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} disabled={!isEditable} placeholder="09XXXXXXXX" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>وصف المتجر</Label>
                <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} disabled={!isEditable} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>المحافظة</Label>
                  <Select value={governorate} onValueChange={setGovernorate} disabled={!isEditable}>
                    <SelectTrigger><SelectValue placeholder="اختر المحافظة" /></SelectTrigger>
                    <SelectContent>
                      {SYRIAN_GOVERNORATES.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>العنوان</Label>
                  <Input value={address} onChange={(e) => setAddress(e.target.value)} disabled={!isEditable} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>وثيقة الهوية (صورة/PDF) *</Label>
                  <div className="flex items-center gap-2">
                    <Input type="file" accept="image/*,application/pdf" disabled={!isEditable || uploadingId}
                      onChange={(e) => handleUpload(e, "identity")} />
                    {uploadingId && <Loader2 className="h-4 w-4 animate-spin" />}
                    {identityUrl && !uploadingId && <FileCheck2 className="h-5 w-5 text-emerald-600" />}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>الوثيقة التجارية (اختياري)</Label>
                  <div className="flex items-center gap-2">
                    <Input type="file" accept="image/*,application/pdf" disabled={!isEditable || uploadingBiz}
                      onChange={(e) => handleUpload(e, "business")} />
                    {uploadingBiz && <Loader2 className="h-4 w-4 animate-spin" />}
                    {businessUrl && !uploadingBiz && <FileCheck2 className="h-5 w-5 text-emerald-600" />}
                  </div>
                </div>
              </div>

              {isEditable && (
                <Button type="submit" size="lg" disabled={saving} className="w-full md:w-auto">
                  {saving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Upload className="ml-2 h-4 w-4" />}
                  {status === "rejected" ? "إعادة تقديم الطلب" : "إرسال الطلب للمراجعة"}
                </Button>
              )}
            </form>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default SellerApplication;