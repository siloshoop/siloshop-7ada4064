import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Database } from "@/integrations/supabase/types";

type ProductVariant = Database["public"]["Tables"]["product_variants"]["Row"];

interface ProductVariantPickerProps {
  variants: ProductVariant[];
  onSelect: (variant: ProductVariant | null) => void;
}

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
    onSelect(matchingVariant);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchingVariant]);

  const isOptionAvailable = (key: string, value: string) => {
    const candidate = { ...selected, [key]: value };
    return variants.some((v) => {
      const attrs = (v.attributes || {}) as Record<string, string>;
      const matchesSelected = Object.entries(candidate).every(
        ([k, val]) => attrs[k] === undefined || attrs[k] === val
      );
      return matchesSelected && attrs[key] === value && v.stock_quantity > 0;
    });
  };

  if (attributeKeys.length === 0) return null;

  return (
    <div className="space-y-4">
      {attributeKeys.map((key) => (
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
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  className="rounded-full"
                  disabled={!available}
                  onClick={() =>
                    setSelected((prev) => ({
                      ...prev,
                      [key]: prev[key] === value ? "" : value,
                    }))
                  }
                >
                  {value}
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
