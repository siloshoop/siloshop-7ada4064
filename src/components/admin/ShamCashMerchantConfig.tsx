import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Wallet, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

/**
 * Non-secret Sham Cash merchant settings. API Key / Secret Key / Token are NEVER
 * stored here — they live as backend secrets and are only read inside edge
 * functions (sham-cash-initiate, sham-cash-webhook).
 */
const ShamCashMerchantConfig = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    merchant_id: "",
    environment: "sandbox",
    api_base_url: "",
    callback_url: "",
    is_active: false,
  });

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("sham_cash_merchant_config")
        .select("merchant_id, environment, api_base_url, callback_url, is_active")
        .eq("id", 1)
        .maybeSingle();
      if (data) {
        setForm({
          merchant_id: data.merchant_id ?? "",
          environment: data.environment ?? "sandbox",
          api_base_url: data.api_base_url ?? "",
          callback_url: data.callback_url ?? "",
          is_active: data.is_active ?? false,
        });
      }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("sham_cash_merchant_config")
      .update(form)
      .eq("id", 1);
    setSaving(false);
    if (error) {
      toast({ title: "خطأ", description: "تعذر حفظ الإعدادات", variant: "destructive" });
      return;
    }
    toast({ title: "تم الحفظ" });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Wallet className="h-5 w-5 text-primary" /> إعدادات تاجر شام كاش (قريبًا)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sc-merchant">Merchant ID</Label>
                <Input
                  id="sc-merchant"
                  dir="ltr"
                  value={form.merchant_id}
                  onChange={(e) => setForm({ ...form, merchant_id: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sc-env">البيئة</Label>
                <select
                  id="sc-env"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.environment}
                  onChange={(e) => setForm({ ...form, environment: e.target.value })}
                >
                  <option value="sandbox">sandbox (اختبار)</option>
                  <option value="live">live (مباشر)</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sc-api">API Base URL</Label>
                <Input
                  id="sc-api"
                  dir="ltr"
                  value={form.api_base_url}
                  onChange={(e) => setForm({ ...form, api_base_url: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sc-cb">Callback / Webhook URL</Label>
                <Input
                  id="sc-cb"
                  dir="ltr"
                  value={form.callback_url}
                  onChange={(e) => setForm({ ...form, callback_url: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-semibold text-sm">تفعيل بوابة شام كاش</p>
                <p className="text-xs text-muted-foreground">
                  يتطلب أيضًا تفعيل خصائص المرحلة الثانية.
                </p>
              </div>
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
                aria-label="تفعيل شام كاش"
              />
            </div>

            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              مفاتيح API والسر والتوكن تُخزّن كأسرار خاصة بالخدمة الخلفية ولا تظهر أبدًا في
              التطبيق أو قاعدة البيانات.
            </p>

            <Button onClick={() => void save()} disabled={saving}>
              {saving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />} حفظ الإعدادات
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default ShamCashMerchantConfig;
