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
  const [isVisible, setIsVisible] = useState(false);
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
        // Get products with most order items (best sellers)
        const { data: orderItems } = await supabase
          .from("order_items")
          .select("product_id, quantity");

        // Count sales per product
        const salesCount: Record<string, number> = {};
        orderItems?.forEach((item) => {
          salesCount[item.product_id] = (salesCount[item.product_id] || 0) + item.quantity;
        });

        // Get top 8 product IDs by sales
        const topProductIds = Object.entries(salesCount)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 8)
          .map(([id]) => id);

        if (topProductIds.length === 0) {
          // If no sales yet, show newest products
          const { data: newProducts } = await supabase
            .from("products")
            .select("id, name, price, original_price, image_url, reviews(rating)")
            .eq("is_active", true)
            .order("created_at", { ascending: false })
            .limit(8);

          setProducts((newProducts || []).map(p => ({ ...p, sales_count: 0 })));
        } else {
          // Fetch product details for best sellers
          const { data: productData } = await supabase
            .from("products")
            .select("id, name, price, original_price, image_url, reviews(rating)")
            .eq("is_active", true)
            .in("id", topProductIds);

          const productsWithSales = (productData || []).map(p => ({
            ...p,
            sales_count: salesCount[p.id] || 0
          })).sort((a, b) => b.sales_count - a.sales_count);

          setProducts(productsWithSales);
        }
      } catch (error) {
        console.error("Error fetching best sellers:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchBestSellers();
  }, []);

  if (loading) {
    return (
      <section className="py-12 bg-muted/30">
        <div className="container px-4">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </div>
      </section>
    );
  }

  if (products.length === 0) {
    return null;
  }

  return (
    <section ref={sectionRef} className="py-12 bg-muted/30">
      <div className="container px-4">
        <div className={`flex items-center gap-3 mb-8 transition-all duration-700 ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}`}>
          <div className="p-2 rounded-lg bg-primary/10">
            <TrendingUp className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">الأكثر مبيعاً</h2>
            <p className="text-muted-foreground text-sm">المنتجات الأكثر طلباً من عملائنا</p>
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
                className={`transition-all duration-500 hover:scale-105 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}
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
