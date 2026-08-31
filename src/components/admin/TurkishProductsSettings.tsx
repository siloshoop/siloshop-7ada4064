import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Truck, CreditCard } from "lucide-react";

/**
 * Shipping + payment settings that apply to Turkish (platform) products.
 * Only super admins can save them (enforced by RLS on platform_payment_settings),
 * and create_order re-validates every value server-side.
 */
const TurkishProductsSettings = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    free_shipping: true,
    shipping_fee: 0,
    cod_enabled: false,
    sham_cash_enabled: true,
    electronic_payment_enabled: false,
    electronic_payment_instructions: "",
    apply_to_all_products: false,
  });

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("platform_payment_settings")
        .select(
          "free_shipping, shipping_fee, cod_enabled, sham_cash_enabled, electronic_payment_enabled, electronic_payment_instructions, apply_to_all_products"
        )
        .eq("id", 1)
        .maybeSingle();
      if (data) {
        setForm({
          free_shipping: data.free_shipping ?? true,
          shipping_fee: Number(data.shipping_fee ?? 0),
          cod_enabled: data.cod_enabled ?? false,
          sham_cash_enabled: data.sham_cash_enabled ?? true,
          electronic_payment_enabled: data.electronic_payment_enabled ?? false,
          electronic_payment_instructions: data.electronic_payment_instructions ?? "",
          apply_to_all_products: data.apply_to_all_products ?? false,
        });
      }
      setLoading(false);
    })();
  }, []);

  const noMethod =
    !form.cod_enabled && !form.sham_cash_enabled && !form.electronic_payment_enabled;

  const save = async () => {
    if (noMethod) {
      toast({
        title: "يجب تفعيل طريقة دفع واحدة على الأقل",
        variant: "destructive",
      });
      return;
    }
    if (!form.free_shipping && Number(form.shipping_fee) <= 0) {
      toast({ title: "يرجى إدخال قيمة الشحن", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("platform_payment_settings")
      .update({
        free_shipping: form.free_shipping,
        shipping_fee: form.free_shipping ? 0 : Number(form.shipping_fee),
        cod_enabled: form.cod_enabled,
        sham_cash_enabled: form.sham_cash_enabled,
        electronic_payment_enabled: form.electronic_payment_enabled,
        electronic_payment_instructions: form.electronic_payment_instructions,
        apply_to_all_products: form.apply_to_all_products,
      })
      .eq("id", 1);
    setSaving(false);
    if (error) {
      toast({ title: "فشل الحفظ", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "تم الحفظ", description: "تم تحديث إعدادات المنتجات التركية." });
  };

  const Row = ({
    title,
    description,
    checked,
    onChange,
  }: {
    title: string;
    description: string;
    checked: boolean;
    onChange: (v: boolean) => void;
  }) => (
    <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Truck className="h-4 w-4 text-primary" /> إعدادات المنتجات التركية (الشحن والدفع)
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
              تُطبَّق هذه الإعدادات على قسم «المنتجات التركية» فقط، ولا تؤثر على منتجات البائعين
              (الدفع عند الاستلام وشحن كل منتج) إلا إذا اخترت تطبيقها على كل المنتجات.
            </p>

            <div className="space-y-2">
              <p className="text-sm font-semibold">الشحن</p>
              <Row
                title="شحن مجاني"
                description="لا يتم إضافة أي تكلفة شحن على طلبات المنتجات التركية"
                checked={form.free_shipping}
                onChange={(v) => setForm({ ...form, free_shipping: v })}
              />
              {!form.free_shipping && (
                <div className="space-y-1.5">
                  <Label htmlFor="tp-fee">قيمة الشحن (ل.س)</Label>
                  <Input
                    id="tp-fee"
                    type="number"
                    min={0}
                    dir="ltr"
                    value={form.shipping_fee}
                    onChange={(e) =>
                      setForm({ ...form, shipping_fee: Math.max(0, Number(e.target.value) || 0) })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    تُضاف مرة واحدة على الطلب وتظهر للعميل عند إتمام الشراء.
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2 pt-2">
              <p className="text-sm font-semibold">طرق الدفع</p>
              <Row
                title="الدفع عند الاستلام"
                description="يدفع العميل نقداً عند تسليم الطلب"
                checked={form.cod_enabled}
                onChange={(v) => setForm({ ...form, cod_enabled: v })}
              />
              <Row
                title="شام كاش"
                description="تحويل المبلغ إلى محفظة شام كاش الخاصة بالمنصة"
                checked={form.sham_cash_enabled}
                onChange={(v) => setForm({ ...form, sham_cash_enabled: v })}
              />
              <Row
                title="الدفع الإلكتروني في سوريا"
                description="بطاقات ومحافظ الدفع الإلكتروني المحلية"
                checked={form.electronic_payment_enabled}
                onChange={(v) => setForm({ ...form, electronic_payment_enabled: v })}
              />
              {form.electronic_payment_enabled && (
                <div className="space-y-1.5">
                  <Label htmlFor="tp-epay" className="flex items-center gap-1.5">
                    <CreditCard className="h-3.5 w-3.5" /> تعليمات الدفع الإلكتروني
                  </Label>
                  <Textarea
                    id="tp-epay"
                    rows={3}
                    maxLength={500}
                    value={form.electronic_payment_instructions}
                    onChange={(e) =>
                      setForm({ ...form, electronic_payment_instructions: e.target.value })
                    }
                    placeholder="مثال: يتم الدفع عبر بطاقة البنك... التفاصيل تُرسل بعد تأكيد الطلب"
                  />
                </div>
              )}
              {noMethod && (
                <p className="text-xs text-destructive">
                  يجب تفعيل طريقة دفع واحدة على الأقل وإلا لن يستطيع العميل إتمام الطلب.
                </p>
              )}
            </div>

            <div className="pt-2">
              <Row
                title="تطبيق هذه الإعدادات على كل المنتجات"
                description="عند التفعيل تُطبَّق نفس إعدادات الشحن والدفع على منتجات البائعين أيضاً"
                checked={form.apply_to_all_products}
                onChange={(v) => setForm({ ...form, apply_to_all_products: v })}
              />
            </div>

            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="ml-1 h-4 w-4 animate-spin" />} حفظ الإعدادات
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default TurkishProductsSettings;
