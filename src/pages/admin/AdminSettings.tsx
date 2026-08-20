import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, AlertTriangle } from "lucide-react";

interface Settings {
  store_name: string;
  support_email: string | null;
  support_phone: string | null;
  maintenance_mode: boolean;
  maintenance_message: string | null;
  min_order_amount: number;
}

const AdminSettings = () => {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("store_name, support_email, support_phone, maintenance_mode, maintenance_message, min_order_amount")
        .eq("id", 1)
        .maybeSingle();
      setSettings((data as Settings) ?? null);
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    if (!settings) return;
    if (!settings.store_name.trim()) {
      toast({ title: "اسم المتجر مطلوب", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("platform_settings")
      .update({
        store_name: settings.store_name.trim(),
        support_email: settings.support_email?.trim() || null,
        support_phone: settings.support_phone?.trim() || null,
        maintenance_mode: settings.maintenance_mode,
        maintenance_message: settings.maintenance_message?.trim() || null,
        min_order_amount: Number(settings.min_order_amount) || 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    setSaving(false);
    if (error) {
      toast({ title: "تعذر الحفظ", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "تم حفظ الإعدادات" });
  };

  return (
    <AdminLayout title="إعدادات النظام" description="بيانات المنصة العامة ووضع الصيانة والحد الأدنى للطلب">
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : !settings ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">لا يمكن قراءة الإعدادات</CardContent></Card>
      ) : (
        <div className="max-w-2xl space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">بيانات المنصة</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="store_name">اسم المتجر</Label>
                <Input id="store_name" value={settings.store_name} maxLength={80}
                  onChange={(e) => setSettings({ ...settings, store_name: e.target.value })} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="support_email">بريد الدعم</Label>
                  <Input id="support_email" type="email" value={settings.support_email ?? ""} maxLength={255}
                    onChange={(e) => setSettings({ ...settings, support_email: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="support_phone">هاتف الدعم</Label>
                  <Input id="support_phone" value={settings.support_phone ?? ""} maxLength={30}
                    onChange={(e) => setSettings({ ...settings, support_phone: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="min_order">الحد الأدنى لقيمة الطلب (ل.س)</Label>
                <Input id="min_order" type="number" min={0} value={settings.min_order_amount}
                  onChange={(e) => setSettings({ ...settings, min_order_amount: Number(e.target.value) || 0 })} />
              </div>
            </CardContent>
          </Card>

          <Card className={settings.maintenance_mode ? "border-warning" : undefined}>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-warning" /> وضع الصيانة
            </CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">إظهار رسالة صيانة للزوار وإيقاف الشراء</span>
                <Switch checked={settings.maintenance_mode}
                  onCheckedChange={(v) => setSettings({ ...settings, maintenance_mode: v })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="maintenance_message">رسالة الصيانة</Label>
                <Textarea id="maintenance_message" rows={3} maxLength={500}
                  value={settings.maintenance_message ?? ""}
                  onChange={(e) => setSettings({ ...settings, maintenance_message: e.target.value })} />
              </div>
            </CardContent>
          </Card>

          <Button onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Save className="me-2 h-4 w-4" />}
            حفظ الإعدادات
          </Button>
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminSettings;
