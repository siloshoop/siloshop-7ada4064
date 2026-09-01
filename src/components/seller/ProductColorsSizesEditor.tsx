import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, X, RefreshCw } from "lucide-react";

export interface VariantRow {
  color: string;
  size: string;
  stock_quantity: string;
  price: string;
}

export interface ColorsSizesValue {
  colors: string[];
  sizes: string[];
  variants: VariantRow[];
}

const CLOTHING_SIZES = ["XS", "S", "M", "L", "XL", "XXL"];
const NUMERIC_SIZES = ["36", "38", "40", "42", "44", "46"];

export const variantKey = (color: string, size: string) => `${color}__${size}`;

/** Builds the color x size grid, keeping quantities/prices already entered. */
export const buildVariantRows = (
  colors: string[],
  sizes: string[],
  existing: VariantRow[]
): VariantRow[] => {
  const cs = colors.length > 0 ? colors : [""];
  const ss = sizes.length > 0 ? sizes : [""];
  if (colors.length === 0 && sizes.length === 0) return [];
  const map = new Map(existing.map((r) => [variantKey(r.color, r.size), r]));
  const rows: VariantRow[] = [];
  for (const c of cs) {
    for (const s of ss) {
      rows.push(map.get(variantKey(c, s)) ?? { color: c, size: s, stock_quantity: "0", price: "" });
    }
  }
  return rows;
};

interface Props {
  value: ColorsSizesValue;
  onChange: (next: ColorsSizesValue) => void;
}

/**
 * Colors + sizes (letter, numeric and custom) for any product category,
 * with an optional per-combination quantity / price table.
 */
const ProductColorsSizesEditor = ({ value, onChange }: Props) => {
  const [colorInput, setColorInput] = useState("");
  const [sizeInput, setSizeInput] = useState("");

  const set = (next: Partial<ColorsSizesValue>) => {
    const colors = next.colors ?? value.colors;
    const sizes = next.sizes ?? value.sizes;
    const variants = next.variants ?? buildVariantRows(colors, sizes, value.variants);
    onChange({ colors, sizes, variants });
  };

  const addColor = (raw: string) => {
    const v = raw.trim().slice(0, 40);
    if (!v || value.colors.includes(v)) return;
    set({ colors: [...value.colors, v] });
  };

  const addSize = (raw: string) => {
    const v = raw.trim().toUpperCase().slice(0, 20);
    if (!v || value.sizes.includes(v)) return;
    set({ sizes: [...value.sizes, v] });
  };

  const updateRow = (key: string, field: "stock_quantity" | "price", v: string) => {
    onChange({
      ...value,
      variants: value.variants.map((r) =>
        variantKey(r.color, r.size) === key ? { ...r, [field]: v } : r
      ),
    });
  };

  const totalStock = useMemo(
    () => value.variants.reduce((s, r) => s + (parseInt(r.stock_quantity, 10) || 0), 0),
    [value.variants]
  );

  return (
    <div className="space-y-5">
      {/* Colors */}
      <div className="space-y-2">
        <Label htmlFor="csz-color">الألوان</Label>
        <div className="flex gap-2">
          <Input
            id="csz-color"
            value={colorInput}
            maxLength={40}
            placeholder="مثال: أسود، أبيض، أحمر"
            onChange={(e) => setColorInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addColor(colorInput);
                setColorInput("");
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              addColor(colorInput);
              setColorInput("");
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {value.colors.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {value.colors.map((c) => (
              <Badge key={c} variant="secondary" className="gap-1">
                {c}
                <button
                  type="button"
                  aria-label="حذف اللون"
                  onClick={() => set({ colors: value.colors.filter((x) => x !== c) })}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Sizes */}
      <div className="space-y-2">
        <Label htmlFor="csz-size">المقاسات</Label>
        <div className="flex flex-wrap gap-2">
          {[...CLOTHING_SIZES, ...NUMERIC_SIZES].map((s) => (
            <Button
              key={s}
              type="button"
              size="sm"
              variant={value.sizes.includes(s) ? "default" : "outline"}
              onClick={() =>
                value.sizes.includes(s)
                  ? set({ sizes: value.sizes.filter((x) => x !== s) })
                  : addSize(s)
              }
            >
              {s}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            id="csz-size"
            value={sizeInput}
            maxLength={20}
            placeholder="مقاس مخصص (مثال: 48، 2XL، 250 مل)"
            onChange={(e) => setSizeInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addSize(sizeInput);
                setSizeInput("");
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              addSize(sizeInput);
              setSizeInput("");
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {value.sizes.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {value.sizes.map((s) => (
              <Badge key={s} variant="secondary" className="gap-1">
                {s}
                <button
                  type="button"
                  aria-label="حذف المقاس"
                  onClick={() => set({ sizes: value.sizes.filter((x) => x !== s) })}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          المقاسات متاحة لكل الفئات: أحرف (XS–XXL)، أرقام (36، 38، 40...) أو أي صيغة مخصصة.
        </p>
      </div>

      {/* Combinations */}
      {value.variants.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label>الكمية والسعر لكل تركيبة (اختياري)</Label>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() =>
                onChange({
                  ...value,
                  variants: buildVariantRows(value.colors, value.sizes, value.variants),
                })
              }
            >
              <RefreshCw className="ml-1 h-3.5 w-3.5" /> تحديث التركيبات
            </Button>
          </div>
          <div className="space-y-2 rounded-lg border p-2">
            {value.variants.map((r) => {
              const key = variantKey(r.color, r.size);
              return (
                <div key={key} className="grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-center">
                  <p className="text-sm font-medium sm:col-span-2">
                    {[r.color, r.size].filter(Boolean).join(" / ")}
                  </p>
                  <Input
                    type="number"
                    min={0}
                    dir="ltr"
                    aria-label="الكمية"
                    placeholder="الكمية"
                    value={r.stock_quantity}
                    onChange={(e) => updateRow(key, "stock_quantity", e.target.value)}
                  />
                  <Input
                    type="number"
                    min={0}
                    dir="ltr"
                    aria-label="السعر (اختياري)"
                    placeholder="السعر (اختياري)"
                    value={r.price}
                    onChange={(e) => updateRow(key, "price", e.target.value)}
                  />
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            مجموع كميات التركيبات: {totalStock.toLocaleString()} — اتركه فارغاً إن لم ترغب بتحديد
            كمية لكل تركيبة. السعر الفارغ يعني استخدام سعر المنتج.
          </p>
        </div>
      )}
    </div>
  );
};

export default ProductColorsSizesEditor;
