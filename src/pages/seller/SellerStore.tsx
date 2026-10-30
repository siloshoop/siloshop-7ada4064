import { useCallback, useEffect, useRef, useState } from "react";
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
import ImageUploadField from "@/components/ImageUploadField";
import { Link } from "react-router-dom";
import { EMPTY_STORE, storeSettingsSchema, storeSettingsArgs, type StoreSettings } from "@/lib/storeSettings";
import ShippingProvinceFields from "@/components/seller/ShippingProvinceFields";
import DeleteStoreCard from "@/components/seller/DeleteStoreCard";
import { validProvince, type ShippingRegions } from "@/lib/shippingRegions";
import { useQueryClient } from "@tanstack/react-query";

const SellerStore = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState<StoreSettings>(EMPTY_STORE);
  const [regions, setRegions] = useState<ShippingRegions>({ shipping_all_provinces: true, shipping_provinces: [] });
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [logoBusy, setLogoBusy] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const readVersion = useRef(0);

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
    if (!user) { setLoading(false); return; }
    const version = ++readVersion.current;
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase.from("seller_applications")
        .select("store_name,store_description,contact_email,contact_phone,address,city,logo_url,cover_image_url,working_hours,return_policy,shipping_policy,business_info,shipping_all_provinces,shipping_provinces")
        .eq("user_id", user.id).eq("status", "approved")
        .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(1).maybeSingle();
      if (version !== readVersion.current) return;
      if (error) throw error;
      if (!data) throw new Error("لا يوجد متجر معتمد لهذا الحساب");
      setForm(Object.fromEntries(Object.keys(EMPTY_STORE).map((key) => [key, data[key as keyof typeof data] ?? ""])) as StoreSettings);
      setRegions({ shipping_all_provinces: data.shipping_all_provinces ?? true, shipping_provinces: data.shipping_provinces ?? [] });
    } catch (error) {
      if (version === readVersion.current) setLoadError(error instanceof Error ? error.message : "تعذّر تحميل بيانات المتجر");
    } finally { if (version === readVersion.current) setLoading(false); }
  }, [user]);

  useEffect(() => {
    void load();
    return () => { readVersion.current += 1; };
  }, [load]);

  const set = (key: keyof StoreSettings) => (ev: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [key]: ev.target.value }));
    setErrors([]);
  };

  const save = async () => {
    if (saving || logoBusy || coverBusy || loading || loadError || !user) return;
    const parsed = storeSettingsSchema.safeParse(form);
    if ((!regions.shipping_all_provinces && !regions.shipping_provinces.length) || regions.shipping_provinces.some((p) => !validProvince(p))) {
      setErrors(["اختر محافظة سورية واحدة على الأقل"]);
      toast({ title: "تحقق من محافظات الشحن", description: "اختر محافظة سورية واحدة على الأقل", variant: "destructive" });
      return;
    }
    if (!parsed.success) {
      setErrors(parsed.error.issues.map((issue) => issue.message));
      toast({ title: "تحقق من بيانات المتجر", description: parsed.error.issues[0]?.message, variant: "destructive" });
      return;
    }
    setErrors([]);
    setSaving(true);
    try {
      const { error } = await supabase.rpc("seller_update_store_settings", {
        _profile: storeSettingsArgs(parsed.data),
        _all_provinces: regions.shipping_all_provinces,
        _provinces: regions.shipping_all_provinces ? [] : regions.shipping_provinces,
      });
      if (error) throw error;
      toast({ title: "تم حفظ بيانات المتجر" });
      await queryClient.invalidateQueries({ queryKey: ["vendor-shipping-regions"] });
      await load();
    } catch (error) {
      toast({ title: "تعذّر حفظ بيانات المتجر", description: error instanceof Error ? error.message : "حاول مجددًا", variant: "destructive" });
    } finally { setSaving(false); }
  };

  if (loading) {
    return (
      <SellerLayout title="متجري" description="إعدادات المتجر">
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-32 w-full" />)}</div>
      </SellerLayout>
    );
  }

  if (loadError) return <SellerLayout title="متجري"><div role="alert" className="space-y-3"><p className="text-destructive">{loadError}</p><Button variant="outline" onClick={() => void load()}>إعادة المحاولة</Button></div></SellerLayout>;

  return (
    <SellerLayout
      title="متجري"
      description="إعدادات المتجر"
      actions={
        <div className="flex flex-wrap gap-2">
        {user && <Button asChild variant="outline"><Link to={`/store/${user.id}`}>عرض المتجر</Link></Button>}
        <Button onClick={save} disabled={saving || logoBusy || coverBusy}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="me-2 h-4 w-4" /> حفظ</>}
        </Button>
        </div>
      }
    >
      <fieldset disabled={saving} className="min-w-0 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><Store className="h-4 w-4 text-primary" /> الهوية</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="store_name">اسم المتجر</Label>
              <Input maxLength={150} id="store_name" value={form.store_name ?? ""} onChange={set("store_name")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="store_description">وصف المتجر</Label>
              <Textarea maxLength={5000} id="store_description" rows={4} value={form.store_description ?? ""} onChange={set("store_description")} />
            </div>
            {user && (
              <div className="grid gap-3 sm:grid-cols-2">
                <ImageUploadField
                  label="شعار المتجر"
                  value={form.logo_url ?? ""}
                  onChange={(logo_url) => setForm((current) => ({ ...current, logo_url }))}
                  bucket="store-assets"
                  folder={user.id}
                  privateBucket
                  previewClassName="sm:w-24"
                  sizeGuide="logo"
                  disabled={saving}
                  onBusyChange={setLogoBusy}
                />
                <ImageUploadField
                  label="غلاف المتجر"
                  value={form.cover_image_url ?? ""}
                  onChange={(cover_image_url) => setForm((current) => ({ ...current, cover_image_url }))}
                  bucket="store-assets"
                  folder={user.id}
                  privateBucket
                  sizeGuide="cover"
                  disabled={saving}
                  onBusyChange={setCoverBusy}
                />
              </div>
            )}
            {(logoPreview || coverPreview) && (
              <div className="flex items-center gap-3">
                {logoPreview && <img loading="lazy" decoding="async" src={logoPreview} alt="شعار المتجر" className="h-12 w-12 rounded-md object-cover" />}
                {coverPreview && <img loading="lazy" decoding="async" src={coverPreview} alt="غلاف المتجر" className="h-12 flex-1 rounded-md object-cover" />}
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
                <Input maxLength={255} id="contact_email" type="email" dir="ltr" value={form.contact_email ?? ""} onChange={set("contact_email")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contact_phone">الهاتف</Label>
                <Input id="contact_phone" type="tel" maxLength={30} dir="ltr" value={form.contact_phone ?? ""} onChange={set("contact_phone")} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="city">المدينة</Label>
                <Input maxLength={100} id="city" value={form.city ?? ""} onChange={set("city")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="working_hours">ساعات العمل</Label>
                <Input maxLength={500} id="working_hours" value={form.working_hours ?? ""} onChange={set("working_hours")} placeholder="السبت - الخميس ٩ص - ٦م" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="address">العنوان</Label>
              <Textarea maxLength={1000} id="address" rows={2} value={form.address ?? ""} onChange={set("address")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="business_info">معلومات النشاط التجاري</Label>
              <Textarea maxLength={3000} id="business_info" rows={2} value={form.business_info ?? ""} onChange={set("business_info")} />
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-3"><CardTitle className="text-base">السياسات</CardTitle></CardHeader>
          <CardContent className="grid gap-3 lg:grid-cols-2">
            <div className="lg:col-span-2"><ShippingProvinceFields value={regions} onChange={(value) => { setRegions(value); setErrors([]); }} /></div>
            <div className="space-y-1.5">
              <Label htmlFor="shipping_policy">سياسة الشحن</Label>
              <Textarea maxLength={5000} id="shipping_policy" rows={5} value={form.shipping_policy ?? ""} onChange={set("shipping_policy")} />
            </div>
          </CardContent>
        </Card>
      </fieldset>
      {errors.length > 0 && <ul role="alert" className="mt-3 space-y-1 text-sm text-destructive">{errors.map((message, i) => <li key={i}>{message}</li>)}</ul>}
      <DeleteStoreCard />
    </SellerLayout>
  );
};

export default SellerStore;
