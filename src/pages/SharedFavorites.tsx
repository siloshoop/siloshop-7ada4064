import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Heart, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import { Button } from "@/components/ui/button";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SharedFavorites = () => {
  const [params] = useSearchParams();
  const ids = useMemo(
    () => Array.from(new Set((params.get("products") || "").split(",").map((s) => s.trim()).filter((s) => UUID.test(s)))).slice(0, 100),
    [params],
  );
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      if (!ids.length) { setProducts([]); setLoading(false); return; }
      const { data } = await supabase
        .from("products")
        .select("id, name, price, currency, original_price, image_url, stock_quantity")
        .in("id", ids);
      if (!active) return;
      const map = new Map((data || []).map((p: any) => [p.id, p]));
      setProducts(ids.map((id) => map.get(id)).filter(Boolean));
      setLoading(false);
    })();
    return () => { active = false; };
  }, [ids]);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto px-3 sm:px-4 py-6">
        <h1 className="text-xl sm:text-2xl font-bold mb-4 flex items-center gap-2">
          <Heart className="h-5 w-5 text-primary" /> قائمة مفضلة مشتركة
        </h1>
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : products.length === 0 ? (
          <div className="text-center py-16 space-y-4">
            <p className="text-muted-foreground">لا توجد منتجات متاحة في هذه القائمة</p>
            <Button asChild><Link to="/">تصفح المنتجات</Link></Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
            {products.map((p) => (
              <ProductCard
                key={p.id}
                id={p.id}
                name={p.name}
                price={p.price}
                currency={p.currency}
                originalPrice={p.original_price || undefined}
                image={p.image_url}
                rating={0}
                reviews={0}
                stockQuantity={p.stock_quantity}
                discount={p.original_price ? Math.round(((p.original_price - p.price) / p.original_price) * 100) : undefined}
              />
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default SharedFavorites;
