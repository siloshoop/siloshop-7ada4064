import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import { Loader2 } from "lucide-react";

interface Product {
  id: string;
  name: string;
  price: number;
  original_price: number | null;
  image_url: string;
  reviews: { rating: number }[];
}

const Category = () => {
  const { categoryId } = useParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categoryName, setCategoryName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCategoryProducts = async () => {
      // Fetch category info
      const { data: categoryData } = await supabase
        .from("categories")
        .select("name_ar")
        .eq("id", categoryId)
        .maybeSingle();

      if (categoryData) {
        setCategoryName(categoryData.name_ar);
      }

      // Fetch products
      const { data: productsData } = await supabase
        .from("products")
        .select(`
          id,
          name,
          price,
          original_price,
          image_url,
          reviews(rating)
        `)
        .eq("category_id", categoryId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (productsData) {
        setProducts(productsData as any);
      }
      setLoading(false);
    };

    if (categoryId) {
      fetchCategoryProducts();
    }
  }, [categoryId]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{categoryName || "الفئة"}</h1>
          <p className="text-muted-foreground">{products.length} منتج</p>
        </div>

        {products.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-lg">لا توجد منتجات في هذه الفئة</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product) => {
              const avgRating = product.reviews?.length > 0
                ? product.reviews.reduce((sum, r) => sum + r.rating, 0) / product.reviews.length
                : 4;
              
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
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Category;
