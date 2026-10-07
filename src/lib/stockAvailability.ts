export interface StockVariant {
  attributes: unknown;
  stock_quantity: number;
  is_active?: boolean;
}

export const variantInStock = (variant: StockVariant) =>
  variant.is_active !== false && variant.stock_quantity > 0;

export const optionInStock = (
  variants: StockVariant[],
  selected: Record<string, string>,
  key: string,
  value: string,
) => {
  const candidate = { ...selected, [key]: value };
  return variants.some((variant) => {
    const attrs = (variant.attributes || {}) as Record<string, string>;
    return variantInStock(variant) && attrs[key] === value &&
      Object.entries(candidate).every(([k, val]) => !val || attrs[k] === val);
  });
};

export const availableProductStock = (stock: number | null, variants: StockVariant[]) =>
  variants.length ? variants.reduce((sum, v) => sum + (variantInStock(v) ? v.stock_quantity : 0), 0) : (stock ?? 0);