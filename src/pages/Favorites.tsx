import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import { Loader2, Heart } from "lucide-react";

interface Product {
  id: string;
  name: string;
  price: number;
  original_price: number | null;
  image_url: string;
  stock_quantity: number;
}

const Favorites = () => {
  const { user, loading: authLoading } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const fetchFavorites = async () => {
      if (!user) return;

      const { data } = await supabase
        .from("favorites")
        .select(`
          product_id,
          products (
            id,
            name,
            price,
            original_price,
            image_url,
            stock_quantity
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (data) {
        setProducts(data.map(f => f.products as any).filter(Boolean));
      }
      setLoading(false);
    };

    fetchFavorites();

    // Subscribe to changes
    const channel = supabase
      .channel('favorites-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'favorites',
          filter: `user_id=eq.${user?.id}`
        },
        () => fetchFavorites()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  if (authLoading || loading) {
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
          <div className="flex items-center gap-3 mb-2">
            <Heart className="h-8 w-8 text-primary fill-primary" />
            <h1 className="text-3xl font-bold">المفضلة</h1>
          </div>
          <p className="text-muted-foreground">
            {products.length} منتج
          </p>
        </div>

        {products.length === 0 ? (
          <div className="text-center py-12">
            <Heart className="h-24 w-24 text-muted-foreground/20 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold mb-2">لا توجد منتجات مفضلة</h2>
            <p className="text-muted-foreground mb-6">
              ابدأ بإضافة منتجات إلى قائمة المفضلة لتجدها هنا
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                id={product.id}
                name={product.name}
                price={product.price}
                originalPrice={product.original_price || undefined}
                image={product.image_url}
                rating={4}
                reviews={0}
                discount={product.original_price ? Math.round(((product.original_price - product.price) / product.original_price) * 100) : undefined}
              />
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Favorites;
