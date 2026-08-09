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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Plus, Pencil } from "lucide-react";

interface BrandRow {
  id: string;
  name: string;
  name_ar: string;
  logo_url: string | null;
  description: string | null;
  is_active: boolean;
}

const emptyForm = { name: "", name_ar: "", logo_url: "", description: "", is_active: true };

const ManageBrands = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<BrandRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BrandRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("brands")
      .select("id, name, name_ar, logo_url, description, is_active")
      .order("name_ar");
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
      logo_url: form.logo_url.trim() || null,
      description: form.description.trim() || null,
      is_active: form.is_active,
    };
    const { error } = editing
      ? await supabase.from("brands").update(payload).eq("id", editing.id)
      : await supabase.from("brands").insert(payload);
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
          {rows.map((b) => (
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
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="تعديل"
                  onClick={() => {
                    setEditing(b);
                    setForm({
                      name: b.name,
                      name_ar: b.name_ar,
                      logo_url: b.logo_url ?? "",
                      description: b.description ?? "",
                      is_active: b.is_active,
                    });
                    setOpen(true);
                  }}
                >
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
            <DialogTitle>{editing ? "تعديل العلامة" : "علامة جديدة"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} placeholder="الاسم بالعربية" />
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="الاسم بالإنجليزية" />
            <Input value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} placeholder="رابط الشعار" />
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="وصف (اختياري)" />
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              مفعّلة
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

export default ManageBrands;