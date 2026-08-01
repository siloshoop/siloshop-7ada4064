import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Pencil, Pin, PinOff, Eye, GripVertical, Sparkles } from "lucide-react";
import { useShowroomAdmin, getShowroomStatus, type ShowroomItem } from "@/hooks/useShowroom";
import PremiumShowroom from "@/components/PremiumShowroom";

const emptyForm = {
  item_type: "store",
  title: "",
  subtitle: "",
  cover_image_url: "",
  logo_url: "",
  rating: "",
  is_verified: false,
  badge_label: "",
  vendor_id: "",
  product_id: "",
  link_url: "",
  campaign_type: "editorial",
  sponsor_name: "",
  start_date: "",
  end_date: "",
  is_active: true,
};

const statusMeta: Record<string, { label: string; className: string }> = {
  active: { label: "نشط", className: "bg-success text-success-foreground" },
  scheduled: { label: "مجدول", className: "bg-primary text-primary-foreground" },
  expired: { label: "منتهي", className: "bg-muted text-muted-foreground" },
  disabled: { label: "معطّل", className: "bg-destructive text-destructive-foreground" },
};

const ShowroomManagement = () => {
  const { items, setItems, loading, refresh } = useShowroomAdmin();
  const { toast } = useToast();
  const [form, setForm] = useState({ ...emptyForm });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const openNew = () => {
    setForm({ ...emptyForm });
    setEditingId(null);
    setOpen(true);
  };

  const openEdit = (item: ShowroomItem) => {
    setForm({
      item_type: item.item_type,
      title: item.title,
      subtitle: item.subtitle ?? "",
      cover_image_url: item.cover_image_url ?? "",
      logo_url: item.logo_url ?? "",
      rating: item.rating != null ? String(item.rating) : "",
      is_verified: item.is_verified,
      badge_label: item.badge_label ?? "",
      vendor_id: item.vendor_id ?? "",
      product_id: item.product_id ?? "",
      link_url: item.link_url ?? "",
      campaign_type: item.campaign_type,
      sponsor_name: item.sponsor_name ?? "",
      start_date: item.start_date ? item.start_date.slice(0, 16) : "",
      end_date: item.end_date ? item.end_date.slice(0, 16) : "",
      is_active: item.is_active,
    });
    setEditingId(item.id);
    setOpen(true);
  };

  const save = async () => {
    if (!form.title.trim()) {
      toast({ title: "العنوان مطلوب", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      item_type: form.item_type,
      title: form.title.trim(),
      subtitle: form.subtitle.trim() || null,
      cover_image_url: form.cover_image_url.trim() || null,
      logo_url: form.logo_url.trim() || null,
      rating: form.rating ? Number(form.rating) : null,
      is_verified: form.is_verified,
      badge_label: form.badge_label.trim() || null,
      vendor_id: form.vendor_id.trim() || null,
      product_id: form.product_id.trim() || null,
      link_url: form.link_url.trim() || null,
      campaign_type: form.campaign_type,
      sponsor_name: form.sponsor_name.trim() || null,
      start_date: form.start_date ? new Date(form.start_date).toISOString() : null,
      end_date: form.end_date ? new Date(form.end_date).toISOString() : null,
      is_active: form.is_active,
      display_order: editingId ? undefined : items.length,
    };
    const { error } = editingId
      ? await supabase.from("showroom_items").update(payload).eq("id", editingId)
      : await supabase.from("showroom_items").insert(payload as never);
    setSaving(false);
    if (error) {
      toast({ title: "تعذّر الحفظ", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: editingId ? "تم تحديث العنصر" : "تمت إضافة العنصر" });
    setOpen(false);
    refresh();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("showroom_items").delete().eq("id", id);
    if (error) {
      toast({ title: "تعذّر الحذف", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "تم حذف العنصر" });
    refresh();
  };

  const toggleField = async (item: ShowroomItem, field: "is_active" | "is_pinned") => {
    const value = !item[field];
    const { error } = await supabase.from("showroom_items").update({ [field]: value }).eq("id", item.id);
    if (error) {
      toast({ title: "تعذّر التحديث", description: error.message, variant: "destructive" });
      return;
    }
    refresh();
  };

  const persistOrder = async (ordered: ShowroomItem[]) => {
    await Promise.all(
      ordered.map((it, i) =>
        supabase.from("showroom_items").update({ display_order: i }).eq("id", it.id)
      )
    );
    refresh();
  };

  const onDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const list = [...items];
    const from = list.findIndex((i) => i.id === dragId);
    const to = list.findIndex((i) => i.id === targetId);
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    setItems(list);
    setDragId(null);
    persistOrder(list);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="container flex-1 px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Sparkles className="h-6 w-6 text-primary" />
              إدارة المعرض المميز
            </h1>
            <p className="text-sm text-muted-foreground">
              يتحكم المدير العام فقط بالمتاجر والمنتجات المعروضة في الصفحة الرئيسية.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={() => setPreviewOpen(true)}>
              <Eye className="h-4 w-4" /> معاينة
            </Button>
            <Button className="gap-2" onClick={openNew}>
              <Plus className="h-4 w-4" /> إضافة عنصر
            </Button>
          </div>
        </div>

        {items.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              لا توجد عناصر في المعرض بعد. أضف متجرًا أو منتجًا مميزًا للبدء.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const status = getShowroomStatus(item);
              return (
                <Card
                  key={item.id}
                  draggable
                  onDragStart={() => setDragId(item.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => onDrop(item.id)}
                  className={dragId === item.id ? "opacity-60" : ""}
                >
                  <CardContent className="flex flex-wrap items-center gap-3 p-3">
                    <GripVertical className="h-5 w-5 shrink-0 cursor-grab text-muted-foreground" />
                    <div className="h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {item.cover_image_url && (
                        <img src={item.cover_image_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                      )}
                    </div>
                    <div className="min-w-[160px] flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{item.title}</span>
                        {item.is_pinned && <Pin className="h-3.5 w-3.5 text-primary" />}
                      </div>
                      <p className="line-clamp-1 text-xs text-muted-foreground">{item.subtitle}</p>
                    </div>
                    <Badge variant="secondary">{item.item_type === "store" ? "متجر" : "منتج"}</Badge>
                    <Badge className={statusMeta[status].className}>{statusMeta[status].label}</Badge>
                    <div className="flex items-center gap-1">
                      <Switch checked={item.is_active} onCheckedChange={() => toggleField(item, "is_active")} />
                      <Button variant="ghost" size="icon" title="تثبيت في المقدمة" onClick={() => toggleField(item, "is_pinned")}>
                        {item.is_pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(item.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingId ? "تعديل عنصر المعرض" : "إضافة عنصر للمعرض"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>النوع</Label>
                  <Select value={form.item_type} onValueChange={(v) => set("item_type", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="store">متجر مميز</SelectItem>
                      <SelectItem value="product">منتج مميز</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>نوع الحملة</Label>
                  <Select value={form.campaign_type} onValueChange={(v) => set("campaign_type", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="editorial">اختيار المنصة</SelectItem>
                      <SelectItem value="paid">مدفوع</SelectItem>
                      <SelectItem value="sponsored">حملة برعاية</SelectItem>
                      <SelectItem value="seasonal">عرض موسمي</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>العنوان</Label>
                <Input value={form.title} onChange={(e) => set("title", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>وصف قصير</Label>
                <Textarea rows={2} value={form.subtitle} onChange={(e) => set("subtitle", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>رابط صورة الغلاف</Label>
                <Input dir="ltr" value={form.cover_image_url} onChange={(e) => set("cover_image_url", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>رابط الشعار</Label>
                <Input dir="ltr" value={form.logo_url} onChange={(e) => set("logo_url", e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>التقييم</Label>
                  <Input type="number" step="0.1" min="0" max="5" value={form.rating} onChange={(e) => set("rating", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>شارة مميزة</Label>
                  <Input value={form.badge_label} onChange={(e) => set("badge_label", e.target.value)} placeholder="مثال: الأكثر مبيعًا" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>معرّف البائع</Label>
                  <Input dir="ltr" value={form.vendor_id} onChange={(e) => set("vendor_id", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>معرّف المنتج</Label>
                  <Input dir="ltr" value={form.product_id} onChange={(e) => set("product_id", e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>مسار داخلي مخصص (اختياري)</Label>
                <Input dir="ltr" value={form.link_url} onChange={(e) => set("link_url", e.target.value)} placeholder="/category/..." />
              </div>
              <div className="space-y-2">
                <Label>اسم الراعي (اختياري)</Label>
                <Input value={form.sponsor_name} onChange={(e) => set("sponsor_name", e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>تاريخ البدء</Label>
                  <Input type="datetime-local" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>تاريخ الانتهاء</Label>
                  <Input type="datetime-local" value={form.end_date} onChange={(e) => set("end_date", e.target.value)} />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label>شارة التوثيق</Label>
                <Switch checked={form.is_verified} onCheckedChange={(v) => set("is_verified", v)} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label>مفعّل</Label>
                <Switch checked={form.is_active} onCheckedChange={(v) => set("is_active", v)} />
              </div>
              <Button className="w-full" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "حفظ"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>معاينة المعرض قبل النشر</DialogTitle>
            </DialogHeader>
            <PremiumShowroom showEmptyState />
          </DialogContent>
        </Dialog>
      </main>
      <Footer />
    </div>
  );
};

export default ShowroomManagement;
