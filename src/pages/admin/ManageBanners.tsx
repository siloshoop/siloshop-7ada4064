import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";

interface BannerRow {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  cta_text: string;
  cta_url: string | null;
  sponsor_name: string;
  placement: string;
  priority: number;
  is_active: boolean;
}

const PLACEMENTS = [
  { value: "home", label: "الصفحة الرئيسية" },
  { value: "category", label: "صفحات الفئات" },
  { value: "search", label: "نتائج البحث" },
  { value: "product", label: "صفحة المنتج" },
];

const emptyForm = {
  title: "",
  description: "",
  image_url: "",
  cta_text: "تصفح الآن",
  cta_url: "",
  sponsor_name: "",
  placement: "home",
  priority: 0,
  is_active: true,
};

const ManageBanners = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<BannerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BannerRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("native_ads")
      .select("id, title, description, image_url, cta_text, cta_url, sponsor_name, placement, priority, is_active")
      .order("priority", { ascending: false });
    if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });
    setRows((data ?? []) as BannerRow[]);
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!form.title.trim() || !form.sponsor_name.trim()) {
      toast({ title: "العنوان والجهة الراعية مطلوبان", variant: "destructive" });
      return;
    }
    const url = form.cta_url.trim();
    if (url && !url.startsWith("/")) {
      toast({
        title: "رابط داخلي فقط",
        description: "يجب أن يبدأ الرابط بـ / مثل /category/... أو /product/...",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      image_url: form.image_url.trim() || null,
      cta_text: form.cta_text.trim() || "تصفح الآن",
      cta_url: url || null,
      sponsor_name: form.sponsor_name.trim(),
      placement: form.placement,
      priority: Number(form.priority) || 0,
      is_active: form.is_active,
    };
    const { error } = editing
      ? await supabase.from("native_ads").update(payload).eq("id", editing.id)
      : await supabase.from("native_ads").insert(payload);
    setSaving(false);
    if (error) {
      toast({ title: "تعذر الحفظ", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: editing ? "تم تحديث البانر" : "تمت إضافة البانر" });
    setOpen(false);
    void load();
  };

  const remove = async (row: BannerRow) => {
    const { error } = await supabase.from("native_ads").delete().eq("id", row.id);
    if (error) {
      toast({ title: "تعذر الحذف", description: error.message, variant: "destructive" });
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    toast({ title: "تم حذف البانر" });
  };

  const toggleActive = async (row: BannerRow) => {
    const { error } = await supabase
      .from("native_ads")
      .update({ is_active: !row.is_active })
      .eq("id", row.id);
    if (error) {
      toast({ title: "تعذر التحديث", description: error.message, variant: "destructive" });
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, is_active: !r.is_active } : r)));
  };

  return (
    <AdminLayout
      title="البانرات والإعلانات"
      description="إعلانات ترويجية داخلية فقط — يجب أن تكون الروابط مسارات داخلية في المنصة."
      actions={
        <Button onClick={() => { setEditing(null); setForm(emptyForm); setOpen(true); }}>
          <Plus className="me-1 h-4 w-4" /> بانر جديد
        </Button>
      }
    >
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">لا توجد بانرات</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((b) => (
            <Card key={b.id}>
              <CardContent className="flex flex-wrap items-center gap-4 p-4">
                <img
                  src={b.image_url || "/placeholder.svg"}
                  alt={b.title}
                  loading="lazy"
                  className="h-16 w-24 rounded object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{b.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {b.sponsor_name} · {b.cta_url || "بدون رابط"}
                  </p>
                </div>
                <Badge variant="outline">
                  {PLACEMENTS.find((p) => p.value === b.placement)?.label ?? b.placement}
                </Badge>
                <Badge variant="secondary">أولوية {b.priority}</Badge>
                <Switch checked={b.is_active} onCheckedChange={() => toggleActive(b)} aria-label="تفعيل" />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="تعديل"
                  onClick={() => {
                    setEditing(b);
                    setForm({
                      title: b.title,
                      description: b.description ?? "",
                      image_url: b.image_url ?? "",
                      cta_text: b.cta_text,
                      cta_url: b.cta_url ?? "",
                      sponsor_name: b.sponsor_name,
                      placement: b.placement,
                      priority: b.priority,
                      is_active: b.is_active,
                    });
                    setOpen(true);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" aria-label="حذف" onClick={() => remove(b)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "تعديل البانر" : "بانر جديد"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="العنوان" />
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="الوصف" />
            <Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="رابط الصورة" />
            <Input value={form.sponsor_name} onChange={(e) => setForm({ ...form, sponsor_name: e.target.value })} placeholder="الجهة الراعية" />
            <Input value={form.cta_text} onChange={(e) => setForm({ ...form, cta_text: e.target.value })} placeholder="نص الزر" />
            <Input
              value={form.cta_url}
              onChange={(e) => setForm({ ...form, cta_url: e.target.value })}
              placeholder="مسار داخلي مثل /category/123"
            />
            <Select value={form.placement} onValueChange={(v) => setForm({ ...form, placement: v })}>
              <SelectTrigger><SelectValue placeholder="موضع الظهور" /></SelectTrigger>
              <SelectContent>
                {PLACEMENTS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
              placeholder="الأولوية"
            />
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              مفعّل
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default ManageBanners;