import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Plus, Pencil, FolderTree, ChevronUp, ChevronDown, Trash2 } from "lucide-react";
import ImageUploadField from "@/components/ImageUploadField";
import { CATEGORY_ICONS, CATEGORY_TONES, categoryAppearance } from "@/lib/categoryAppearance";
import { useQueryClient } from "@tanstack/react-query";
import { broadcastActivationChange } from "@/lib/activationSync";

interface CategoryRow {
  id: string;
  name: string;
  name_ar: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  slug: string | null;
  image_url: string | null;
  banner_url: string | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string | null;
  is_active: boolean;
  sort_order: number;
  parent_id: string | null;
}

const emptyForm = {
  name: "",
  name_ar: "",
  description: "",
  icon: "",
  color: "",
  slug: "",
  image_url: "",
  banner_url: "",
  seo_title: "",
  seo_description: "",
  seo_keywords: "",
  is_active: true,
  sort_order: 0,
  parent_id: "" as string,
};

const slugify = (text: string) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const ManageCategories = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [imageBusy, setImageBusy] = useState(false);
  const [bannerBusy, setBannerBusy] = useState(false);
  const [reordering, setReordering] = useState(false);
  const sync = (id: string) => {
    void queryClient.invalidateQueries({ queryKey: ["public-navigation", "categories"] });
    window.dispatchEvent(new Event("activation-changed"));
    void broadcastActivationChange("categories", id);
  };
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [childCounts, setChildCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: cats, error }, { data: prods }] = await Promise.all([
      supabase
        .from("categories")
        .select(
          "id, name, name_ar, description, icon, color, slug, image_url, banner_url, seo_title, seo_description, seo_keywords, is_active, sort_order, parent_id",
        )
        .order("sort_order", { ascending: true })
        .order("name_ar", { ascending: true }),
      supabase.from("products").select("category_id").eq("is_active", true).limit(5000),
    ]);
    if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });
    const list = (cats ?? []) as CategoryRow[];
    setRows(list);
    const map: Record<string, number> = {};
    (prods ?? []).forEach((p: { category_id: string | null }) => {
      if (p.category_id) map[p.category_id] = (map[p.category_id] ?? 0) + 1;
    });
    setCounts(map);
    const cmap: Record<string, number> = {};
    list.forEach((c) => {
      if (c.parent_id) cmap[c.parent_id] = (cmap[c.parent_id] ?? 0) + 1;
    });
    setChildCounts(cmap);
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  // Build nested tree ordered: root categories followed by their descendants, indented
  const orderedRows = useMemo(() => {
    const byParent: Record<string, CategoryRow[]> = {};
    rows.forEach((r) => {
      const key = r.parent_id ?? "root";
      if (!byParent[key]) byParent[key] = [];
      byParent[key].push(r);
    });
    const result: { row: CategoryRow; depth: number }[] = [];
    const walk = (parentKey: string, depth: number) => {
      (byParent[parentKey] ?? []).forEach((row) => {
        result.push({ row, depth });
        walk(row.id, depth + 1);
      });
    };
    walk("root", 0);
    return result;
  }, [rows]);

  const getDescendantIds = useCallback(
    (id: string): Set<string> => {
      const set = new Set<string>();
      const collect = (parentId: string) => {
        rows.forEach((r) => {
          if (r.parent_id === parentId && !set.has(r.id)) {
            set.add(r.id);
            collect(r.id);
          }
        });
      };
      collect(id);
      return set;
    },
    [rows],
  );

  const parentOptions = useMemo(() => {
    if (!editing) return rows;
    const excluded = getDescendantIds(editing.id);
    excluded.add(editing.id);
    return rows.filter((r) => !excluded.has(r.id));
  }, [rows, editing, getDescendantIds]);

  const openNew = () => {
    setEditing(null);
    setForm({ ...emptyForm, sort_order: Math.max(-1, ...rows.map((row) => row.sort_order)) + 1 });
    setOpen(true);
  };

  const openEdit = (row: CategoryRow) => {
    setEditing(row);
    setForm({
      name: row.name,
      name_ar: row.name_ar,
      description: row.description ?? "",
      icon: row.icon ?? "",
      color: row.color ?? "",
      slug: row.slug ?? "",
      image_url: row.image_url ?? "",
      banner_url: row.banner_url ?? "",
      seo_title: row.seo_title ?? "",
      seo_description: row.seo_description ?? "",
      seo_keywords: row.seo_keywords ?? "",
      is_active: row.is_active,
      sort_order: row.sort_order,
      parent_id: row.parent_id ?? "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (saving || imageBusy || bannerBusy) return;
    if (!form.name_ar.trim()) {
      toast({ title: "الاسم بالعربية مطلوب", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim() || form.name_ar.trim(),
      name_ar: form.name_ar.trim(),
      description: form.description.trim() || null,
      icon: form.icon.trim() || null,
      color: form.color || null,
      slug: (form.slug.trim() || slugify(form.name)) || null,
      image_url: form.image_url.trim() || null,
      banner_url: form.banner_url.trim() || null,
      seo_title: form.seo_title.trim() || null,
      seo_description: form.seo_description.trim() || null,
      seo_keywords: form.seo_keywords.trim() || null,
      is_active: form.is_active,
      sort_order: Number(form.sort_order) || 0,
      parent_id: form.parent_id || null,
    };
    const { error } = editing
      ? await supabase.from("categories").update(payload).eq("id", editing.id)
      : await supabase.from("categories").insert(payload);
    setSaving(false);
    if (error) {
      toast({ title: "تعذر الحفظ", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: editing ? "تم تحديث الفئة" : "تمت إضافة الفئة" });
    void logAdminAction(editing ? "category_updated" : "category_created", {
      category_id: editing?.id ?? null,
      name_ar: payload.name_ar,
    });
    setOpen(false);
    sync(editing?.id ?? "new");
    void load();
  };

  const toggleActive = async (row: CategoryRow) => {
    const next = !row.is_active;
    setTogglingId(row.id);
    const { data, error } = await supabase
      .from("categories")
      .update({ is_active: next })
      .eq("id", row.id)
      .select("id,is_active")
      .single();
    setTogglingId(null);
    if (error) {
      toast({ title: "تعذر التحديث", description: error.message, variant: "destructive" });
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, is_active: data.is_active } : r)));
    toast({ title: data.is_active ? "تم تفعيل الفئة" : "تم إخفاء الفئة" });
    sync(row.id);
    void logAdminAction("category_visibility_changed", {
      category_id: row.id,
      is_active: data.is_active,
    });
  };

  const remove = async (row: CategoryRow) => {
    const productCount = counts[row.id] ?? 0;
    const childCount = childCounts[row.id] ?? 0;
    if (productCount > 0 || childCount > 0) {
      toast({
        title: "لا يمكن حذف الفئة",
        description: "لا يمكن حذف فئة مرتبطة بمنتجات أو تحتوي على فئات فرعية. قم بإخفائها بدلاً من ذلك.",
        variant: "destructive",
      });
      return;
    }
    if (!confirm(`هل أنت متأكد من حذف "${row.name_ar}"؟`)) return;
    const { error } = await supabase.from("categories").delete().eq("id", row.id);
    if (error) {
      toast({ title: "تعذر الحذف", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "تم حذف الفئة" });
    sync(row.id);
    void logAdminAction("category_deleted", { category_id: row.id, name_ar: row.name_ar });
    void load();
  };

  const move = async (row: CategoryRow, direction: "up" | "down") => {
    if (reordering) return;
    setReordering(true);
    const { error } = await supabase.rpc("reorder_category", { p_category_id: row.id, p_direction: direction });
    setReordering(false);
    if (error) {
      toast({ title: "تعذر إعادة الترتيب", variant: "destructive" });
      return;
    }
    sync(row.id);
    void logAdminAction("category_reordered", { category_id: row.id, direction });
    void load();
  };

  return (
    <AdminLayout
      title="إدارة الفئات"
      description="الفئات الرئيسية للمنصة وعدد المنتجات المرتبطة بكل فئة."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to="/admin/subcategories">
              <FolderTree className="me-1 h-4 w-4" /> الفئات الفرعية
            </Link>
          </Button>
          <Button onClick={openNew}>
            <Plus className="me-1 h-4 w-4" /> إضافة فئة جديدة
          </Button>
        </div>
      }
    >
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-3">
          {orderedRows.map(({ row: c, depth }) => (
            <Card key={c.id} style={{ marginInlineStart: depth * 24 }}>
              <CardContent className="flex flex-wrap items-center gap-3 p-4">
                <span className={`category-tone-${categoryAppearance(c).tone} flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full`}>{(() => { const { Icon, emoji } = categoryAppearance(c); return c.image_url ? <img src={c.image_url} alt="" className="h-full w-full object-cover" /> : emoji || <Icon className="h-5 w-5" />; })()}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{c.name_ar}</p>
                  <p className="truncate text-xs text-muted-foreground">{c.name}</p>
                </div>
                <Badge variant="secondary">{counts[c.id] ?? 0} منتج</Badge>
                <Badge variant="outline">{childCounts[c.id] ?? 0} فرعي</Badge>
                <Badge variant={c.is_active ? "default" : "secondary"}>
                  {c.is_active ? "مفعّلة" : "مخفية"}
                </Badge>
                <div className="flex flex-col">
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => move(c, "up")} disabled={reordering} aria-label="تحريك للأعلى">
                    <ChevronUp className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => move(c, "down")} disabled={reordering} aria-label="تحريك للأسفل">
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </div>
                <Switch checked={c.is_active} onCheckedChange={() => toggleActive(c)} disabled={togglingId === c.id} aria-label="تفعيل الفئة" />
                <Button variant="ghost" size="icon" onClick={() => openEdit(c)} aria-label="تعديل">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => remove(c)} aria-label="حذف">
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
            <DialogTitle>{editing ? "تعديل الفئة" : "فئة جديدة"}</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="basic" dir="rtl">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic">أساسي</TabsTrigger>
              <TabsTrigger value="media">الوسائط</TabsTrigger>
              <TabsTrigger value="seo">SEO</TabsTrigger>
              <TabsTrigger value="status">الحالة</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="category-name-ar">الاسم بالعربية</Label>
                <Input
                  id="category-name-ar"
                  value={form.name_ar}
                  onChange={(e) => setForm({ ...form, name_ar: e.target.value })}
                  placeholder="الاسم بالعربية"
                />
              </div>
              <div className="space-y-2">
                <Label>الاسم بالإنجليزية (اختياري)</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="الاسم بالإنجليزية"
                />
              </div>
              <div className="space-y-2">
                <Label>الرابط المختصر (slug)</Label>
                <Input
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  placeholder={form.name ? slugify(form.name) : "يُنشأ تلقائيًا من الاسم الإنجليزي"}
                />
              </div>
              <div className="space-y-2">
                <Label>الأيقونة</Label>
                <div className="flex flex-wrap gap-1" role="group" aria-label="اختيار الأيقونة">
                  {Object.entries(CATEGORY_ICONS).map(([name, Icon]) => <Button key={name} title={name} aria-label={name} size="icon" variant={form.icon === name ? "default" : "outline"} onClick={() => setForm({ ...form, icon: name })}><Icon className="h-5 w-5" /></Button>)}
                </div>
                <Input aria-label="أيقونة مخصصة" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="أيقونة مخصصة (اختياري)" />
              </div>
              <div className="space-y-2">
                <Label>اللون</Label>
                <div className="flex flex-wrap gap-2" role="group" aria-label="اختيار اللون">
                  {CATEGORY_TONES.map((tone) => <Button key={tone} title={tone} aria-label={tone} aria-pressed={form.color === tone} size="icon" variant="outline" className={form.color === tone ? "ring-2 ring-primary" : ""} onClick={() => setForm({ ...form, color: tone })}><span className={`category-tone-${tone} h-7 w-7 rounded-full`} /></Button>)}
                </div>
              </div>
              <div className="space-y-2">
                <Label>الفئة الأم</Label>
                <Select
                  value={form.parent_id || "none"}
                  onValueChange={(v) => setForm({ ...form, parent_id: v === "none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="بدون (فئة رئيسية)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">بدون (فئة رئيسية)</SelectItem>
                    {parentOptions.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name_ar}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>الوصف</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="وصف مختصر (اختياري)"
                />
              </div>
            </TabsContent>

            <TabsContent value="media" className="space-y-3">
              <ImageUploadField
                onBusyChange={setImageBusy}
                disabled={saving}
                label="صورة الفئة"
                value={form.image_url}
                onChange={(image_url) => setForm({ ...form, image_url })}
                bucket="product-images"
                folder="platform/categories"
              />
              <ImageUploadField
                onBusyChange={setBannerBusy}
                disabled={saving}
                label="صورة بانر الفئة"
                value={form.banner_url}
                onChange={(banner_url) => setForm({ ...form, banner_url })}
                bucket="product-images"
                folder="platform/categories"
              />
            </TabsContent>

            <TabsContent value="seo" className="space-y-3">
              <div className="space-y-2">
                <Label>عنوان SEO</Label>
                <Input
                  value={form.seo_title}
                  onChange={(e) => setForm({ ...form, seo_title: e.target.value })}
                  placeholder="عنوان الصفحة لمحركات البحث"
                />
              </div>
              <div className="space-y-2">
                <Label>وصف SEO</Label>
                <Textarea
                  value={form.seo_description}
                  onChange={(e) => setForm({ ...form, seo_description: e.target.value })}
                  placeholder="وصف الصفحة لمحركات البحث"
                />
              </div>
              <div className="space-y-2">
                <Label>الكلمات المفتاحية</Label>
                <Input
                  value={form.seo_keywords}
                  onChange={(e) => setForm({ ...form, seo_keywords: e.target.value })}
                  placeholder="كلمات مفصولة بفواصل"
                />
              </div>
            </TabsContent>

            <TabsContent value="status" className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>مفعّلة</Label>
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm({ ...form, is_active: v })}
                />
              </div>
              <div className="space-y-2">
                <Label>ترتيب العرض</Label>
                <Input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) || 0 })}
                />
              </div>
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button onClick={save} disabled={saving || imageBusy || bannerBusy}>
              {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default ManageCategories;
