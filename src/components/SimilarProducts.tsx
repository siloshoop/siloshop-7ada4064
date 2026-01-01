import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import ProductCard from "./ProductCard";
import { Loader2 } from "lucide-react";

interface SimilarProductsProps {
  productId: string;
  categoryId: string | null;
  vendorId: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  original_price: number | null;
  image_url: string | null;
  vendor_id: string;
  reviews: { rating: number }[];
}

const SimilarProducts = ({ productId, categoryId, vendorId }: SimilarProductsProps) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSimilarProducts = async () => {
      try {
        let query = supabase
          .from("products")
          .select("id, name, price, original_price, image_url, vendor_id, reviews(rating)")
          .eq("is_active", true)
          .neq("id", productId)
          .limit(8);

        // Prioritize same category products
        if (categoryId) {
          query = query.eq("category_id", categoryId);
        }

        const { data, error } = await query;
        
        if (error) throw error;

        // If not enough products from same category, fetch from same vendor
        if ((!data || data.length < 4) && vendorId) {
          const { data: vendorProducts } = await supabase
            .from("products")
            .select("id, name, price, original_price, image_url, vendor_id, reviews(rating)")
            .eq("is_active", true)
            .eq("vendor_id", vendorId)
            .neq("id", productId)
            .limit(8);

          const existingIds = new Set(data?.map(p => p.id) || []);
          const additionalProducts = vendorProducts?.filter(p => !existingIds.has(p.id)) || [];
          setProducts([...(data || []), ...additionalProducts].slice(0, 8));
        } else {
          setProducts(data || []);
        }
      } catch (error) {
        console.error("Error fetching similar products:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSimilarProducts();
  }, [productId, categoryId, vendorId]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (products.length === 0) return null;

  return (
    <section className="mt-12">
      <h2 className="text-2xl font-bold mb-6">منتجات مشابهة</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {products.map((product) => {
          const avgRating = product.reviews && product.reviews.length > 0
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
              image={product.image_url || "/placeholder.svg"}
              rating={avgRating}
              reviews={product.reviews?.length || 0}
              discount={discount}
            />
          );
        })}
      </div>
    </section>
  );
};

export default SimilarProducts;
