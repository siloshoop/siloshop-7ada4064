import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { logAdminAction } from "@/lib/auditLog";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Plus, Pencil, ArrowUp, ArrowDown, Trash2, X } from "lucide-react";

type InputType = "select" | "text" | "number" | "color";

interface AttributeValueRow {
  id: string;
  attribute_id: string;
  value: string;
  value_ar: string;
  meta: { hex?: string } | null;
  sort_order: number;
}

interface AttributeRow {
  id: string;
  name: string;
  name_ar: string;
  input_type: string;
  unit: string | null;
  sort_order: number;
  is_active: boolean;
  values: AttributeValueRow[];
}

const emptyForm = { name: "", name_ar: "", input_type: "select" as InputType, unit: "" };

const inputTypeLabels: Record<string, string> = {
  select: "قائمة اختيار",
  text: "نص",
  number: "رقم",
  color: "لون",
};

const AdminAttributes = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<AttributeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AttributeRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AttributeRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [valueForms, setValueForms] = useState<Record<string, { value: string; value_ar: string; hex: string }>>({});
  const [addingValueFor, setAddingValueFor] = useState<string | null>(null);
  const [deleteValueTarget, setDeleteValueTarget] = useState<AttributeValueRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: attrs, error }, { data: values, error: valuesError }] = await Promise.all([
      supabase
        .from("product_attributes")
        .select("id, name, name_ar, input_type, unit, sort_order, is_active")
        .order("sort_order", { ascending: true })
        .order("name_ar", { ascending: true }),
      supabase
        .from("product_attribute_values")
        .select("id, attribute_id, value, value_ar, meta, sort_order")
        .order("sort_order", { ascending: true }),
    ]);
    if (error || valuesError) {
      toast({ title: "خطأ", description: (error ?? valuesError)?.message, variant: "destructive" });
    }
    const grouped = (attrs ?? []).map((a) => ({
      ...a,
      values: ((values ?? []) as AttributeValueRow[]).filter((v) => v.attribute_id === a.id),
    })) as AttributeRow[];
    setRows(grouped);
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
      input_type: form.input_type,
      unit: form.unit.trim() || null,
    };
    const { error } = editing
      ? await supabase.from("product_attributes").update(payload).eq("id", editing.id)
      : await supabase.from("product_attributes").insert({ ...payload, sort_order: rows.length });
    setSaving(false);
    if (error) {
      toast({ title: "تعذر الحفظ", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: editing ? "تم تحديث الخاصية" : "تمت إضافة الخاصية" });
    void logAdminAction(editing ? "attribute_updated" : "attribute_created", {
      attribute_id: editing?.id ?? null,
      name_ar: payload.name_ar,
    });
    setOpen(false);
    void load();
  };

  const toggleActive = async (row: AttributeRow) => {
    const { error } = await supabase
      .from("product_attributes")
      .update({ is_active: !row.is_active })
      .eq("id", row.id);
    if (error) {
      toast({ title: "تعذر التحديث", description: error.message, variant: "destructive" });
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, is_active: !r.is_active } : r)));
    void logAdminAction("attribute_visibility_changed", { attribute_id: row.id, is_active: !row.is_active });
  };

  const move = async (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= rows.length || reordering) return;
    setReordering(true);
    const a = rows[index];
    const b = rows[targetIndex];
    const { error } = await supabase.from("product_attributes").update({ sort_order: b.sort_order }).eq("id", a.id);
    const { error: error2 } = error
      ? { error: null }
      : await supabase.from("product_attributes").update({ sort_order: a.sort_order }).eq("id", b.id);
    setReordering(false);
    if (error || error2) {
      toast({ title: "تعذر إعادة الترتيب", variant: "destructive" });
      return;
    }
    void logAdminAction("attribute_reordered", { attribute_id: a.id, from: a.sort_order, to: b.sort_order });
    void load();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from("product_attributes").delete().eq("id", deleteTarget.id);
    setDeleting(false);
    if (error) {
      toast({ title: "تعذر الحذف", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "تم حذف الخاصية" });
    void logAdminAction("attribute_deleted", { attribute_id: deleteTarget.id, name_ar: deleteTarget.name_ar });
    setDeleteTarget(null);
    void load();
  };

  const openEdit = (a: AttributeRow) => {
    setEditing(a);
    setForm({ name: a.name, name_ar: a.name_ar, input_type: a.input_type as InputType, unit: a.unit ?? "" });
    setOpen(true);
  };

  const addValue = async (attribute: AttributeRow) => {
    const draft = valueForms[attribute.id];
    if (!draft || !draft.value_ar.trim() || !draft.value.trim()) {
      toast({ title: "قيمة الخاصية مطلوبة بالعربية والإنجليزية", variant: "destructive" });
      return;
    }
    const meta = attribute.input_type === "color" && draft.hex.trim() ? { hex: draft.hex.trim() } : {};
    const { error } = await supabase.from("product_attribute_values").insert({
      attribute_id: attribute.id,
      value: draft.value.trim(),
      value_ar: draft.value_ar.trim(),
      meta,
      sort_order: attribute.values.length,
    });
    if (error) {
      toast({ title: "تعذر إضافة القيمة", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "تمت إضافة القيمة" });
    void logAdminAction("attribute_value_added", { attribute_id: attribute.id, value_ar: draft.value_ar });
    setValueForms((prev) => ({ ...prev, [attribute.id]: { value: "", value_ar: "", hex: "" } }));
    setAddingValueFor(null);
    void load();
  };

  const confirmDeleteValue = async () => {
    if (!deleteValueTarget) return;
    const { error } = await supabase.from("product_attribute_values").delete().eq("id", deleteValueTarget.id);
    if (error) {
      toast({ title: "تعذر حذف القيمة", description: error.message, variant: "destructive" });
      setDeleteValueTarget(null);
      return;
    }
    toast({ title: "تم حذف القيمة" });
    void logAdminAction("attribute_value_deleted", {
      attribute_id: deleteValueTarget.attribute_id,
      value_ar: deleteValueTarget.value_ar,
    });
    setDeleteValueTarget(null);
    void load();
  };

  return (
    <AdminLayout
      title="خصائص المنتجات"
      description="إدارة الخصائص العالمية للمنتجات مثل اللون والمقاس وقيمها."
      actions={
        <Button onClick={() => { setEditing(null); setForm(emptyForm); setOpen(true); }}>
          <Plus className="me-1 h-4 w-4" /> خاصية جديدة
        </Button>
      }
    >
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="space-y-2 p-4">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">لا توجد خصائص منتجات بعد</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((a, index) => (
            <Card key={a.id}>
              <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
                <div className="min-w-0 flex-1">
                  <CardTitle className="flex items-center gap-2 text-base">
                    {a.name_ar}
                    <span className="text-xs font-normal text-muted-foreground">({a.name})</span>
                  </CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {inputTypeLabels[a.input_type] ?? a.input_type}
                    {a.unit ? ` · الوحدة: ${a.unit}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Badge variant={a.is_active ? "default" : "secondary"}>{a.is_active ? "مفعّلة" : "مخفية"}</Badge>
                  <Switch checked={a.is_active} onCheckedChange={() => toggleActive(a)} aria-label="تفعيل الخاصية" />
                  <div className="flex flex-col">
                    <Button
                      variant="ghost" size="icon" className="h-6 w-6" aria-label="تحريك لأعلى"
                      disabled={index === 0 || reordering} onClick={() => void move(index, -1)}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-6 w-6" aria-label="تحريك لأسفل"
                      disabled={index === rows.length - 1 || reordering} onClick={() => void move(index, 1)}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <Button variant="ghost" size="icon" aria-label="تعديل" onClick={() => openEdit(a)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost" size="icon" aria-label="حذف" className="text-destructive"
                    onClick={() => setDeleteTarget(a)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <div className="flex flex-wrap gap-2">
                  {a.values.length === 0 ? (
                    <span className="text-xs text-muted-foreground">لا توجد قيم لهذه الخاصية بعد</span>
                  ) : (
                    a.values.map((v) => (
                      <Badge key={v.id} variant="outline" className="flex items-center gap-1 py-1 ps-2 pe-1">
                        {a.input_type === "color" && v.meta?.hex && (
                          <span
                            className="h-3 w-3 rounded-full border border-border"
                            style={{ backgroundColor: v.meta.hex }}
                          />
                        )}
                        {v.value_ar}
                        <button
                          type="button"
                          aria-label="حذف القيمة"
                          className="rounded-full p-0.5 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteValueTarget(v)}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))
                  )}
                </div>

                {addingValueFor === a.id ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      className="w-36"
                      placeholder="القيمة بالعربية"
                      value={valueForms[a.id]?.value_ar ?? ""}
                      onChange={(e) =>
                        setValueForms((prev) => ({
                          ...prev,
                          [a.id]: { value: prev[a.id]?.value ?? "", hex: prev[a.id]?.hex ?? "", value_ar: e.target.value },
                        }))
                      }
                    />
                    <Input
                      className="w-36"
                      placeholder="القيمة بالإنجليزية"
                      value={valueForms[a.id]?.value ?? ""}
                      onChange={(e) =>
                        setValueForms((prev) => ({
                          ...prev,
                          [a.id]: { value_ar: prev[a.id]?.value_ar ?? "", hex: prev[a.id]?.hex ?? "", value: e.target.value },
                        }))
                      }
                    />
                    {a.input_type === "color" && (
                      <Input
                        type="color"
                        className="h-9 w-14 p-1"
                        value={valueForms[a.id]?.hex || "#000000"}
                        onChange={(e) =>
                          setValueForms((prev) => ({
                            ...prev,
                            [a.id]: { value: prev[a.id]?.value ?? "", value_ar: prev[a.id]?.value_ar ?? "", hex: e.target.value },
                          }))
                        }
                      />
                    )}
                    <Button size="sm" onClick={() => void addValue(a)}>حفظ</Button>
                    <Button size="sm" variant="outline" onClick={() => setAddingValueFor(null)}>إلغاء</Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setAddingValueFor(a.id);
                      setValueForms((prev) => ({ ...prev, [a.id]: prev[a.id] ?? { value: "", value_ar: "", hex: "" } }));
                    }}
                  >
                    <Plus className="me-1 h-3.5 w-3.5" /> إضافة قيمة
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>{editing ? "تعديل الخاصية" : "خاصية جديدة"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} placeholder="الاسم بالعربية" />
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="الاسم بالإنجليزية" />
            <Select value={form.input_type} onValueChange={(v: InputType) => setForm({ ...form, input_type: v })}>
              <SelectTrigger>
                <SelectValue placeholder="نوع الإدخال" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="select">قائمة اختيار</SelectItem>
                <SelectItem value="text">نص</SelectItem>
                <SelectItem value="number">رقم</SelectItem>
                <SelectItem value="color">لون</SelectItem>
              </SelectContent>
            </Select>
            <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="الوحدة (اختياري، مثل: سم، كغ)" />
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
            <AlertDialogTitle>حذف الخاصية</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف "{deleteTarget?.name_ar}"؟ سيتم حذف كل قيمها المرتبطة. لا يمكن التراجع عن هذا الإجراء.
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

      <AlertDialog open={!!deleteValueTarget} onOpenChange={(v) => !v && setDeleteValueTarget(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف القيمة</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف القيمة "{deleteValueTarget?.value_ar}"؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmDeleteValue()}>حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default AdminAttributes;
