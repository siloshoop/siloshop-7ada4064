import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import ProductCard from "./ProductCard";
import { Loader2, Sparkles } from "lucide-react";

interface Product {
  id: string;
  name: string;
  price: number;
  original_price?: number;
  image_url: string;
  vendor_id: string;
  category_id?: string;
}

interface CartRecommendationsProps {
  cartProductIds: string[];
  cartCategoryIds: string[];
}

const CartRecommendations = ({ cartProductIds, cartCategoryIds }: CartRecommendationsProps) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecommendations = async () => {
      if (cartCategoryIds.length === 0) {
        setLoading(false);
        return;
      }

      try {
        // Get products from same categories but not in cart
        const { data, error } = await supabase
          .from("products")
          .select("id, name, price, original_price, image_url, vendor_id, category_id")
          .in("category_id", cartCategoryIds)
          .not("id", "in", `(${cartProductIds.join(",")})`)
          .eq("is_active", true)
          .limit(8);

        if (error) throw error;
        setProducts(data || []);
      } catch (error) {
        console.error("Error fetching cart recommendations:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendations();
  }, [cartProductIds, cartCategoryIds]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (products.length === 0) {
    return null;
  }

  return (
    <div className="mt-12">
      <div className="flex items-center gap-2 mb-6">
        <Sparkles className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-bold">منتجات قد تعجبك</h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            id={product.id}
            name={product.name}
            price={product.price}
            originalPrice={product.original_price}
            image={product.image_url}
            rating={0}
            reviews={0}
          />
        ))}
      </div>
    </div>
  );
};

export default CartRecommendations;
