import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { logAdminAction } from "@/lib/auditLog";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Plus, Pencil, ArrowUp, ArrowDown, Trash2 } from "lucide-react";

interface BrandRow {
  id: string;
  name: string;
  name_ar: string;
  slug: string | null;
  logo_url: string | null;
  banner_url: string | null;
  website_url: string | null;
  description: string | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string | null;
  sort_order: number;
  is_active: boolean;
}

const emptyForm = {
  name: "",
  name_ar: "",
  slug: "",
  logo_url: "",
  banner_url: "",
  website_url: "",
  description: "",
  seo_title: "",
  seo_description: "",
  seo_keywords: "",
  is_active: true,
};

const ManageBrands = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<BrandRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BrandRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BrandRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("brands")
      .select(
        "id, name, name_ar, slug, logo_url, banner_url, website_url, description, seo_title, seo_description, seo_keywords, sort_order, is_active",
      )
      .order("sort_order", { ascending: true })
      .order("name_ar", { ascending: true });
    if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });
    setRows((data ?? []) as BrandRow[]);
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!form.name_ar.trim() || !form.name.trim()) {
      toast({ title: "الاسم بالعربية والإنجليزية مطلوب", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      name_ar: form.name_ar.trim(),
      slug: form.slug.trim() || null,
      logo_url: form.logo_url.trim() || null,
      banner_url: form.banner_url.trim() || null,
      website_url: form.website_url.trim() || null,
      description: form.description.trim() || null,
      seo_title: form.seo_title.trim() || null,
      seo_description: form.seo_description.trim() || null,
      seo_keywords: form.seo_keywords.trim() || null,
      is_active: form.is_active,
    };
    const { error } = editing
      ? await supabase.from("brands").update(payload).eq("id", editing.id)
      : await supabase.from("brands").insert({ ...payload, sort_order: rows.length });
    setSaving(false);
    if (error) {
      toast({ title: "تعذر الحفظ", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: editing ? "تم تحديث العلامة" : "تمت إضافة العلامة" });
    void logAdminAction(editing ? "brand_updated" : "brand_created", {
      brand_id: editing?.id ?? null,
      name_ar: payload.name_ar,
    });
    setOpen(false);
    void load();
  };

  const toggleActive = async (row: BrandRow) => {
    const { error } = await supabase
      .from("brands")
      .update({ is_active: !row.is_active })
      .eq("id", row.id);
    if (error) {
      toast({ title: "تعذر التحديث", description: error.message, variant: "destructive" });
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, is_active: !r.is_active } : r)));
    void logAdminAction("brand_visibility_changed", {
      brand_id: row.id,
      is_active: !row.is_active,
    });
  };

  const move = async (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= rows.length || reordering) return;
    setReordering(true);
    const a = rows[index];
    const b = rows[targetIndex];
    const { error } = await supabase.from("brands").update({ sort_order: b.sort_order }).eq("id", a.id);
    const { error: error2 } = error
      ? { error: null }
      : await supabase.from("brands").update({ sort_order: a.sort_order }).eq("id", b.id);
    setReordering(false);
    if (error || error2) {
      toast({ title: "تعذر إعادة الترتيب", variant: "destructive" });
      return;
    }
    void logAdminAction("brand_reordered", { brand_id: a.id, from: a.sort_order, to: b.sort_order });
    void load();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { count } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", deleteTarget.id);
    if (count && count > 0) {
      setDeleting(false);
      toast({
        title: "لا يمكن الحذف",
        description: "توجد منتجات مرتبطة بهذه العلامة التجارية، يرجى إزالتها أولاً.",
        variant: "destructive",
      });
      setDeleteTarget(null);
      return;
    }
    const { error } = await supabase.from("brands").delete().eq("id", deleteTarget.id);
    setDeleting(false);
    if (error) {
      toast({ title: "تعذر الحذف", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "تم حذف العلامة" });
    void logAdminAction("brand_deleted", { brand_id: deleteTarget.id, name_ar: deleteTarget.name_ar });
    setDeleteTarget(null);
    void load();
  };

  const openEdit = (b: BrandRow) => {
    setEditing(b);
    setForm({
      name: b.name,
      name_ar: b.name_ar,
      slug: b.slug ?? "",
      logo_url: b.logo_url ?? "",
      banner_url: b.banner_url ?? "",
      website_url: b.website_url ?? "",
      description: b.description ?? "",
      seo_title: b.seo_title ?? "",
      seo_description: b.seo_description ?? "",
      seo_keywords: b.seo_keywords ?? "",
      is_active: b.is_active,
    });
    setOpen(true);
  };

  return (
    <AdminLayout
      title="العلامات التجارية"
      description="إضافة وتعديل الماركات المتاحة للبائعين وتفعيلها أو إخفاؤها."
      actions={
        <Button onClick={() => { setEditing(null); setForm(emptyForm); setOpen(true); }}>
          <Plus className="me-1 h-4 w-4" /> علامة جديدة
        </Button>
      }
    >
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">لا توجد علامات تجارية</CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((b, index) => (
            <Card key={b.id}>
              <CardContent className="flex items-center gap-3 p-4">
                <img
                  src={b.logo_url || "/placeholder.svg"}
                  alt={b.name_ar}
                  loading="lazy"
                  className="h-12 w-12 rounded object-contain"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{b.name_ar}</p>
                  <p className="truncate text-xs text-muted-foreground">{b.name}</p>
                </div>
                <Badge variant={b.is_active ? "default" : "secondary"}>
                  {b.is_active ? "مفعّلة" : "مخفية"}
                </Badge>
                <Switch
                  checked={b.is_active}
                  onCheckedChange={() => toggleActive(b)}
                  aria-label="تفعيل العلامة"
                />
                <div className="flex flex-col">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    aria-label="تحريك لأعلى"
                    disabled={index === 0 || reordering}
                    onClick={() => void move(index, -1)}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    aria-label="تحريك لأسفل"
                    disabled={index === rows.length - 1 || reordering}
                    onClick={() => void move(index, 1)}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Button variant="ghost" size="icon" aria-label="تعديل" onClick={() => openEdit(b)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="حذف"
                  className="text-destructive"
                  onClick={() => setDeleteTarget(b)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "تعديل العلامة" : "علامة جديدة"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground">البيانات الأساسية</h4>
              <Input value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} placeholder="الاسم بالعربية" />
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="الاسم بالإنجليزية" />
              <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="الرابط المختصر (slug)" />
              <Input value={form.website_url} onChange={(e) => setForm({ ...form, website_url: e.target.value })} placeholder="رابط الموقع الإلكتروني" />
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="وصف (اختياري)" />
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground">الوسائط</h4>
              <Input value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} placeholder="رابط الشعار" />
              <Input value={form.banner_url} onChange={(e) => setForm({ ...form, banner_url: e.target.value })} placeholder="رابط البانر" />
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground">تحسين محركات البحث (SEO)</h4>
              <Input value={form.seo_title} onChange={(e) => setForm({ ...form, seo_title: e.target.value })} placeholder="عنوان SEO" />
              <Textarea value={form.seo_description} onChange={(e) => setForm({ ...form, seo_description: e.target.value })} placeholder="وصف SEO" />
              <Input value={form.seo_keywords} onChange={(e) => setForm({ ...form, seo_keywords: e.target.value })} placeholder="كلمات مفتاحية (مفصولة بفواصل)" />
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground">الحالة</h4>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                مفعّلة
              </label>
            </div>
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

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف العلامة التجارية</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف "{deleteTarget?.name_ar}"؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmDelete()} disabled={deleting}>
              {deleting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default ManageBrands;
