import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { currencySymbol } from "@/lib/currency";
import type { PlatformSettings } from "@/lib/platformProductSettings";

interface Props {
  value: PlatformSettings;
  onChange: (next: PlatformSettings) => void;
  currency: string;
}

/** Owner-only shipping, payment and catalogue fields of a platform product. */
const PlatformProductSettingsFields = ({ value, onChange, currency }: Props) => {
  const [brands, setBrands] = useState<{ id: string; name_ar: string }[]>([]);
  useEffect(() => {
    let cancelled = false;
    supabase.from("brands").select("id, name_ar").order("name_ar").then(({ data }) => {
      if (!cancelled) setBrands((data as { id: string; name_ar: string }[] | null) ?? []);
    });
    return () => { cancelled = true; };
  }, []);
  const set = (patch: Partial<PlatformSettings>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-4 rounded-lg border p-3">
      <p className="text-sm font-semibold">إعدادات منتج المنصة</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>العلامة التجارية</Label>
          <Select value={value.brand_id || "__none__"} onValueChange={(v) => set({ brand_id: v === "__none__" ? null : v })}>
            <SelectTrigger aria-label="العلامة التجارية"><SelectValue placeholder="اختر" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">بدون</SelectItem>
              {brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name_ar}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="platform-sku">SKU</Label>
          <Input id="platform-sku" dir="ltr" maxLength={100} value={value.sku} onChange={(e) => set({ sku: e.target.value })} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="platform-duration">مدة الشحن (نص حر)</Label>
        <Input
          id="platform-duration"
          maxLength={80}
          placeholder="مثال: 3 أيام / 7–10 أيام / خلال 48 ساعة"
          value={value.shipping_duration_text}
          onChange={(e) => set({ shipping_duration_text: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">تظهر للعميل كما تكتبها في صفحة المنتج والسلة والدفع.</p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div>
          <Label htmlFor="platform-free-shipping">شحن مجاني</Label>
          <p className="text-xs text-muted-foreground">عند الإيقاف يتم إدخال قيمة الشحن</p>
        </div>
        <Switch id="platform-free-shipping" checked={value.free_shipping} onCheckedChange={(c) => set({ free_shipping: c })} />
      </div>
      {!value.free_shipping && (
        <div className="space-y-1.5">
          <Label htmlFor="platform-fee">قيمة الشحن ({currencySymbol(currency)})</Label>
          <Input id="platform-fee" inputMode="decimal" dir="ltr" value={value.shipping_fee} onChange={(e) => set({ shipping_fee: e.target.value })} />
        </div>
      )}

      <div className="space-y-2 pt-1">
        <Label>طرق الدفع المتاحة لهذا المنتج</Label>
        {([
          ["cod", "الدفع عند الاستلام"],
          ["sham_cash", "شام كاش"],
          ["electronic", "الدفع الإلكتروني"],
        ] as const).map(([key, label]) => (
          <div key={key} className="flex items-center justify-between gap-3">
            <span className="text-sm">{label}</span>
            <Switch aria-label={label} checked={value[key]} onCheckedChange={(c) => set({ [key]: c } as Partial<PlatformSettings>)} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlatformProductSettingsFields;
