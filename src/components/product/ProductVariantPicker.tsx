import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { colorSwatch } from "@/lib/colorSwatch";
import type { Database } from "@/integrations/supabase/types";
import { LockKeyhole } from "lucide-react";
import { OUT_OF_STOCK_LABEL, optionInStock, variantInStock } from "@/lib/stockAvailability";

type ProductVariant = Database["public"]["Tables"]["product_variants"]["Row"];

interface ProductVariantPickerProps {
  variants: ProductVariant[];
  onSelect: (variant: ProductVariant | null) => void;
  /** Saved picture of the chosen color (null when none is chosen or it has no picture). */
  onColorImage?: (image: string | null) => void;
}

/** Attribute keys shown as picture thumbnails (Arabic «اللون» or English color). */
const isColorKey = (key: string) => /لون|colou?r/i.test(key);

const ProductVariantPicker = ({ variants, onSelect, onColorImage }: ProductVariantPickerProps) => {
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

  // Best-selling color, counted on the server from recorded orders (value only, never counts).
  const productId = variants[0]?.product_id;
  const colorKey = attributeKeys.find(isColorKey);
  const colorOptionCount = colorKey ? attributeOptions[colorKey].length : 0;
  const [popularColor, setPopularColor] = useState<string | null>(null);
  useEffect(() => {
    setPopularColor(null);
    if (!productId || !colorKey || colorOptionCount < 2) return;
    let cancelled = false;
    supabase
      .rpc("get_popular_variant_option", { p_product_id: productId, p_attribute: colorKey })
      .then(({ data, error }) => {
        if (!cancelled && !error && typeof data === "string" && data) setPopularColor(data);
      }, () => undefined);
    return () => { cancelled = true; };
  }, [productId, colorKey, colorOptionCount]);

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

  const chosenColor = colorKey ? selected[colorKey] || "" : "";
  useEffect(() => {
    onColorImage?.(colorKey && chosenColor ? optionImage(colorKey, chosenColor) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosenColor, colorKey, variants]);

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
          <div className="flex flex-wrap gap-3.5 pt-3.5 sm:gap-4">
            {attributeOptions[key].map((value) => {
              const isSelected = selected[key] === value;
              const available = isOptionAvailable(key, value);
              // A color's own uploaded picture wins over the generic color dot.
              const image = optionImage(key, value);
              const swatch = image ? null : colorSwatch(value);
              const popular = popularColor === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={isSelected && available}
                  disabled={!available}
                  title={!available ? OUT_OF_STOCK_LABEL : value}
                  aria-label={!available ? `${value} — ${OUT_OF_STOCK_LABEL}` : value}
                  aria-describedby={popular ? `popular-${key}` : undefined}
                  onClick={() => select(key, value)}
                  className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 bg-background p-[3px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:h-11 sm:w-11 ${
                    isSelected && available
                      ? "border-selected"
                      : available
                        ? "border-transparent hover:border-selected/50"
                        : "cursor-not-allowed border-dashed border-border opacity-50"
                  }`}
                >
                  {swatch ? (
                    <span
                      aria-hidden="true"
                      data-swatch={swatch}
                      className="block h-full w-full rounded-full ring-1 ring-inset ring-border"
                      style={{ backgroundColor: swatch }}
                    />
                  ) : image ? (
                    <img src={image} alt={value} loading="lazy" decoding="async" draggable={false} className="h-full w-full rounded-full object-cover" />
                  ) : (
                    <span aria-hidden="true" className="flex h-full w-full items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">{Array.from(value.replace(/^ال/, ""))[0]}</span>
                  )}
                  {popular && (
                    <span
                      id={`popular-${key}`}
                      className="pointer-events-none absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-selected px-1.5 py-px text-[0.5625rem] font-bold leading-tight text-selected-foreground shadow-sm sm:text-[0.625rem]"
                    >
                      شائع
                    </span>
                  )}
                  {!available && (
                    <span className="absolute -bottom-1 -left-1 rounded-full bg-background p-0.5 shadow-sm">
                      <LockKeyhole className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div key={key} className="space-y-2">
          <p className="text-sm text-foreground">
            <span className="font-bold">{key}:</span>{" "}
            <span className={selected[key] ? "font-semibold text-selected" : "text-muted-foreground"}>{selected[key] || "اختر"}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {attributeOptions[key].map((value) => {
              const isSelected = selected[key] === value;
              const available = isOptionAvailable(key, value);
              return (
                <button
                  key={value}
                  type="button"
                  className={`inline-flex h-9 min-w-[2.75rem] items-center justify-center rounded-full border bg-card px-3.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                    isSelected && available
                      ? "border-selected text-selected ring-1 ring-selected"
                      : "border-border text-foreground hover:border-selected/60"
                  } ${!available ? "cursor-not-allowed border-dashed text-muted-foreground opacity-50" : ""}`}
                  aria-pressed={isSelected && available}
                  disabled={!available}
                  title={!available ? OUT_OF_STOCK_LABEL : undefined}
                  aria-label={!available ? `${value} — ${OUT_OF_STOCK_LABEL}` : value}
                  onClick={() => select(key, value)}
                >
                  {value}
                  {!available && <LockKeyhole className="ms-1 h-3 w-3" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ProductVariantPicker;
