import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import ProductCard from "./ProductCard";
import { Loader2, Sparkles } from "lucide-react";

interface Product {
  id: string;
  name: string;
  price: number;
  original_price: number | null;
  image_url: string;
  category_id: string | null;
  reviews: { rating: number }[];
}

const ProductRecommendations = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        let categoryIds: string[] = [];
        
        if (user) {
          // Get categories from user's recently viewed products
          const { data: recentViewed } = await supabase
            .from("recently_viewed")
            .select("products(category_id)")
            .eq("user_id", user.id)
            .order("viewed_at", { ascending: false })
            .limit(10);

          const viewedCategories = (recentViewed || [])
            .map(item => (item.products as any)?.category_id)
            .filter(Boolean);

          // Get categories from user's favorites
          const { data: favorites } = await supabase
            .from("favorites")
            .select("products(category_id)")
            .eq("user_id", user.id)
            .limit(10);

          const favoriteCategories = (favorites || [])
            .map(item => (item.products as any)?.category_id)
            .filter(Boolean);

          // Get categories from user's orders
          const { data: orders } = await supabase
            .from("orders")
            .select("order_items(products(category_id))")
            .eq("customer_id", user.id)
            .limit(5);

          const orderCategories = (orders || [])
            .flatMap(order => (order.order_items || []))
            .map(item => (item.products as any)?.category_id)
            .filter(Boolean);

          // Combine all categories and get unique ones
          categoryIds = [...new Set([...viewedCategories, ...favoriteCategories, ...orderCategories])];
        }

        let query = supabase
          .from("products")
          .select("id, name, price, original_price, image_url, category_id, reviews(rating)")
          .eq("is_active", true);

        if (categoryIds.length > 0) {
          // Get products from preferred categories, excluding already viewed
          const { data: viewedProductIds } = user ? await supabase
            .from("recently_viewed")
            .select("product_id")
            .eq("user_id", user.id) : { data: [] };

          const excludeIds = (viewedProductIds || []).map(v => v.product_id);

          query = query.in("category_id", categoryIds);
          
          if (excludeIds.length > 0) {
            query = query.not("id", "in", `(${excludeIds.join(",")})`);
          }
        }

        const { data: recommendedProducts } = await query
          .order("created_at", { ascending: false })
          .limit(8);

        // If not enough products, fill with popular products
        if ((recommendedProducts || []).length < 4) {
          const { data: popularProducts } = await supabase
            .from("products")
            .select("id, name, price, original_price, image_url, category_id, reviews(rating)")
            .eq("is_active", true)
            .order("created_at", { ascending: false })
            .limit(8);

          setProducts(popularProducts || []);
        } else {
          setProducts(recommendedProducts || []);
        }
      } catch (error) {
        console.error("Error fetching recommendations:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendations();
  }, [user]);

  if (loading) {
    return (
      <section className="py-12">
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
    <section className="py-12">
      <div className="container px-4">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 rounded-lg bg-accent/20">
            <Sparkles className="h-6 w-6 text-accent" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">موصى به لك</h2>
            <p className="text-muted-foreground text-sm">منتجات مختارة بناءً على اهتماماتك</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product) => {
            const avgRating = product.reviews?.length
              ? product.reviews.reduce((sum, r) => sum + r.rating, 0) / product.reviews.length
              : 0;
            const discount = product.original_price
              ? Math.round(((product.original_price - product.price) / product.original_price) * 100)
              : undefined;

            return (
              <ProductCard
                key={product.id}
                id={product.id}
                name={product.name}
                price={product.price}
                originalPrice={product.original_price || undefined}
                image={product.image_url}
                rating={avgRating}
                reviews={product.reviews?.length || 0}
                discount={discount}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default ProductRecommendations;
