import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { logAdminAction } from "@/lib/auditLog";
import { SYRIAN_GOVERNORATES } from "@/lib/syrianGovernorates";
import { Loader2, Plus, Save, Trash2, MapPin } from "lucide-react";

interface Center {
  id: string;
  governorate: string;
  city: string;
  name: string;
  address: string;
  phone: string | null;
  working_hours: string | null;
  is_active: boolean;
  sort_order: number;
}

const ALL = "__all__";

const emptyForm = {
  governorate: SYRIAN_GOVERNORATES[0] as string,
  city: "",
  name: "",
  address: "",
  phone: "",
  working_hours: "",
  sort_order: 0,
};

const PickupCenters = () => {
  const { toast } = useToast();
  const [centers, setCenters] = useState<Center[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<string>(ALL);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("pickup_centers")
      .select("*")
      .order("governorate", { ascending: true })
      .order("sort_order", { ascending: true });
    if (error) {
      toast({ title: "تعذر تحميل مراكز الاستلام", variant: "destructive" });
    }
    setCenters((data ?? []) as Center[]);
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(
    () => (filter === ALL ? centers : centers.filter((c) => c.governorate === filter)),
    [centers, filter],
  );

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const submit = async () => {
    if (!form.city.trim() || !form.name.trim() || !form.address.trim()) {
      toast({ title: "المحافظة والمدينة والاسم والعنوان مطلوبة", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      governorate: form.governorate,
      city: form.city.trim(),
      name: form.name.trim(),
      address: form.address.trim(),
      phone: form.phone.trim() || null,
      working_hours: form.working_hours.trim() || null,
      sort_order: Number(form.sort_order) || 0,
    };

    const { error } = editingId
      ? await supabase.from("pickup_centers").update(payload).eq("id", editingId)
      : await supabase.from("pickup_centers").insert(payload);

    setSaving(false);
    if (error) {
      toast({ title: "تعذر الحفظ", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: editingId ? "تم تحديث المركز" : "تم إضافة المركز" });
    void logAdminAction(editingId ? "pickup_center_updated" : "pickup_center_created", payload);
    resetForm();
    void load();
  };

  const toggleActive = async (center: Center) => {
    const { error } = await supabase
      .from("pickup_centers")
      .update({ is_active: !center.is_active })
      .eq("id", center.id);
    if (error) {
      toast({ title: "تعذر التحديث", variant: "destructive" });
      return;
    }
    void logAdminAction("pickup_center_toggled", { id: center.id, is_active: !center.is_active });
    void load();
  };

  const remove = async (center: Center) => {
    const { error } = await supabase.from("pickup_centers").delete().eq("id", center.id);
    if (error) {
      toast({ title: "تعذر الحذف", description: error.message, variant: "destructive" });
      return;
    }
    void logAdminAction("pickup_center_deleted", { id: center.id, name: center.name });
    void load();
  };

  const startEdit = (center: Center) => {
    setEditingId(center.id);
    setForm({
      governorate: center.governorate,
      city: center.city,
      name: center.name,
      address: center.address,
      phone: center.phone ?? "",
      working_hours: center.working_hours ?? "",
      sort_order: center.sort_order,
    });
  };

  return (
    <AdminLayout
      title="مراكز الاستلام"
      description="التوصيل داخل سوريا يتم عبر مراكز الاستلام فقط. أضف مركزاً لكل محافظة ومدينة وفعّله أو عطّله."
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4" /> {editingId ? "تعديل مركز" : "مركز جديد"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>المحافظة *</Label>
              <Select
                value={form.governorate}
                onValueChange={(v) => setForm({ ...form, governorate: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SYRIAN_GOVERNORATES.map((g) => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>المدينة / المنطقة *</Label>
              <Input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="مثال: حي الأربعين"
              />
            </div>
            <div className="space-y-1.5">
              <Label>اسم المركز *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="مثال: مركز سيلو شوب - الأربعين"
              />
            </div>
            <div className="space-y-1.5">
              <Label>عنوان المركز *</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="الشارع وأقرب علامة مميزة"
              />
            </div>
            <div className="space-y-1.5">
              <Label>رقم الهاتف</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                dir="ltr"
                placeholder="09xxxxxxxx"
              />
            </div>
            <div className="space-y-1.5">
              <Label>أوقات العمل</Label>
              <Input
                value={form.working_hours}
                onChange={(e) => setForm({ ...form, working_hours: e.target.value })}
                placeholder="مثال: السبت - الخميس 9 صباحاً - 6 مساءً"
              />
            </div>
            <div className="space-y-1.5">
              <Label>ترتيب العرض</Label>
              <Input
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={submit} disabled={saving} className="flex-1">
                {saving ? (
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                ) : editingId ? (
                  <Save className="me-2 h-4 w-4" />
                ) : (
                  <Plus className="me-2 h-4 w-4" />
                )}
                {editingId ? "حفظ التعديلات" : "إضافة"}
              </Button>
              {editingId && (
                <Button variant="outline" onClick={resetForm}>إلغاء</Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle className="text-base">المراكز ({visible.length})</CardTitle>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>كل المحافظات</SelectItem>
                {SYRIAN_GOVERNORATES.map((g) => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : visible.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                لا توجد مراكز استلام بعد
              </p>
            ) : (
              visible.map((c) => (
                <div key={c.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold">{c.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.governorate} · {c.city}
                      </p>
                      <p className="mt-1 text-sm">{c.address}</p>
                      {c.phone && (
                        <p className="text-xs text-muted-foreground" dir="ltr">{c.phone}</p>
                      )}
                      {c.working_hours && (
                        <p className="text-xs text-muted-foreground">{c.working_hours}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={c.is_active ? "default" : "secondary"} className="text-[10px]">
                        {c.is_active ? "مفعّل" : "معطّل"}
                      </Badge>
                      <Switch
                        checked={c.is_active}
                        onCheckedChange={() => toggleActive(c)}
                        aria-label="تفعيل / تعطيل"
                      />
                      <Button size="sm" variant="outline" onClick={() => startEdit(c)}>
                        تعديل
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => remove(c)}
                        aria-label="حذف"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default PickupCenters;
