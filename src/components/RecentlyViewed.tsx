import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import ProductCard from "./ProductCard";
import { Loader2, History } from "lucide-react";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

interface Product {
  id: string;
  name: string;
  price: number;
  original_price: number | null;
  image_url: string;
  reviews: { rating: number }[];
}

const RecentlyViewed = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecentlyViewed = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const { data: recentItems } = await supabase
          .from("recently_viewed")
          .select(`
            product_id,
            viewed_at,
            products (
              id,
              name,
              price,
              original_price,
              image_url,
              is_active,
              reviews (rating)
            )
          `)
          .eq("user_id", user.id)
          .order("viewed_at", { ascending: false })
          .limit(8);

        const recentProducts: Product[] = (recentItems || [])
          .filter(item => item.products && (item.products as any).is_active)
          .map(item => ({
            id: (item.products as any).id,
            name: (item.products as any).name,
            price: (item.products as any).price,
            original_price: (item.products as any).original_price,
            image_url: (item.products as any).image_url,
            reviews: (item.products as any).reviews || []
          }));

        setProducts(recentProducts);
      } catch (error) {
        console.error("Error fetching recently viewed:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecentlyViewed();
  }, [user]);

  if (!user || loading) {
    return null;
  }

  if (products.length === 0) {
    return null;
  }

  const { ref, isVisible } = useScrollAnimation();

  return (
    <section 
      ref={ref as React.RefObject<HTMLElement>}
      className="py-12"
    >
      <div className="container px-4">
        <div className={`flex items-center gap-3 mb-8 transition-all duration-700 ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}`}>
          <div className="p-2 rounded-lg bg-secondary/50">
            <History className="h-6 w-6 text-foreground" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">شاهدتها مؤخراً</h2>
            <p className="text-muted-foreground text-sm">المنتجات التي زرتها مؤخراً</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product, index) => {
            const avgRating = product.reviews?.length
              ? product.reviews.reduce((sum, r) => sum + r.rating, 0) / product.reviews.length
              : 0;
            const discount = product.original_price
              ? Math.round(((product.original_price - product.price) / product.original_price) * 100)
              : undefined;

            return (
              <div
                key={product.id}
                className={`transition-all duration-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}
                style={{ transitionDelay: `${100 + index * 75}ms` }}
              >
                <ProductCard
                  id={product.id}
                  name={product.name}
                  price={product.price}
                  originalPrice={product.original_price || undefined}
                  image={product.image_url}
                  rating={avgRating}
                  reviews={product.reviews?.length || 0}
                  discount={discount}
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default RecentlyViewed;
