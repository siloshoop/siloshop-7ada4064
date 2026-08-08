import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Wallet } from "lucide-react";

/**
 * Sham Cash account of the platform owner. Platform products are paid with
 * Sham Cash only, and always to this single account. Only super admins can
 * change it (enforced by RLS on platform_payment_settings).
 */
const PlatformShamCashSettings = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    sham_cash_account_name: "",
    sham_cash_account_number: "",
    instructions: "",
    is_active: true,
  });

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("platform_payment_settings")
        .select("sham_cash_account_name, sham_cash_account_number, instructions, is_active")
        .eq("id", 1)
        .maybeSingle();
      if (data) {
        setForm({
          sham_cash_account_name: data.sham_cash_account_name ?? "",
          sham_cash_account_number: data.sham_cash_account_number ?? "",
          instructions: data.instructions ?? "",
          is_active: data.is_active ?? true,
        });
      }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("platform_payment_settings")
      .update(form)
      .eq("id", 1);
    setSaving(false);
    if (error) {
      toast({ title: "فشل الحفظ", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "تم الحفظ", description: "تم تحديث حساب شام كاش للمنصة." });
  };

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Wallet className="h-4 w-4 text-primary" /> حساب شام كاش للمنصة
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              جميع مدفوعات منتجات المنصة تُحوَّل إلى هذا الحساب فقط. البائعون لا يمكنهم ربط شام كاش أو
              تعديل طرق الدفع.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="sham-name">اسم صاحب الحساب</Label>
                <Input
                  id="sham-name"
                  value={form.sham_cash_account_name}
                  onChange={(e) => setForm({ ...form, sham_cash_account_name: e.target.value })}
                  maxLength={120}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sham-number">رقم محفظة شام كاش</Label>
                <Input
                  id="sham-number"
                  dir="ltr"
                  value={form.sham_cash_account_number}
                  onChange={(e) => setForm({ ...form, sham_cash_account_number: e.target.value })}
                  maxLength={60}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sham-instructions">تعليمات الدفع للعميل</Label>
              <Textarea
                id="sham-instructions"
                value={form.instructions}
                onChange={(e) => setForm({ ...form, instructions: e.target.value })}
                maxLength={500}
                rows={3}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">تمكين الدفع عبر شام كاش</p>
                <p className="text-xs text-muted-foreground">يظهر الحساب للعملاء عند إتمام طلب منتجات المنصة</p>
              </div>
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
            </div>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 ml-1 animate-spin" />} حفظ
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default PlatformShamCashSettings;
