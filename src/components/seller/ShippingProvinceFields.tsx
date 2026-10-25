import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { SYRIAN_GOVERNORATES } from "@/lib/syrianGovernorates";
import { shippingRegionsLabel, type ShippingRegions } from "@/lib/shippingRegions";

interface Props { value: ShippingRegions; onChange: (value: ShippingRegions) => void }
export default function ShippingProvinceFields({ value, onChange }: Props) {
  return <div className="space-y-3" dir="rtl">
    <Label>محافظات الشحن</Label>
    <RadioGroup value={value.shipping_all_provinces ? "all" : "specific"} onValueChange={(mode) => onChange({ ...value, shipping_all_provinces: mode === "all" })} className="flex flex-wrap gap-4">
      <Label className="flex items-center gap-2"><RadioGroupItem value="all" />جميع المحافظات</Label>
      <Label className="flex items-center gap-2"><RadioGroupItem value="specific" />محافظات محددة</Label>
    </RadioGroup>
    {!value.shipping_all_provinces && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {SYRIAN_GOVERNORATES.map((province) => <Label key={province} className="flex items-center gap-2">
        <Checkbox checked={value.shipping_provinces.includes(province)} onCheckedChange={(checked) => onChange({ ...value, shipping_provinces: checked ? [...value.shipping_provinces, province] : value.shipping_provinces.filter((p) => p !== province) })} />
        {province}
      </Label>)}
    </div>}
    <p className="text-sm text-muted-foreground">{shippingRegionsLabel(value)}</p>
  </div>;
}