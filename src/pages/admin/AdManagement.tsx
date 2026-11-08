import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Eye, Loader2, MousePointerClick, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { logAdminAction } from "@/lib/auditLog";
import { broadcastActivationChange } from "@/lib/activationSync";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ImageUploadField from "@/components/ImageUploadField";
import { ProductPicker, VendorPicker } from "@/components/admin/ShowroomEntityPicker";
import CarouselSlide from "@/components/home/CarouselSlide";
import { adDates, adState, localAdDate } from "@/lib/adSchedule";
import { CURRENCY_OPTIONS, formatPrice, isKnownCurrency } from "@/lib/currency";
import {
  CAROUSEL_AD_COLUMNS, CAROUSEL_PLACEMENT, DEFAULT_CAROUSEL_SETTINGS, adToSlide, clickThroughRate,
  fetchCarouselSettings, priceFields, validateCarouselAd, validateSlideSeconds,
  type CarouselAdForm, type CarouselAdRow, type CarouselSettings,
} from "@/lib/homeCarousel";

type Stats = Record<string, { impressions: number; clicks: number }>;
type TargetType = "product" | "store" | "custom";
const UUID = "[0-9a-fA-F-]{36}";
const parseTarget = (url: string): { type: TargetType; id: string } => {
  const store = url.match(new RegExp(`^/store/(${UUID})$`));
  if (store) return { type: "store", id: store[1] };
  const product = url.match(new RegExp(`^/product/(${UUID})$`));
  if (product) return { type: "product", id: product[1] };
  return { type: "custom", id: "" };
};

const emptyForm = (priority: number): CarouselAdForm => ({
  title: "", description: "", image_url: "", cta_url: "", price: "", currency: "",
  priority, is_active: false, start_date: "", end_date: "",
});

