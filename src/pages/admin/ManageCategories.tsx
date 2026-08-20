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

interface CategoryRow {
  id: string;
  name: string;
  name_ar: string;
  description: string | null;
  icon: string | null;
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
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [childCounts, setChildCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: cats, error }, { data: prods }] = await Promise.all([
      supabase
        .from("categories")
        .select(
          "id, name, name_ar, description, icon, slug, image_url, banner_url, seo_title, seo_description, seo_keywords, is_active, sort_order, parent_id",
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
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (row: CategoryRow) => {
    setEditing(row);
    setForm({
      name: row.name,
      name_ar: row.name_ar,
      description: row.description ?? "",
      icon: row.icon ?? "",
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
    if (!form.name_ar.trim() || !form.name.trim()) {
      toast({ title: "الاسم بالعربية والإنجليزية مطلوب", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      name_ar: form.name_ar.trim(),
      description: form.description.trim() || null,
      icon: form.icon.trim() || null,
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
    void load();
  };

  const toggleActive = async (row: CategoryRow) => {
    const { error } = await supabase
      .from("categories")
      .update({ is_active: !row.is_active })
      .eq("id", row.id);
    if (error) {
      toast({ title: "تعذر التحديث", description: error.message, variant: "destructive" });
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, is_active: !r.is_active } : r)));
    void logAdminAction("category_visibility_changed", {
      category_id: row.id,
      is_active: !row.is_active,
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
    void logAdminAction("category_deleted", { category_id: row.id, name_ar: row.name_ar });
    void load();
  };

  const move = async (row: CategoryRow, direction: "up" | "down") => {
    const siblings = rows
      .filter((r) => (r.parent_id ?? null) === (row.parent_id ?? null))
      .sort((a, b) => a.sort_order - b.sort_order || a.name_ar.localeCompare(b.name_ar));
    const idx = siblings.findIndex((r) => r.id === row.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= siblings.length) return;
    const other = siblings[swapIdx];
    const rowOrder = row.sort_order;
    const otherOrder = other.sort_order;
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from("categories").update({ sort_order: otherOrder }).eq("id", row.id),
      supabase.from("categories").update({ sort_order: rowOrder }).eq("id", other.id),
    ]);
    if (e1 || e2) {
      toast({ title: "تعذر إعادة الترتيب", variant: "destructive" });
      return;
    }
    void logAdminAction("category_reordered", { category_id: row.id, direction });
    void load();
  };

  return (
    <AdminLayout
      title="إدارة الفئات"
      description="الفئات الرئيسية للمنصة وعدد المنتجات المرتبطة بكل فئة."
      actions={
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/dashboard/subcategories">
              <FolderTree className="me-1 h-4 w-4" /> الفئات الفرعية
            </Link>
          </Button>
          <Button onClick={openNew}>
            <Plus className="me-1 h-4 w-4" /> فئة جديدة
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
              <CardContent className="flex items-center gap-3 p-4">
                <span className="text-2xl">{c.icon || "📦"}</span>
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
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => move(c, "up")} aria-label="تحريك للأعلى">
                    <ChevronUp className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => move(c, "down")} aria-label="تحريك للأسفل">
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </div>
                <Switch checked={c.is_active} onCheckedChange={() => toggleActive(c)} aria-label="تفعيل الفئة" />
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
                <Label>الاسم بالعربية</Label>
                <Input
                  value={form.name_ar}
                  onChange={(e) => setForm({ ...form, name_ar: e.target.value })}
                  placeholder="الاسم بالعربية"
                />
              </div>
              <div className="space-y-2">
                <Label>الاسم بالإنجليزية</Label>
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
                <Label>أيقونة (إيموجي)</Label>
                <Input
                  value={form.icon}
                  onChange={(e) => setForm({ ...form, icon: e.target.value })}
                  placeholder="أيقونة (إيموجي)"
                />
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
              <div className="space-y-2">
                <Label>رابط الصورة</Label>
                <Input
                  value={form.image_url}
                  onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-2">
                <Label>رابط صورة البانر</Label>
                <Input
                  value={form.banner_url}
                  onChange={(e) => setForm({ ...form, banner_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
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

export default ManageCategories;
