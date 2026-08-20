import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { money, weight as weightSchema, codeText, friendlyDbError } from "@/lib/productValidation";
import { z } from "zod";

interface AttributeValue {
  id: string;
  attribute_id: string;
  value_ar: string;
  sort_order: number;
}

interface Attribute {
  id: string;
  name_ar: string;
  input_type: string;
  values: AttributeValue[];
}

interface Variant {
  id: string;
  product_id: string;
  attributes: Record<string, string>;
  sku: string | null;
  barcode: string | null;
  price: number | null;
  discount_price: number | null;
  stock_quantity: number;
  weight: number | null;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
}

const emptyDraft = {
  attributes: {} as Record<string, string>,
  sku: "",
  barcode: "",
  price: "",
  discount_price: "",
  stock_quantity: "0",
  weight: "",
  image_url: "",
  is_active: true,
};

const variantSchema = z.object({
  sku: codeText("رمز المتغير (SKU)"),
  barcode: codeText("الباركود"),
  price: money("السعر"),
  discount_price: money("سعر الخصم"),
  stock_quantity: z.union([z.string(), z.number()]).transform((v) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0;
  }),
  weight: weightSchema(),
});

const ProductVariantsManager = ({ productId }: { productId: string }) => {
  const { toast } = useToast();
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ ...emptyDraft });
  const [freeText, setFreeText] = useState<Record<string, string>>({});
  const [editRows, setEditRows] = useState<Record<string, any>>({});

  const loadAll = async () => {
    setLoading(true);
    try {
      const [{ data: attrs, error: attrErr }, { data: vals, error: valErr }, { data: vrs, error: vrErr }] =
        await Promise.all([
          supabase.from("product_attributes").select("*").eq("is_active", true).order("sort_order"),
          supabase.from("product_attribute_values").select("*").order("sort_order"),
          supabase
            .from("product_variants")
            .select("*")
            .eq("product_id", productId)
            .order("sort_order"),
        ]);

      if (attrErr) throw attrErr;
      if (valErr) throw valErr;
      if (vrErr) throw vrErr;

      const merged: Attribute[] = (attrs || []).map((a: any) => ({
        ...a,
        values: (vals || []).filter((v: any) => v.attribute_id === a.id),
      }));

      setAttributes(merged);
      setVariants(
        (vrs || []).map((v: any) => ({
          ...v,
          attributes: (v.attributes as Record<string, string>) || {},
        })),
      );

      const initEdit: Record<string, any> = {};
      (vrs || []).forEach((v: any) => {
        initEdit[v.id] = {
          sku: v.sku || "",
          barcode: v.barcode || "",
          price: v.price?.toString() || "",
          discount_price: v.discount_price?.toString() || "",
          stock_quantity: v.stock_quantity?.toString() || "0",
          weight: v.weight?.toString() || "",
          image_url: v.image_url || "",
          is_active: v.is_active,
        };
      });
      setEditRows(initEdit);
    } catch (error) {
      toast({ title: "خطأ", description: friendlyDbError(error), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (productId) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const setDraftAttr = (attrId: string, value: string) => {
    setDraft((prev) => ({ ...prev, attributes: { ...prev.attributes, [attrId]: value } }));
  };

  const attrLabelMap = (attrs: Record<string, string>) => {
    return Object.entries(attrs)
      .map(([attrId, val]) => {
        const attr = attributes.find((a) => a.id === attrId);
        return `${attr?.name_ar || attrId}: ${val}`;
      })
      .join(" / ");
  };

  const combosMatch = (a: Record<string, string>, b: Record<string, string>) => {
    const ka = Object.keys(a).filter((k) => a[k]);
    const kb = Object.keys(b).filter((k) => b[k]);
    if (ka.length !== kb.length) return false;
    return ka.every((k) => a[k] === b[k]);
  };

  const handleAddVariant = async () => {
    const cleanedAttrs: Record<string, string> = {};
    Object.entries(draft.attributes).forEach(([k, v]) => {
      if (v && v.trim()) cleanedAttrs[k] = v.trim();
    });

    if (Object.keys(cleanedAttrs).length === 0) {
      toast({ title: "خطأ", description: "يرجى تحديد خاصية واحدة على الأقل للمتغير", variant: "destructive" });
      return;
    }

    if (variants.some((v) => combosMatch(v.attributes, cleanedAttrs))) {
      toast({ title: "خطأ", description: "هذا المتغير موجود مسبقاً بنفس الخصائص", variant: "destructive" });
      return;
    }

    const parsed = variantSchema.safeParse({
      sku: draft.sku,
      barcode: draft.barcode,
      price: draft.price,
      discount_price: draft.discount_price,
      stock_quantity: draft.stock_quantity,
      weight: draft.weight,
    });

    if (!parsed.success) {
      toast({ title: "بيانات غير صالحة", description: parsed.error.issues[0]?.message, variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("product_variants").insert({
        product_id: productId,
        attributes: cleanedAttrs,
        sku: parsed.data.sku,
        barcode: parsed.data.barcode,
        price: parsed.data.price,
        discount_price: parsed.data.discount_price,
        stock_quantity: parsed.data.stock_quantity,
        weight: parsed.data.weight,
        image_url: draft.image_url.trim() || null,
        is_active: draft.is_active,
        sort_order: variants.length,
      } as any);

      if (error) throw error;

      toast({ title: "تم بنجاح", description: "تمت إضافة المتغير" });
      setDraft({ ...emptyDraft });
      setFreeText({});
      await loadAll();
    } catch (error) {
      toast({ title: "خطأ", description: friendlyDbError(error), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRow = async (id: string) => {
    const row = editRows[id];
    if (!row) return;

    const parsed = variantSchema.safeParse({
      sku: row.sku,
      barcode: row.barcode,
      price: row.price,
      discount_price: row.discount_price,
      stock_quantity: row.stock_quantity,
      weight: row.weight,
    });

    if (!parsed.success) {
      toast({ title: "بيانات غير صالحة", description: parsed.error.issues[0]?.message, variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("product_variants")
        .update({
          sku: parsed.data.sku,
          barcode: parsed.data.barcode,
          price: parsed.data.price,
          discount_price: parsed.data.discount_price,
          stock_quantity: parsed.data.stock_quantity,
          weight: parsed.data.weight,
          image_url: row.image_url.trim() || null,
          is_active: row.is_active,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", id);

      if (error) throw error;
      toast({ title: "تم بنجاح", description: "تم تحديث المتغير" });
      await loadAll();
    } catch (error) {
      toast({ title: "خطأ", description: friendlyDbError(error), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRow = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا المتغير؟")) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("product_variants").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "تم الحذف", description: "تم حذف المتغير" });
      await loadAll();
    } catch (error) {
      toast({ title: "خطأ", description: friendlyDbError(error), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">إضافة متغير جديد</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {attributes.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا توجد خصائص مُفعّلة بعد. تواصل مع الإدارة لإضافة خصائص.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {attributes.map((attr) => (
                <div key={attr.id} className="space-y-2">
                  <Label>{attr.name_ar}</Label>
                  {attr.input_type === "select" && attr.values.length > 0 ? (
                    <Select
                      value={draft.attributes[attr.id] || ""}
                      onValueChange={(value) => setDraftAttr(attr.id, value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={`اختر ${attr.name_ar}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {attr.values.map((v) => (
                          <SelectItem key={v.id} value={v.value_ar}>
                            {v.value_ar}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={draft.attributes[attr.id] || ""}
                      onChange={(e) => setDraftAttr(attr.id, e.target.value)}
                      placeholder={`أدخل ${attr.name_ar}`}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>SKU</Label>
              <Input value={draft.sku} onChange={(e) => setDraft({ ...draft, sku: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>الباركود</Label>
              <Input value={draft.barcode} onChange={(e) => setDraft({ ...draft, barcode: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>الكمية</Label>
              <Input
                type="number"
                min="0"
                value={draft.stock_quantity}
                onChange={(e) => setDraft({ ...draft, stock_quantity: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>السعر</Label>
              <Input
                type="number"
                step="0.01"
                value={draft.price}
                onChange={(e) => setDraft({ ...draft, price: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>سعر الخصم</Label>
              <Input
                type="number"
                step="0.01"
                value={draft.discount_price}
                onChange={(e) => setDraft({ ...draft, discount_price: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>الوزن (كغ)</Label>
              <Input
                type="number"
                step="0.001"
                value={draft.weight}
                onChange={(e) => setDraft({ ...draft, weight: e.target.value })}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>رابط صورة المتغير</Label>
              <Input
                type="url"
                value={draft.image_url}
                onChange={(e) => setDraft({ ...draft, image_url: e.target.value })}
                placeholder="https://example.com/image.jpg"
              />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch checked={draft.is_active} onCheckedChange={(v) => setDraft({ ...draft, is_active: v })} />
              <Label>مفعّل</Label>
            </div>
          </div>

          <Button type="button" onClick={handleAddVariant} disabled={saving}>
            {saving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Plus className="ml-2 h-4 w-4" />}
            إضافة المتغير
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h4 className="font-semibold">المتغيرات الحالية ({variants.length})</h4>
        {variants.length === 0 && (
          <p className="text-sm text-muted-foreground">لا توجد متغيرات بعد لهذا المنتج.</p>
        )}
        {variants.map((v) => {
          const row = editRows[v.id] || {};
          return (
            <Card key={v.id}>
              <CardContent className="pt-6 space-y-4">
                <p className="font-medium text-sm text-primary">{attrLabelMap(v.attributes) || "بدون خصائص"}</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>SKU</Label>
                    <Input
                      value={row.sku}
                      onChange={(e) => setEditRows({ ...editRows, [v.id]: { ...row, sku: e.target.value } })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>الباركود</Label>
                    <Input
                      value={row.barcode}
                      onChange={(e) => setEditRows({ ...editRows, [v.id]: { ...row, barcode: e.target.value } })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>الكمية</Label>
                    <Input
                      type="number"
                      min="0"
                      value={row.stock_quantity}
                      onChange={(e) =>
                        setEditRows({ ...editRows, [v.id]: { ...row, stock_quantity: e.target.value } })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>السعر</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={row.price}
                      onChange={(e) => setEditRows({ ...editRows, [v.id]: { ...row, price: e.target.value } })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>سعر الخصم</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={row.discount_price}
                      onChange={(e) =>
                        setEditRows({ ...editRows, [v.id]: { ...row, discount_price: e.target.value } })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>الوزن (كغ)</Label>
                    <Input
                      type="number"
                      step="0.001"
                      value={row.weight}
                      onChange={(e) => setEditRows({ ...editRows, [v.id]: { ...row, weight: e.target.value } })}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>رابط صورة المتغير</Label>
                    <Input
                      type="url"
                      value={row.image_url}
                      onChange={(e) => setEditRows({ ...editRows, [v.id]: { ...row, image_url: e.target.value } })}
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <Switch
                      checked={row.is_active}
                      onCheckedChange={(val) => setEditRows({ ...editRows, [v.id]: { ...row, is_active: val } })}
                    />
                    <Label>مفعّل</Label>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="button" size="sm" onClick={() => handleSaveRow(v.id)} disabled={saving}>
                    <Save className="ml-2 h-4 w-4" />
                    حفظ
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDeleteRow(v.id)}
                    disabled={saving}
                  >
                    <Trash2 className="ml-2 h-4 w-4" />
                    حذف
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default ProductVariantsManager;