const AdManagement = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<CarouselAdRow[]>([]);
  const [stats, setStats] = useState<Stats>({});
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState("");
  const [settings, setSettings] = useState<CarouselSettings>(DEFAULT_CAROUSEL_SETTINGS);
  const [seconds, setSeconds] = useState(String(DEFAULT_CAROUSEL_SETTINGS.slide_duration_ms / 1000));
  const [savingSettings, setSavingSettings] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CarouselAdRow | null>(null);
  const [form, setForm] = useState<CarouselAdForm>(emptyForm(1));
  const [targetType, setTargetType] = useState<TargetType>("product");
  const [targetLabel, setTargetLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CarouselAdRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFailure("");
    const [ads, statRows, loadedSettings] = await Promise.all([
      supabase.from("native_ads").select(CAROUSEL_AD_COLUMNS).eq("placement", CAROUSEL_PLACEMENT)
        .order("priority", { ascending: true }).order("created_at", { ascending: true }),
      supabase.rpc("admin_home_carousel_ad_stats"),
      fetchCarouselSettings().catch(() => null),
    ]);
    if (ads.error || statRows.error || !loadedSettings) {
      setFailure("تعذّر تحميل الإعلانات أو إحصاءاتها؛ أعد المحاولة.");
      setLoading(false);
      return;
    }
    setRows((ads.data ?? []) as CarouselAdRow[]);
    setStats(Object.fromEntries((statRows.data ?? []).map((s) => [s.ad_id, { impressions: Number(s.impressions), clicks: Number(s.clicks) }])));
    setSettings(loadedSettings);
    setSeconds(String(loadedSettings.slide_duration_ms / 1000));
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const totals = useMemo(() => Object.values(stats).reduce((t, s) => ({ impressions: t.impressions + s.impressions, clicks: t.clicks + s.clicks }), { impressions: 0, clicks: 0 }), [stats]);

  const saveSettings = async (next: CarouselSettings) => {
    setSavingSettings(true);
    const { error } = await supabase.from("home_carousel_settings").upsert({ id: 1, ...next }, { onConflict: "id" });
    setSavingSettings(false);
    if (error) { toast({ title: "تعذّر حفظ إعدادات العرض", description: error.message, variant: "destructive" }); return false; }
    setSettings(next);
    toast({ title: "تم حفظ إعدادات العرض" });
    void logAdminAction("home_carousel_settings_updated", { ...next });
    void broadcastActivationChange("native_ads", "carousel-settings");
    return true;
  };

  const saveDuration = () => {
    const value = Number(seconds);
    const problem = validateSlideSeconds(value);
    if (problem) { toast({ title: problem, variant: "destructive" }); return; }
    void saveSettings({ ...settings, slide_duration_ms: Math.round(value * 1000) });
  };

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm(rows.reduce((m, r) => Math.max(m, r.priority), 0) + 1));
    setTargetType("product");
    setTargetLabel("");
    setOpen(true);
  };

  const openEdit = (row: CarouselAdRow) => {
    setEditing(row);
    setForm({
      title: row.title, description: row.description ?? "", image_url: row.image_url ?? "", cta_url: row.cta_url ?? "",
      price: row.price == null ? "" : String(row.price), currency: isKnownCurrency(row.currency) ? row.currency : "",
      priority: row.priority, is_active: row.is_active, start_date: localAdDate(row.start_date), end_date: localAdDate(row.end_date),
    });
    setTargetType(row.cta_url ? parseTarget(row.cta_url).type : "product");
    setTargetLabel("");
    setOpen(true);
  };

  const save = async () => {
    const problem = validateCarouselAd(form);
    if (problem) { toast({ title: problem, variant: "destructive" }); return; }
    let dates;
    try { dates = adDates(form.start_date, form.end_date); }
    catch (error) { toast({ title: error instanceof Error ? error.message : "تاريخ غير صالح", variant: "destructive" }); return; }
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      image_url: form.image_url.trim(),
      cta_url: form.cta_url.trim() || null,
      ...priceFields(form),
      priority: form.priority,
      is_active: form.is_active,
      placement: CAROUSEL_PLACEMENT,
      sponsor_name: "SiloShop",
      ...dates,
    };
    setSaving(true);
    const { error } = editing
      ? await supabase.from("native_ads").update(payload).eq("id", editing.id).eq("placement", CAROUSEL_PLACEMENT)
      : await supabase.from("native_ads").insert(payload);
    setSaving(false);
    if (error) { toast({ title: "تعذّر حفظ الإعلان", description: error.message, variant: "destructive" }); return; }
    toast({ title: editing ? "تم تحديث الإعلان" : "تمت إضافة الإعلان", description: form.is_active ? "سيظهر في الرئيسية ضمن موعد عرضه." : "محفوظ كمسودة متوقفة؛ فعّله عند الجاهزية." });
    void logAdminAction(editing ? "home_carousel_ad_updated" : "home_carousel_ad_created", { ad_id: editing?.id ?? null, title: payload.title, is_active: payload.is_active });
    void broadcastActivationChange("native_ads", editing?.id ?? "new");
    setOpen(false);
    void load();
  };

  const toggleActive = async (row: CarouselAdRow) => {
    setBusyId(row.id);
    const { data, error } = await supabase.from("native_ads").update({ is_active: !row.is_active })
      .eq("id", row.id).eq("placement", CAROUSEL_PLACEMENT).select("id,is_active").single();
    setBusyId(null);
    if (error) { toast({ title: "تعذّر تغيير الحالة", description: error.message, variant: "destructive" }); return; }
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, is_active: data.is_active } : r)));
    toast({ title: data.is_active ? "تم تفعيل الإعلان" : "تم إيقاف الإعلان" });
    void logAdminAction("home_carousel_ad_visibility_changed", { ad_id: row.id, is_active: data.is_active });
    void broadcastActivationChange("native_ads", row.id);
  };

  const move = async (row: CarouselAdRow, delta: -1 | 1) => {
    const ordered = [...rows];
    const from = ordered.findIndex((r) => r.id === row.id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= ordered.length) return;
    [ordered[from], ordered[to]] = [ordered[to], ordered[from]];
    const changes = ordered.map((r, i) => ({ row: r, priority: i + 1 })).filter((c) => c.row.priority !== c.priority);
    setBusyId(row.id);
    const results = await Promise.all(changes.map((c) => supabase.from("native_ads").update({ priority: c.priority }).eq("id", c.row.id).eq("placement", CAROUSEL_PLACEMENT)));
    setBusyId(null);
    const failed = results.find((r) => r.error);
    if (failed?.error) toast({ title: "تعذّر تغيير الترتيب", description: failed.error.message, variant: "destructive" });
    else void broadcastActivationChange("native_ads", row.id);
    void load();
  };

  const remove = async (row: CarouselAdRow) => {
    const { error } = await supabase.from("native_ads").delete().eq("id", row.id).eq("placement", CAROUSEL_PLACEMENT);
    if (error) { toast({ title: "تعذّر حذف الإعلان", description: error.message, variant: "destructive" }); return; }
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    setDeleteTarget(null);
    toast({ title: "تم حذف الإعلان" });
    void logAdminAction("home_carousel_ad_deleted", { ad_id: row.id, title: row.title });
    void broadcastActivationChange("native_ads", row.id);
  };

  const target = parseTarget(form.cta_url.trim());
  const previewSlide = adToSlide({
    id: editing?.id ?? "preview", title: form.title.trim() || "عنوان الإعلان", description: form.description.trim() || null,
    image_url: form.image_url || null, cta_url: null, ...priceFields(form),
  });
  const previewState = adState({ is_active: form.is_active, start_date: form.start_date ? new Date(form.start_date).toISOString() : null, end_date: form.end_date ? new Date(form.end_date).toISOString() : null });

  return (
    <AdminLayout
      title="إدارة الإعلانات"
      description="إعلانات شريط العرض المتحرك في الصفحة الرئيسية — يديرها مالك المنصة فقط."
      actions={<Button onClick={openNew}><Plus className="me-1 h-4 w-4" /> إعلان جديد</Button>}
    >
      {failure ? (
        <div role="alert" className="space-y-3 py-8"><p>{failure}</p><Button onClick={() => void load()}>إعادة المحاولة</Button></div>
      ) : loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">إعدادات العرض</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap items-end gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={settings.autoplay} disabled={savingSettings} aria-label="التشغيل التلقائي"
                  onCheckedChange={(autoplay) => void saveSettings({ ...settings, autoplay })} />
                التشغيل التلقائي
              </label>
              <div className="space-y-1">
                <Label htmlFor="slide-seconds">مدة كل شريحة (ثانية)</Label>
                <div className="flex gap-2">
                  <Input id="slide-seconds" type="number" min={2} max={20} step={0.5} value={seconds} className="w-24"
                    onChange={(e) => setSeconds(e.target.value)} />
                  <Button variant="outline" disabled={savingSettings} onClick={saveDuration}>حفظ المدة</Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                إجمالي المشاهدات {totals.impressions.toLocaleString("ar-SY")} · النقرات {totals.clicks.toLocaleString("ar-SY")} · نسبة النقر {clickThroughRate(totals.impressions, totals.clicks)}
              </p>
            </CardContent>
          </Card>

          {rows.length === 0 ? (
            <Card><CardContent className="space-y-2 p-10 text-center text-muted-foreground">
              <p>لا توجد إعلانات بعد.</p>
              <p className="text-xs">إلى أن تضيف إعلانًا مفعّلًا، يعرض الشريط المنتجات الأكثر مبيعًا كما هو الآن.</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-3">
              {rows.map((ad, i) => {
                const s = stats[ad.id] ?? { impressions: 0, clicks: 0 };
                return (
                  <Card key={ad.id}>
                    <CardContent className="flex flex-wrap items-center gap-3 p-4">
                      <div className="flex flex-col gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="تقديم في الترتيب" disabled={i === 0 || busyId === ad.id} onClick={() => void move(ad, -1)}><ArrowUp className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="تأخير في الترتيب" disabled={i === rows.length - 1 || busyId === ad.id} onClick={() => void move(ad, 1)}><ArrowDown className="h-4 w-4" /></Button>
                      </div>
                      <img src={ad.image_url || "/placeholder.svg"} alt={ad.title} loading="lazy" className="h-16 w-16 rounded-lg bg-muted object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{ad.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {ad.price != null ? formatPrice(ad.price, ad.currency) : "بدون سعر"} · {ad.cta_url || "بدون رابط"}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {ad.start_date ? `يبدأ ${new Date(ad.start_date).toLocaleString("ar-SY")}` : "يبدأ فورًا"}
                          {ad.end_date ? ` · ينتهي ${new Date(ad.end_date).toLocaleString("ar-SY")}` : " · بلا تاريخ انتهاء"}
                        </p>
                      </div>
                      <Badge variant="secondary">الترتيب {ad.priority}</Badge>
                      <Badge variant="outline">{adState(ad)}</Badge>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground" title="المشاهدات"><Eye className="h-3.5 w-3.5" />{s.impressions.toLocaleString("ar-SY")}</span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground" title="النقرات"><MousePointerClick className="h-3.5 w-3.5" />{s.clicks.toLocaleString("ar-SY")} ({clickThroughRate(s.impressions, s.clicks)})</span>
                      <Switch checked={ad.is_active} disabled={busyId === ad.id} onCheckedChange={() => void toggleActive(ad)} aria-label={`تفعيل ${ad.title}`} />
                      <Button variant="ghost" size="icon" aria-label={`تعديل ${ad.title}`} onClick={() => openEdit(ad)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" aria-label={`حذف ${ad.title}`} onClick={() => setDeleteTarget(ad)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      <Dialog open={!!deleteTarget} onOpenChange={(value) => !value && setDeleteTarget(null)}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>حذف الإعلان «{deleteTarget?.title}»؟</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">سيختفي من الصفحة الرئيسية فورًا. لإخفائه مؤقتًا استخدم زر الإيقاف بدل الحذف.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>إلغاء</Button>
            <Button variant="destructive" onClick={() => deleteTarget && void remove(deleteTarget)}>تأكيد الحذف</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader><DialogTitle>{editing ? "تعديل الإعلان" : "إعلان جديد"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <section aria-label="معاينة الإعلان" className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">معاينة كما سيظهر في الرئيسية · الحالة: {previewState}</p>
              <div className="overflow-hidden rounded-xl border bg-card"><CarouselSlide slide={previewSlide} preview /></div>
            </section>
            <div className="space-y-1"><Label htmlFor="ad-title">العنوان</Label>
              <Input id="ad-title" value={form.title} maxLength={120} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="space-y-1"><Label htmlFor="ad-description">الوصف (اختياري)</Label>
              <Textarea id="ad-description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <ImageUploadField label="صورة الإعلان" value={form.image_url} onChange={(image_url) => setForm((f) => ({ ...f, image_url }))}
              bucket="product-images" folder="platform/banners" onBusyChange={setImageBusy} />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label htmlFor="ad-price">السعر (اختياري)</Label>
                <Input id="ad-price" type="number" min={0} inputMode="decimal" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
              <div className="space-y-1"><Label>العملة</Label>
                <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v as CarouselAdForm["currency"] })}>
                  <SelectTrigger aria-label="العملة"><SelectValue placeholder="اختر العملة" /></SelectTrigger>
                  <SelectContent>{CURRENCY_OPTIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select></div>
            </div>
            <div className="space-y-1"><Label>وجهة الإعلان</Label>
              <Select value={targetType} onValueChange={(v) => { setTargetType(v as TargetType); setTargetLabel(""); setForm({ ...form, cta_url: "" }); }}>
                <SelectTrigger aria-label="وجهة الإعلان"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="product">منتج</SelectItem>
                  <SelectItem value="store">متجر</SelectItem>
                  <SelectItem value="custom">رابط داخلي آخر</SelectItem>
                </SelectContent>
              </Select></div>
            {targetType === "product" && (
              <ProductPicker purpose="ad" selectedId={target.type === "product" ? target.id : ""} selectedLabel={targetLabel || undefined}
                onSelect={(p) => {
                  setTargetLabel(p.name);
                  setForm((f) => ({
                    ...f, cta_url: `/product/${p.product_id}`,
                    title: f.title || p.name,
                    image_url: f.image_url || p.image_url || "",
                    ...(f.price ? {} : { price: String(p.discount_price ?? p.price), currency: isKnownCurrency(p.currency) ? p.currency : f.currency }),
                  }));
                }}
                onClear={() => { setTargetLabel(""); setForm((f) => ({ ...f, cta_url: "" })); }} />
            )}
            {targetType === "store" && (
              <VendorPicker purpose="ad" selectedId={target.type === "store" ? target.id : ""} selectedLabel={targetLabel || undefined}
                onSelect={(v) => { setTargetLabel(v.name); setForm((f) => ({ ...f, cta_url: `/store/${v.vendor_id}` })); }}
                onClear={() => { setTargetLabel(""); setForm((f) => ({ ...f, cta_url: "" })); }} />
            )}
            {targetType === "custom" && (
              <Input value={form.cta_url} onChange={(e) => setForm({ ...form, cta_url: e.target.value })} placeholder="مسار داخلي مثل /category/..." aria-label="رابط الوجهة" dir="ltr" />
            )}
            <div className="space-y-1"><Label htmlFor="ad-order">ترتيب العرض (1 يظهر أولًا)</Label>
              <Input id="ad-order" type="number" min={0} step={1} value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} /></div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm"><span>تاريخ البدء (اختياري)</span>
                <Input type="datetime-local" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></label>
              <label className="space-y-1 text-sm"><span>تاريخ الانتهاء (اختياري)</span>
                <Input type="datetime-local" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></label>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              منشور (عند الإيقاف يُحفظ كمسودة لا تظهر للزوار)
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button onClick={() => void save()} disabled={saving || imageBusy}>
              {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {form.is_active ? "حفظ ونشر" : "حفظ كمسودة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdManagement;
