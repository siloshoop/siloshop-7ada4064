import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ProductCard from "@/components/ProductCard";
import SectionHeader from "@/components/home/SectionHeader";
import { useVendorNames } from "@/hooks/useVendorNames";

export type RailVariant = "new_arrivals" | "todays_offers";

interface ProductRow {
  id: string;
  name: string;
  price: number;
  original_price: number | null;
  discount_price: number | null;
  image_url: string;
  shipping_cost: number | null;
  stock_quantity: number | null;
  vendor_id: string;
  product_type: string | null;
  ships_within_days: number | null;
  reviews: { rating: number }[] | null;
}

interface ProductRailProps {
  variant: RailVariant;
  icon?: LucideIcon;
  eyebrow: string;
  title: string;
  subtitle?: string;
  href?: string;
  tone?: "primary" | "accent" | "success";
  limit?: number;
}

const SELECT =
  "id, name, price, original_price, discount_price, image_url, shipping_cost, stock_quantity, vendor_id, product_type, ships_within_days, reviews(rating)";

const ProductRail = ({
  variant,
  icon,
  eyebrow,
  title,
  subtitle,
  href,
  tone = "primary",
  limit = 10,
}: ProductRailProps) => {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const sectionRef = useRef<HTMLElement>(null);
  const storeNames = useVendorNames(products.map((p) => p.vendor_id));

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        // `todays_offers` is filtered client-side (discount vs. original price)
        // so it fetches a wider window before trimming.
        const { data } = await supabase
          .from("products")
          .select(SELECT)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(variant === "todays_offers" ? limit * 4 : limit);
        if (cancelled) return;

        const rows = ((data ?? []) as unknown as ProductRow[]).filter((row) =>
          variant === "todays_offers"
            ? row.original_price != null && row.original_price > row.price
            : true,
        ).slice(0, limit);
        setProducts(rows);
      } catch (error) {
        console.error(`ProductRail(${variant}) error:`, error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [variant, limit]);

  if (!loading && products.length === 0) return null;

  return (
    <section ref={sectionRef} className="py-7">
      <div className="container px-4">
        <SectionHeader
          icon={icon}
          eyebrow={eyebrow}
          title={title}
          subtitle={subtitle}
          href={href}
          tone={tone}
        />

        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {products.map((product, i) => {
              const effectivePrice = product.discount_price ?? product.price;
              const base = product.original_price ?? undefined;
              const ratings = product.reviews ?? [];
              const avg =
                ratings.length > 0
                  ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
                  : 0;

              return (
                <div
                  key={product.id}
                  className="w-[46%] shrink-0 snap-start animate-fade-in sm:w-[31%] lg:w-[23%] xl:w-[19%]"
                  style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                >
                  <ProductCard
                    id={product.id}
                    name={product.name}
                    price={effectivePrice}
                    originalPrice={base && base > effectivePrice ? base : undefined}
                    image={product.image_url}
                    rating={avg}
                    reviews={ratings.length}
                    shippingCost={product.shipping_cost ?? undefined}
                    stockQuantity={product.stock_quantity}
                    storeName={storeNames[product.vendor_id]}
                    productType={product.product_type}
                    shipsWithinDays={product.ships_within_days}
                    discount={
                      base && base > effectivePrice
                        ? Math.round(((base - effectivePrice) / base) * 100)
                        : undefined
                    }
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

export default ProductRail;
