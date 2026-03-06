import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import ProductCard from "./ProductCard";
import { Loader2, TrendingUp } from "lucide-react";

interface Product {
  id: string;
  name: string;
  price: number;
  original_price: number | null;
  image_url: string;
  reviews: { rating: number }[];
}

interface BestSellerProduct extends Product {
  sales_count: number;
}

const BestSellers = () => {
  const [products, setProducts] = useState<BestSellerProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [isVisible, setIsVisible] = useState(true);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const fetchBestSellers = async () => {
      try {
        // Since order_items requires authentication, we'll just show newest products
        // as "best sellers" for non-authenticated users
        const { data: newProducts } = await supabase
          .from("products")
          .select("id, name, price, original_price, image_url, reviews(rating)")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(8);

        setProducts((newProducts || []).map(p => ({ ...p, sales_count: 0 })));
      } catch (error) {
        console.error("Error fetching best sellers:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchBestSellers();
  }, []);

  // Return null while loading to prevent gap, unless we know there's content
  if (loading) {
    return null;
  }

  if (products.length === 0) {
    return null;
  }

  return (
    <section ref={sectionRef} className="py-6 bg-muted/30">
      <div className="container px-4">
        <div className={`flex items-center gap-2 mb-4 transition-all duration-700 ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}`}>
          <div className="p-1.5 rounded-lg bg-primary/10">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg md:text-xl font-bold">الأكثر مبيعاً</h2>
            <p className="text-muted-foreground text-xs">المنتجات الأكثر طلباً</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
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
                className={`transition-all duration-500 hover-lift card-glow ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}
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

export default BestSellers;
