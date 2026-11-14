import { useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, X, RefreshCw, LockKeyhole } from "lucide-react";
import ColorImagesEditor from "@/components/seller/ColorImagesEditor";
import {
  AGE_PRESETS,
  MAX_MEASUREMENT_COLUMNS,
  emptySizeChart,
  type ProductOptionMode,
  type SizeChart,
} from "@/lib/productOptions";

export interface VariantRow {
  color: string;
  /** Value of the chosen option: a size or an age, depending on the mode. */
  size: string;
  stock_quantity: string;
  price: string;
}

export interface ColorsSizesValue {
  colors: string[];
  /** Size or age — never both. */
  mode: ProductOptionMode;
  sizes: string[];
  ages: string[];
  /** Optional per-size measurements in cm (size mode only). */
  sizeChart: SizeChart | null;
  /** Optional picture per color (public URL), saved on that color's variants. */
  colorImages: Record<string, string>;
  variants: VariantRow[];
}

export const emptyColorsSizes = (): ColorsSizesValue => ({
  colors: [],
  mode: "none",
  sizes: [],
  ages: [],
  sizeChart: null,
  colorImages: {},
  variants: [],
});

const CLOTHING_SIZES = ["XS", "S", "M", "L", "XL", "XXL"];
const NUMERIC_SIZES = ["36", "38", "40", "42", "44", "46"];

const MODE_OPTIONS: { value: ProductOptionMode; label: string; hint: string }[] = [
  { value: "none", label: "بدون", hint: "المنتج لا يحتاج مقاسًا أو عمرًا" },
  { value: "size", label: "المقاس فقط", hint: "مقاسات مع قياسات الطول والعرض وغيرها" },
  { value: "age", label: "العمر فقط", hint: "العمر المناسب، مثل 0–3 أشهر أو 3–5 سنوات" },
];

export const variantKey = (color: string, size: string) => `${color}__${size}`;

/** Arabic-Indic digits -> latin, and strip anything that is not a number. */
export const toLatinDigits = (s: string) =>
  s.replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x06f0));

const cleanInt = (s: string) => toLatinDigits(s).replace(/[^\d]/g, "");
const cleanDecimal = (s: string) => {
  const v = toLatinDigits(s).replace(/[^\d.]/g, "");
  const [head, ...rest] = v.split(".");
  return rest.length ? `${head}.${rest.join("").slice(0, 2)}` : head;
};

/** Builds the color x option grid, keeping quantities/prices already entered. */
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
      rows.push(map.get(variantKey(c, s)) ?? { color: c, size: s, stock_quantity: "", price: "" });
    }
  }
  return rows;
};

/** Values of the active option (sizes or ages) used for the combination grid. */
export const activeOptions = (v: Pick<ColorsSizesValue, "mode" | "sizes" | "ages">) =>
  v.mode === "size" ? v.sizes : v.mode === "age" ? v.ages : [];

interface Props {
  value: ColorsSizesValue;
  onChange: (next: ColorsSizesValue) => void;
}

/**
 * Colors plus ONE optional second option — sizes (letter, numeric, custom, with
 * optional measurements) or suitable ages — with a per-combination quantity / price table.
 */
