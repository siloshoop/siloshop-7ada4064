import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import SellerLayout from "@/components/seller/SellerLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Save, Store } from "lucide-react";
import { resolveStoreAssetUrl } from "@/lib/storeAssets";

interface StoreProfile {
  store_name: string | null;
  store_description: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  city: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  working_hours: string | null;
  return_policy: string | null;
  shipping_policy: string | null;
  business_info: string | null;
}

const EMPTY: StoreProfile = {
  store_name: "", store_description: "", contact_email: "", contact_phone: "", address: "", city: "",
  logo_url: "", cover_image_url: "", working_hours: "", return_policy: "", shipping_policy: "", business_info: "",
};

const SellerStore = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState<StoreProfile>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [l, c] = await Promise.all([
        resolveStoreAssetUrl(form.logo_url),
        resolveStoreAssetUrl(form.cover_image_url),
      ]);
      if (cancelled) return;
      setLogoPreview(l);
      setCoverPreview(c);
    })();
    return () => {
      cancelled = true;
    };
  }, [form.logo_url, form.cover_image_url]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("seller_applications")
      .select("store_name,store_description,contact_email,contact_phone,address,city,logo_url,cover_image_url,working_hours,return_policy,shipping_policy,business_info")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) setForm({ ...EMPTY, ...(data as StoreProfile) });
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const set = (key: keyof StoreProfile) => (ev: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: ev.target.value }));

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.rpc("seller_update_store_profile", {
      _store_name: form.store_name || null,
      _store_description: form.store_description || null,
      _contact_email: form.contact_email || null,
      _contact_phone: form.contact_phone || null,
      _address: form.address || null,
      _city: form.city || null,
      _logo_url: form.logo_url || null,
      _cover_image_url: form.cover_image_url || null,
      _working_hours: form.working_hours || null,
      _return_policy: form.return_policy || null,
      _shipping_policy: form.shipping_policy || null,
      _business_info: form.business_info || null,
    });
    setSaving(false);
    if (error) {
      toast({ title: "تعذّر حفظ بيانات المتجر", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "تم حفظ بيانات المتجر" });
    void load();
  };

  if (loading) {
    return (
      <SellerLayout title="ملف المتجر" description="بيانات متجرك العامة وسياساته">
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-32 w-full" />)}</div>
      </SellerLayout>
    );
  }

  return (
    <SellerLayout
      title="ملف المتجر"
      description="بيانات متجرك العامة وسياساته"
      actions={
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="me-2 h-4 w-4" /> حفظ</>}
        </Button>
      }
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><Store className="h-4 w-4 text-primary" /> الهوية</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="store_name">اسم المتجر</Label>
              <Input id="store_name" value={form.store_name ?? ""} onChange={set("store_name")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="store_description">وصف المتجر</Label>
              <Textarea id="store_description" rows={4} value={form.store_description ?? ""} onChange={set("store_description")} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="logo_url">رابط الشعار</Label>
                <Input id="logo_url" value={form.logo_url ?? ""} onChange={set("logo_url")} dir="ltr" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cover_image_url">رابط الغلاف</Label>
                <Input id="cover_image_url" value={form.cover_image_url ?? ""} onChange={set("cover_image_url")} dir="ltr" />
              </div>
            </div>
            {(form.logo_url || form.cover_image_url) && (
              <div className="flex items-center gap-3">
                {form.logo_url && <img src={form.logo_url} alt="شعار المتجر" className="h-12 w-12 rounded-md object-cover" />}
                {form.cover_image_url && <img src={form.cover_image_url} alt="غلاف المتجر" className="h-12 flex-1 rounded-md object-cover" />}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">التواصل والعنوان</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="contact_email">البريد الإلكتروني</Label>
                <Input id="contact_email" type="email" dir="ltr" value={form.contact_email ?? ""} onChange={set("contact_email")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contact_phone">الهاتف</Label>
                <Input id="contact_phone" dir="ltr" value={form.contact_phone ?? ""} onChange={set("contact_phone")} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="city">المدينة</Label>
                <Input id="city" value={form.city ?? ""} onChange={set("city")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="working_hours">ساعات العمل</Label>
                <Input id="working_hours" value={form.working_hours ?? ""} onChange={set("working_hours")} placeholder="السبت - الخميس ٩ص - ٦م" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="address">العنوان</Label>
              <Textarea id="address" rows={2} value={form.address ?? ""} onChange={set("address")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="business_info">معلومات النشاط التجاري</Label>
              <Textarea id="business_info" rows={2} value={form.business_info ?? ""} onChange={set("business_info")} />
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-3"><CardTitle className="text-base">السياسات</CardTitle></CardHeader>
          <CardContent className="grid gap-3 lg:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="shipping_policy">سياسة الشحن</Label>
              <Textarea id="shipping_policy" rows={5} value={form.shipping_policy ?? ""} onChange={set("shipping_policy")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="return_policy">سياسة الإرجاع</Label>
              <Textarea id="return_policy" rows={5} value={form.return_policy ?? ""} onChange={set("return_policy")} />
            </div>
          </CardContent>
        </Card>
      </div>
    </SellerLayout>
  );
};

export default SellerStore;
