interface Props {
  product: Record<string, any>;
  vendorName?: string | null;
  categoryName?: string | null;
  brandName?: string | null;
}

/** Specifications table built from the product row + its custom `specs` JSON. */
const ProductSpecs = ({ product, vendorName, categoryName, brandName }: Props) => {
  const custom = (product.specs && typeof product.specs === "object" ? product.specs : {}) as Record<
    string,
    unknown
  >;

  const rows: [string, string][] = [];
  const push = (label: string, value: unknown) => {
    if (value === null || value === undefined || value === "" ) return;
    if (Array.isArray(value)) {
      if (value.length === 0) return;
      rows.push([label, value.join(" · ")]);
      return;
    }
    rows.push([label, String(value)]);
  };

  push("اسم المنتج", product.name);
  push("رمز المنتج (SKU)", product.sku);
  push("الماركة", brandName);
  push("الفئة", categoryName);
  push("البائع", product.product_type === "platform" ? "سيلو شوب" : vendorName);
  push("نوع المنتج", product.product_type === "platform" ? "منتج مستورد (تركيا)" : "منتج بائع محلي");
  push("المقاسات المتوفرة", product.sizes);
  push("الألوان المتوفرة", product.colors);
  push("الوزن", product.weight ? `${product.weight} كغ` : null);
  push(
    "التوفر",
    product.stock_quantity > 0 ? `${product.stock_quantity} قطعة متوفرة` : "غير متوفر",
  );
  push(
    "تكلفة الشحن",
    product.shipping_cost && Number(product.shipping_cost) > 0
      ? `${Number(product.shipping_cost).toLocaleString()} ل.س`
      : "شحن مجاني",
  );
  push(
    "مدة الشحن",
    product.ships_within_days ? `خلال ${product.ships_within_days} أيام` : null,
  );
  push("العملة", product.currency === "SYP" || !product.currency ? "ليرة سورية (ل.س)" : product.currency);

  Object.entries(custom).forEach(([k, v]) => push(k, v));

  return (
    <div className="max-w-3xl overflow-hidden rounded-2xl border">
      <dl className="divide-y">
        {rows.map(([label, value], i) => (
          <div
            key={label}
            className={`grid grid-cols-3 gap-3 p-3 text-sm ${i % 2 ? "bg-muted/30" : ""}`}
          >
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="col-span-2 font-medium">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
};

export default ProductSpecs;