const ProductColorsSizesEditor = ({ value, onChange }: Props) => {
  const [colorInput, setColorInput] = useState("");
  const [sizeInput, setSizeInput] = useState("");
  const [ageInput, setAgeInput] = useState("");
  const [measureInput, setMeasureInput] = useState("");
  // Entries of the option the seller switched away from, restored if they switch back.
  const stash = useRef<{ sizes: string[]; sizeChart: SizeChart | null; ages: string[] }>({
    sizes: [],
    sizeChart: null,
    ages: [],
  });

  const set = (next: Partial<ColorsSizesValue>) => {
    const merged = { ...value, ...next };
    const variants = next.variants ?? buildVariantRows(merged.colors, activeOptions(merged), value.variants);
    onChange({ ...merged, variants });
  };

  const changeMode = (mode: ProductOptionMode) => {
    if (mode === value.mode) return;
    if (value.mode === "size") stash.current = { ...stash.current, sizes: value.sizes, sizeChart: value.sizeChart };
    if (value.mode === "age") stash.current = { ...stash.current, ages: value.ages };
    set({
      mode,
      sizes: mode === "size" ? stash.current.sizes : [],
      sizeChart: mode === "size" ? stash.current.sizeChart : null,
      ages: mode === "age" ? stash.current.ages : [],
    });
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

  const addAge = (raw: string) => {
    const v = raw.trim().slice(0, 30);
    if (!v || value.ages.includes(v) || value.ages.length >= 30) return;
    set({ ages: [...value.ages, v] });
  };

  const chart = value.sizeChart ?? emptySizeChart();

  const addMeasure = (raw: string) => {
    const v = raw.trim().slice(0, 30);
    if (!v || chart.columns.includes(v) || chart.columns.length >= MAX_MEASUREMENT_COLUMNS) return;
    set({ sizeChart: { ...chart, columns: [...chart.columns, v] } });
  };

  const removeMeasure = (col: string) =>
    set({
      sizeChart: {
        columns: chart.columns.filter((c) => c !== col),
        rows: chart.rows.map((r) => {
          const { [col]: _removed, ...rest } = r.values;
          return { ...r, values: rest };
        }),
      },
    });

  const setMeasure = (size: string, col: string, raw: string) => {
    const v = cleanDecimal(raw).slice(0, 8);
    const has = chart.rows.some((r) => r.size === size);
    const rows = has
      ? chart.rows.map((r) => (r.size === size ? { ...r, values: { ...r.values, [col]: v } } : r))
      : [...chart.rows, { size, values: { [col]: v } }];
    set({ sizeChart: { ...chart, rows } });
  };

  const measureOf = (size: string, col: string) => chart.rows.find((r) => r.size === size)?.values[col] ?? "";

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
        <div className="flex min-w-0 gap-2">
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
            aria-label="إضافة اللون"
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
                  onClick={() => {
                    const { [c]: _removed, ...colorImages } = value.colorImages ?? {};
                    set({ colors: value.colors.filter((x) => x !== c), colorImages });
                  }}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      <ColorImagesEditor
        colors={value.colors}
        value={value.colorImages ?? {}}
        onChange={(colorImages) => onChange({ ...value, colorImages })}
      />

      {/* Size OR age */}
      <div className="space-y-2">
        <Label>المقاس أو العمر</Label>
        <RadioGroup
          value={value.mode}
          onValueChange={(v) => changeMode(v as ProductOptionMode)}
          className="grid gap-2 sm:grid-cols-3"
        >
          {MODE_OPTIONS.map((option) => (
            <Label
              key={option.value}
              className={`flex cursor-pointer flex-col items-start gap-1 rounded-lg border p-3 text-sm font-normal transition-colors ${
                value.mode === option.value ? "border-primary bg-primary/5" : "border-border"
              }`}
            >
              <span className="flex items-center gap-2">
                <RadioGroupItem value={option.value} />
                <span className="font-medium">{option.label}</span>
              </span>
              <span className="text-xs text-muted-foreground">{option.hint}</span>
            </Label>
          ))}
        </RadioGroup>
        <p className="text-xs text-muted-foreground">
          اختر المقاس أو العمر حسب نوع المنتج — لا يمكن الجمع بينهما في نفس المنتج.
        </p>
      </div>

      {/* Sizes */}
      {value.mode === "size" && (
        <div className="space-y-4 rounded-lg border p-3">
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
                aria-label="إضافة المقاس"
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
              أحرف (XS–XXL)، أرقام (36، 38، 40...) أو أي صيغة مخصصة.
            </p>
          </div>

          {value.sizes.length > 0 && (
            <div className="space-y-2">
              <Label>قياسات كل مقاس بالسنتيمتر (اختياري)</Label>
              <div className="flex flex-wrap gap-2">
                {chart.columns.map((c) => (
                  <Badge key={c} variant="secondary" className="gap-1">
                    {c}
                    <button type="button" aria-label={`حذف قياس ${c}`} onClick={() => removeMeasure(c)}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              {chart.columns.length < MAX_MEASUREMENT_COLUMNS && (
                <div className="flex gap-2">
                  <Input
                    value={measureInput}
                    maxLength={30}
                    aria-label="اسم القياس"
                    placeholder="إضافة قياس (مثال: الخصر، الصدر، الكم)"
                    onChange={(e) => setMeasureInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        addMeasure(measureInput);
                        setMeasureInput("");
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    aria-label="إضافة القياس"
                    onClick={() => {
                      addMeasure(measureInput);
                      setMeasureInput("");
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              )}
              {chart.columns.length > 0 && (
                <div className="space-y-2 rounded-lg border p-2">
                  {value.sizes.map((s) => (
                    <div key={s} className="grid grid-cols-[3.5rem_1fr] items-center gap-2">
                      <span className="rounded-md bg-muted px-2 py-1 text-center text-sm font-semibold">{s}</span>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {chart.columns.map((c) => (
                          <Input
                            key={c}
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            dir="ltr"
                            className="text-left"
                            aria-label={`${c} للمقاس ${s} (سم)`}
                            placeholder={`${c} (سم)`}
                            value={measureOf(s, c)}
                            onChange={(e) => setMeasure(s, c, e.target.value)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">تظهر القياسات للمشتري في جدول المقاسات بصفحة المنتج.</p>
            </div>
          )}
        </div>
      )}

      {/* Ages */}
      {value.mode === "age" && (
        <div className="space-y-2 rounded-lg border p-3">
          <Label htmlFor="csz-age">العمر المناسب</Label>
          <div className="flex flex-wrap gap-2">
            {AGE_PRESETS.map((a) => (
              <Button
                key={a}
                type="button"
                size="sm"
                variant={value.ages.includes(a) ? "default" : "outline"}
                onClick={() =>
                  value.ages.includes(a) ? set({ ages: value.ages.filter((x) => x !== a) }) : addAge(a)
                }
              >
                {a}
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              id="csz-age"
              value={ageInput}
              maxLength={30}
              placeholder="عمر مخصص (مثال: 18–24 شهرًا، 14 سنة فأكثر)"
              onChange={(e) => setAgeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addAge(ageInput);
                  setAgeInput("");
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              aria-label="إضافة العمر"
              onClick={() => {
                addAge(ageInput);
                setAgeInput("");
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {value.ages.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {value.ages.map((a) => (
                <Badge key={a} variant="secondary" className="gap-1">
                  {a}
                  <button
                    type="button"
                    aria-label="حذف العمر"
                    onClick={() => set({ ages: value.ages.filter((x) => x !== a) })}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Combinations */}
      {value.variants.length > 0 && (
        <div className="space-y-2">
          <div className="flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Label className="min-w-0 leading-relaxed">الكمية والسعر لكل تركيبة (اختياري)</Label>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() =>
                onChange({
                  ...value,
                  variants: buildVariantRows(value.colors, activeOptions(value), value.variants),
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
                  <p className={`flex items-center gap-2 rounded-md border px-2 py-1 text-sm font-medium sm:col-span-2 ${Number(r.stock_quantity) > 0 ? "bg-primary text-primary-foreground" : "border-dashed text-muted-foreground opacity-60"}`}>
                    {[r.color, r.size].filter(Boolean).join(" / ")}
                    {Number(r.stock_quantity) <= 0 && <><LockKeyhole className="h-3 w-3 shrink-0" />نفذت الكمية</>}
                  </p>
                  <Input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    dir="ltr"
                    className="text-left"
                    aria-label={`الكمية ${[r.color, r.size].filter(Boolean).join(" / ")}`}
                    placeholder="الكمية"
                    value={r.stock_quantity}
                    onChange={(e) => updateRow(key, "stock_quantity", cleanInt(e.target.value))}
                  />
                  <Input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    dir="ltr"
                    className="text-left"
                    aria-label={`السعر ${[r.color, r.size].filter(Boolean).join(" / ")}`}
                    placeholder="السعر (اختياري)"
                    value={r.price}
                    onChange={(e) => updateRow(key, "price", cleanDecimal(e.target.value))}
                  />

                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            مجموع كميات التركيبات: {totalStock.toLocaleString()} — الكمية الفارغة أو صفر تعني نفاد المخزون.
            السعر الفارغ يعني استخدام سعر المنتج.
          </p>
        </div>
      )}
    </div>
  );
};

export default ProductColorsSizesEditor;
