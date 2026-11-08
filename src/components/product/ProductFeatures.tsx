import { parseFeatures } from "@/lib/productFeatures";

/** Buyer-facing «ميزات المنتج» section; renders nothing when the seller saved no features. */
const ProductFeatures = ({
  features,
  dimensions,
}: {
  features: unknown;
  /** Saved length/width shown first so buyers see the size without opening the specifications tab. */
  dimensions?: { label: string; value: string } | null;
}) => {
  const items = [
    ...(dimensions ? [{ title: dimensions.label, value: dimensions.value }] : []),
    ...parseFeatures(features),
  ];
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="product-features-heading" className="mt-8">
      <h2 id="product-features-heading" className="mb-3 text-lg font-bold md:text-xl">
        ميزات المنتج
      </h2>
      <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((f, i) => (
          <div key={`${f.title}-${i}`} className="min-w-0 rounded-xl bg-muted/40 px-3 py-2.5">
            <dt dir="auto" className="break-words text-xs text-muted-foreground">
              {f.title}
            </dt>
            <dd dir="auto" className="mt-0.5 break-words text-sm font-semibold text-foreground">
              {f.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
};

export default ProductFeatures;
