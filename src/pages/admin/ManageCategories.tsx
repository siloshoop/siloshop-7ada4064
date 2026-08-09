import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Plus, Pencil, FolderTree } from "lucide-react";

interface CategoryRow {
  id: string;
  name: string;
  name_ar: string;
  description: string | null;
  icon: string | null;
}

const emptyForm = { name: "", name_ar: "", description: "", icon: "" };

const ManageCategories = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: cats, error }, { data: prods }] = await Promise.all([
      supabase.from("categories").select("id, name, name_ar, description, icon").order("name_ar"),
      supabase.from("products").select("category_id").eq("is_active", true).limit(5000),
    ]);
    if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });
    setRows((cats ?? []) as CategoryRow[]);
    const map: Record<string, number> = {};
    (prods ?? []).forEach((p: { category_id: string | null }) => {
      if (p.category_id) map[p.category_id] = (map[p.category_id] ?? 0) + 1;
    });
    setCounts(map);
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

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
    setOpen(false);
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
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((c) => (
            <Card key={c.id}>
              <CardContent className="flex items-center gap-3 p-4">
                <span className="text-2xl">{c.icon || "📦"}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{c.name_ar}</p>
                  <p className="truncate text-xs text-muted-foreground">{c.name}</p>
                </div>
                <Badge variant="secondary">{counts[c.id] ?? 0} منتج</Badge>
                <Button variant="ghost" size="icon" onClick={() => openEdit(c)} aria-label="تعديل">
                  <Pencil className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>{editing ? "تعديل الفئة" : "فئة جديدة"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={form.name_ar}
              onChange={(e) => setForm({ ...form, name_ar: e.target.value })}
              placeholder="الاسم بالعربية"
            />
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="الاسم بالإنجليزية"
            />
            <Input
              value={form.icon}
              onChange={(e) => setForm({ ...form, icon: e.target.value })}
              placeholder="أيقونة (إيموجي)"
            />
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="وصف مختصر (اختياري)"
            />
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

export default ManageCategories;