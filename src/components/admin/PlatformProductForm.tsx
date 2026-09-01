import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, X } from "lucide-react";
import { productNumbersSchema, firstIssue, friendlyDbError } from "@/lib/productValidation";
import PlatformImageUploader from "./PlatformImageUploader";

export interface PlatformProduct {
  id?: string;
  name: string;
  sku: string | null;
  brand_id: string | null;
  category_id: string | null;
  description: string | null;
  price: number;
  discount_price: number | null;
  currency: string;
  stock_quantity: number;
  sizes: string[];
  colors: string[];
  weight: number | null;
  shipping_duration_text: string | null;
  image_url: string | null;
  images: string[];
  is_active: boolean;
  platform_free_shipping: boolean;
  platform_shipping_fee: number;
  platform_cod_enabled: boolean;
  platform_sham_cash_enabled: boolean;
  platform_electronic_payment_enabled: boolean;
}

const empty: PlatformProduct = {
  name: "",
  sku: "",
  brand_id: null,
  category_id: null,
  description: "",
  price: 0,
  discount_price: null,
  currency: "SYP",
  stock_quantity: 0,
  sizes: [],
  colors: [],
  weight: null,
  shipping_duration_text: "",
  image_url: null,
  images: [],
  is_active: true,
  platform_free_shipping: true,
  platform_shipping_fee: 0,
  platform_cod_enabled: true,
  platform_sham_cash_enabled: false,
  platform_electronic_payment_enabled: false,
};

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  product: PlatformProduct | null;
  onSaved: () => void;
  categories: { id: string; name_ar: string }[];
  brands: { id: string; name_ar: string }[];
}

const TagInput = ({
  label,
  values,
  onChange,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
}) => {
  const [text, setText] = useState("");
  const add = () => {
    const t = text.trim();
    if (!t || values.includes(t)) return;
    onChange([...values, t]);
    setText("");
  };
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="أضف قيمة واضغط Enter"
        />
        <Button type="button" variant="secondary" onClick={add}>
          إضافة
        </Button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {values.map((v) => (
            <span key={v} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-muted text-sm">
              {v}
              <button
                type="button"
                onClick={() => onChange(values.filter((x) => x !== v))}
                className="hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

const PlatformProductForm = ({ open, onOpenChange, product, onSaved, categories, brands }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState<PlatformProduct>(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(product ? { ...empty, ...product } : empty);
  }, [product, open]);

  const set = <K extends keyof PlatformProduct>(k: K, v: PlatformProduct[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!user) return;
    const parsed = productNumbersSchema.safeParse({
      name: form.name,
      price: form.price,
      discount_price: form.discount_price,
      stock_quantity: form.stock_quantity ?? 0,
      weight: form.weight,
      sku: form.sku,
    });
    if (!parsed.success) {
      toast({ title: "بيانات غير صالحة", description: firstIssue(parsed.error), variant: "destructive" });
      return;
    }
    const values = parsed.data;
    if (
      !form.platform_cod_enabled &&
      !form.platform_sham_cash_enabled &&
      !form.platform_electronic_payment_enabled
    ) {
      toast({ title: "يجب تفعيل طريقة دفع واحدة على الأقل لهذا المنتج", variant: "destructive" });
      return;
    }
    if (!form.platform_free_shipping && Number(form.platform_shipping_fee) <= 0) {
      toast({ title: "يرجى إدخال قيمة الشحن للمنتج", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload: any = {
      name: values.name,
      sku: values.sku ?? null,
      brand_id: form.brand_id,
      category_id: form.category_id,
      description: form.description?.trim() || null,
      price: values.price,
      discount_price: values.discount_price ?? null,
      currency: form.currency || "SYP",
      stock_quantity: values.stock_quantity ?? 0,
      sizes: form.sizes,
      colors: form.colors,
      weight: values.weight ?? null,
      shipping_duration_text: form.shipping_duration_text?.trim() || null,
      image_url: form.image_url,
      images: form.images,
      is_active: form.is_active,
      product_type: "platform",
      source: "manual",
      vendor_id: user.id,
      platform_free_shipping: form.platform_free_shipping,
      platform_shipping_fee: form.platform_free_shipping ? 0 : Number(form.platform_shipping_fee),
      platform_cod_enabled: form.platform_cod_enabled,
      platform_sham_cash_enabled: form.platform_sham_cash_enabled,
      platform_electronic_payment_enabled: form.platform_electronic_payment_enabled,
    };

    const q = form.id
      ? supabase.from("products").update(payload).eq("id", form.id)
      : supabase.from("products").insert(payload);
    const { error } = await q;
    setSaving(false);
    if (error) {
      toast({ title: "خطأ", description: friendlyDbError(error), variant: "destructive" });
      return;
    }
    toast({ title: "تم الحفظ", description: "تم حفظ المنتج بنجاح" });
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{form.id ? "تعديل منتج المنصة" : "إضافة منتج جديد"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>اسم المنتج *</Label>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>SKU</Label>
              <Input value={form.sku || ""} onChange={(e) => set("sku", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>الفئة</Label>
              <Select
                value={form.category_id || "__none__"}
                onValueChange={(v) => set("category_id", v === "__none__" ? null : v)}
              >
                <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">بدون</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name_ar}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>العلامة التجارية</Label>
              <Select
                value={form.brand_id || "__none__"}
                onValueChange={(v) => set("brand_id", v === "__none__" ? null : v)}
              >
                <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">بدون</SelectItem>
                  {brands.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name_ar}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>الوصف</Label>
            <Textarea rows={3} value={form.description || ""} onChange={(e) => set("description", e.target.value)} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>السعر *</Label>
              <Input type="number" min={0} value={form.price} onChange={(e) => set("price", Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>سعر الخصم</Label>
              <Input
                type="number"
                min={0}
                value={form.discount_price ?? ""}
                onChange={(e) => set("discount_price", e.target.value ? Number(e.target.value) : null)}
              />
            </div>
            <div className="space-y-2">
              <Label>العملة</Label>
              <Select value={form.currency} onValueChange={(v) => set("currency", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SYP">ل.س</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="TRY">TRY</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>الكمية</Label>
              <Input
                type="number"
                min={0}
                value={form.stock_quantity}
                onChange={(e) => set("stock_quantity", Number(e.target.value))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TagInput label="المقاسات المتوفرة" values={form.sizes} onChange={(v) => set("sizes", v)} />
            <TagInput label="الألوان المتوفرة" values={form.colors} onChange={(v) => set("colors", v)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>الوزن (كغ)</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                value={form.weight ?? ""}
                onChange={(e) => set("weight", e.target.value ? Number(e.target.value) : null)}
              />
            </div>
            <div className="space-y-2">
              <Label>مدة الشحن (نص حر)</Label>
              <Input
                value={form.shipping_duration_text || ""}
                maxLength={80}
                placeholder="مثال: 3 أيام / 7–10 أيام / خلال 48 ساعة"
                onChange={(e) => set("shipping_duration_text", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">تظهر للعميل كما تكتبها في صفحة المنتج والسلة والدفع.</p>
            </div>
            <div className="flex items-center gap-3 pt-6">
              <Switch checked={form.is_active} onCheckedChange={(c) => set("is_active", c)} />
              <Label>مفعّل</Label>
            </div>
          </div>

          <PlatformImageUploader
            images={form.images}
            mainImage={form.image_url}
            onChange={(imgs, main) => setForm((f) => ({ ...f, images: imgs, image_url: main }))}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
            حفظ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PlatformProductForm;