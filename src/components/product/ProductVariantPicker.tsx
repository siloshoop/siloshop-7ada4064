import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Database } from "@/integrations/supabase/types";
import { LockKeyhole } from "lucide-react";
import { OUT_OF_STOCK_LABEL, optionInStock, variantInStock } from "@/lib/stockAvailability";

type ProductVariant = Database["public"]["Tables"]["product_variants"]["Row"];

interface ProductVariantPickerProps {
  variants: ProductVariant[];
  onSelect: (variant: ProductVariant | null) => void;
}

/** Attribute keys shown as picture thumbnails (Arabic «اللون» or English color). */
const isColorKey = (key: string) => /لون|colou?r/i.test(key);

const ProductVariantPicker = ({ variants, onSelect }: ProductVariantPickerProps) => {
  // Collect attribute keys (Arabic names) in stable order
  const attributeKeys = useMemo(() => {
    const keys: string[] = [];
    variants.forEach((v) => {
      const attrs = (v.attributes || {}) as Record<string, string>;
      Object.keys(attrs).forEach((k) => {
        if (!keys.includes(k)) keys.push(k);
      });
    });
    return keys;
  }, [variants]);

  const attributeOptions = useMemo(() => {
    const map: Record<string, string[]> = {};
    attributeKeys.forEach((key) => {
      const values: string[] = [];
      variants.forEach((v) => {
        const attrs = (v.attributes || {}) as Record<string, string>;
        if (attrs[key] && !values.includes(attrs[key])) values.push(attrs[key]);
      });
      map[key] = values;
    });
    return map;
  }, [attributeKeys, variants]);

  const [selected, setSelected] = useState<Record<string, string>>({});

  const matchingVariant = useMemo(() => {
    if (attributeKeys.length === 0) return null;
    const complete = attributeKeys.every((k) => selected[k]);
    if (!complete) return null;
    return (
      variants.find((v) => {
        const attrs = (v.attributes || {}) as Record<string, string>;
        return attributeKeys.every((k) => attrs[k] === selected[k]);
      }) || null
    );
  }, [attributeKeys, selected, variants]);

  useEffect(() => {
    onSelect(matchingVariant && variantInStock(matchingVariant) ? matchingVariant : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchingVariant]);

  const isOptionAvailable = (key: string, value: string) => {
    return optionInStock(variants, selected, key, value);
  };

  // Saved picture for each color value (first active variant of that color with an image).
  const optionImage = (key: string, value: string) =>
    variants.find((v) => ((v.attributes || {}) as Record<string, string>)[key] === value && v.image_url)?.image_url ?? null;

  const select = (key: string, value: string) =>
    setSelected((prev) => ({ ...prev, [key]: prev[key] === value ? "" : value }));

  if (attributeKeys.length === 0) return null;

  return (
    <div className="space-y-4">
      {attributeKeys.map((key) => isColorKey(key) ? (
        <div key={key} className="space-y-2.5">
          <p className="text-sm text-foreground">
            <span className="font-bold">{key.replace(/^ال(?=لون)/, "")}:</span>{" "}
            <span className="text-muted-foreground">{selected[key] || "اختر"}</span>
          </p>
          <div className="flex flex-wrap gap-2.5">
            {attributeOptions[key].map((value) => {
              const isSelected = selected[key] === value;
              const available = isOptionAvailable(key, value);
              const image = optionImage(key, value);
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={isSelected && available}
                  disabled={!available}
                  title={!available ? OUT_OF_STOCK_LABEL : value}
                  aria-label={!available ? `${value} — ${OUT_OF_STOCK_LABEL}` : value}
                  onClick={() => select(key, value)}
                  className={`relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-background p-1 transition-colors sm:h-16 sm:w-16 ${
                    isSelected && available
                      ? "border-selected ring-1 ring-selected"
                      : "border-border hover:border-selected/60"
                  } ${!available ? "cursor-not-allowed border-dashed opacity-50" : ""}`}
                >
                  {image ? (
                    <img src={image} alt={value} loading="lazy" decoding="async" draggable={false} className="h-full w-full object-contain" />
                  ) : (
                    <span className="line-clamp-2 break-words text-center text-[11px] font-medium leading-tight text-foreground">{value}</span>
                  )}
                  {!available && (
                    <LockKeyhole className="absolute bottom-0.5 left-0.5 h-3 w-3 text-muted-foreground" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div key={key} className="space-y-2">
          <span className="text-sm font-medium text-muted-foreground">{key}</span>
          <div className="flex flex-wrap gap-2">
            {attributeOptions[key].map((value) => {
              const isSelected = selected[key] === value;
              const available = isOptionAvailable(key, value);
              return (
                <Button
                  key={value}
                  type="button"
                  variant={available ? "default" : "outline"}
                  size="sm"
                  className={`rounded-full border ${isSelected && available ? "ring-2 ring-ring ring-offset-2 ring-offset-background" : ""} ${!available ? "border-dashed text-muted-foreground opacity-50" : ""}`}
                  aria-pressed={isSelected && available}
                  disabled={!available}
                  title={!available ? OUT_OF_STOCK_LABEL : undefined}
                  aria-label={!available ? `${value} — ${OUT_OF_STOCK_LABEL}` : value}
                  onClick={() =>
                    setSelected((prev) => ({
                      ...prev,
                      [key]: prev[key] === value ? "" : value,
                    }))
                  }
                >
                  {value}
                  {!available && <LockKeyhole className="ms-1 h-3 w-3" aria-hidden="true" />}
                </Button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ProductVariantPicker;
