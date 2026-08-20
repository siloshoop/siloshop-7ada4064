import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ProductCard from "@/components/ProductCard";
import SectionHeader from "@/components/home/SectionHeader";
import { ProductRailSkeleton } from "@/components/skeletons/ProductSkeletons";

interface ProductRow {
  id: string;
  name: string;
  price: number;
  original_price: number | null;
  image_url: string;
  reviews: { rating: number }[] | null;
}

interface RankedProduct extends ProductRow {
  avgRating: number;
  reviewsCount: number;
}

const TopRatedProducts = () => {
  const [products, setProducts] = useState<RankedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const { data } = await supabase
          .from("products")
          .select("id, name, price, original_price, image_url, reviews(rating)")
          .eq("is_active", true)
          .eq("moderation_status", "approved");
        if (cancelled) return;

        const ranked = ((data ?? []) as unknown as ProductRow[])
          .map((p) => {
            const ratings = p.reviews ?? [];
            const avgRating =
              ratings.length > 0
                ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
                : 0;
            return { ...p, avgRating, reviewsCount: ratings.length };
          })
          .filter((p) => p.reviewsCount >= 1)
          .sort((a, b) => b.avgRating - a.avgRating || b.reviewsCount - a.reviewsCount)
          .slice(0, 12);

        setProducts(ranked);
      } catch (error) {
        console.error("TopRatedProducts error:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loading && products.length === 0) return null;

  return (
    <section className="py-7">
      <div className="container px-4">
        <SectionHeader
          icon={Star}
          eyebrow="الأعلى تقييماً"
          title="منتجات الأعلى تقييماً"
          subtitle="اختيارات وثق بها عملاؤنا"
          tone="accent"
        />

        {loading ? (
          <ProductRailSkeleton />
        ) : (
          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {products.map((product, i) => (
              <div
                key={product.id}
                className="w-[46%] shrink-0 snap-start animate-fade-in sm:w-[31%] lg:w-[23%] xl:w-[19%]"
                style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
              >
                <ProductCard
                  id={product.id}
                  name={product.name}
                  price={product.price}
                  originalPrice={product.original_price || undefined}
                  image={product.image_url}
                  rating={product.avgRating}
                  reviews={product.reviewsCount}
                  discount={
                    product.original_price
                      ? Math.round(
                          ((product.original_price - product.price) / product.original_price) * 100,
                        )
                      : undefined
                  }
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default TopRatedProducts;
