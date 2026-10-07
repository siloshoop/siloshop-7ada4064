import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import ImageUploadField from "@/components/ImageUploadField";

interface PartnerRow {
  id: string;
  name: string;
  logo_url: string | null;
  website_url: string | null;
  description: string | null;
  sort_order: number;
  is_active: boolean;
}

const emptyForm = { name: "", logo_url: "", website_url: "", description: "", sort_order: 0, is_active: true };

const ManagePartners = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<PartnerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PartnerRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("partners")
      .select("id,name,logo_url,website_url,description,sort_order,is_active")
      .order("sort_order")
      .order("created_at");
    if (error) toast({ title: "تعذر تحميل الشركاء", description: error.message, variant: "destructive" });
    setRows((data as PartnerRow[]) ?? []);
    setLoading(false);
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!form.name.trim()) {
      toast({ title: "اسم الشريك مطلوب", variant: "destructive" });
      return;
    }
    const url = form.website_url.trim();
    if (url && !/^https?:\/\//i.test(url)) {
      toast({ title: "رابط غير صالح", description: "يجب أن يبدأ الرابط بـ https://", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      logo_url: form.logo_url.trim() || null,
      website_url: url || null,
      description: form.description.trim() || null,
      sort_order: Number(form.sort_order) || 0,
      is_active: form.is_active,
      updated_at: new Date().toISOString(),
    };
    const { error } = editing
      ? await supabase.from("partners").update(payload).eq("id", editing.id)
      : await supabase.from("partners").insert(payload);
    setSaving(false);
    if (error) {
      toast({ title: "تعذر الحفظ", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "تم الحفظ" });
    setOpen(false);
    void load();
  };

  const remove = async (row: PartnerRow) => {
    if (!confirm(`حذف الشريك «${row.name}»؟`)) return;
    const { error } = await supabase.from("partners").delete().eq("id", row.id);
    if (error) toast({ title: "تعذر الحذف", description: error.message, variant: "destructive" });
    else void load();
  };

  const toggle = async (row: PartnerRow, v: boolean) => {
    const { error } = await supabase.from("partners").update({ is_active: v }).eq("id", row.id);
    if (error) toast({ title: "تعذر التحديث", description: error.message, variant: "destructive" });
    else void load();
  };

  return (
    <AdminLayout>
      <div className="space-y-4" dir="rtl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">الشركاء</h1>
            <p className="text-sm text-muted-foreground">الشركاء الظاهرون في صفحة «الشركاء»</p>
          </div>
          <Button onClick={() => { setEditing(null); setForm(emptyForm); setOpen(true); }}>
            <Plus className="ml-1 h-4 w-4" /> شريك جديد
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground">لا يوجد شركاء بعد</CardContent></Card>
        ) : (
          <div className="grid gap-3">
            {rows.map((r) => (
              <Card key={r.id}>
                <CardContent className="flex flex-wrap items-center gap-3 p-4">
                  <div className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
                    {r.logo_url ? <img src={r.logo_url} alt={r.name} className="h-full w-full object-contain" /> : <span className="text-xs text-muted-foreground">بلا شعار</span>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold">{r.name}</p>
                      {!r.is_active && <Badge variant="secondary">مخفي</Badge>}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{r.website_url || "بدون رابط"} · الترتيب {r.sort_order}</p>
                  </div>
                  <Switch checked={r.is_active} onCheckedChange={(v) => void toggle(r, v)} aria-label="إظهار" />
                  <Button size="icon" variant="outline" aria-label="تعديل" onClick={() => {
                    setEditing(r);
                    setForm({
                      name: r.name, logo_url: r.logo_url ?? "", website_url: r.website_url ?? "",
                      description: r.description ?? "", sort_order: r.sort_order, is_active: r.is_active,
                    });
                    setOpen(true);
                  }}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="outline" aria-label="حذف" onClick={() => void remove(r)}><Trash2 className="h-4 w-4" /></Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "تعديل الشريك" : "شريك جديد"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="اسم الشريك" />
            <ImageUploadField label="الشعار / الصورة" value={form.logo_url} onChange={(logo_url) => setForm({ ...form, logo_url })} bucket="store-assets" folder="platform/partners" />
            <Input value={form.website_url} onChange={(e) => setForm({ ...form, website_url: e.target.value })} placeholder="رابط الموقع (اختياري) https://" dir="ltr" />
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="وصف قصير (اختياري)" />
            <Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} placeholder="الترتيب" />
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /> ظاهر في الصفحة
            </label>
          </div>
          <DialogFooter>
            <Button onClick={() => void save()} disabled={saving}>{saving && <Loader2 className="ml-1 h-4 w-4 animate-spin" />}حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default ManagePartners;
