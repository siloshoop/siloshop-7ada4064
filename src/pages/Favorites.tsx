import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Heart, ShoppingCart, Share2, Wallet, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Product {
  id: string;
  name: string;
  price: number;
  original_price: number | null;
  image_url: string;
  stock_quantity: number;
  category_id: string | null;
  category_name?: string;
}

const Favorites = () => {
  const { user, loading: authLoading } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingAll, setAddingAll] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

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
            stock_quantity,
            category_id,
            categories ( name_ar )
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (data) {
        setProducts(
          data
            .map((f: any) => {
              const p = f.products;
              if (!p) return null;
              return { ...p, category_name: p.categories?.name_ar || "أخرى" };
            })
            .filter(Boolean) as Product[]
        );
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

  const grouped = useMemo(() => {
    const map = new Map<string, Product[]>();
    products.forEach((p) => {
      const key = p.category_name || "أخرى";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    });
    return Array.from(map.entries());
  }, [products]);

  const totalValue = useMemo(
    () => products.reduce((s, p) => s + Number(p.price || 0), 0),
    [products]
  );

  const addAllToCart = async () => {
    if (!user) return navigate("/auth");
    const inStock = products.filter((p) => (p.stock_quantity ?? 0) > 0);
    if (inStock.length === 0) {
      toast({ title: "لا توجد منتجات متاحة", variant: "destructive" });
      return;
    }
    setAddingAll(true);
    try {
      const { data: existing } = await supabase
        .from("cart_items")
        .select("product_id, quantity")
        .eq("user_id", user.id)
        .in("product_id", inStock.map((p) => p.id));
      const existingMap = new Map((existing || []).map((c: any) => [c.product_id, c.quantity]));
      const toInsert = inStock
        .filter((p) => !existingMap.has(p.id))
        .map((p) => ({ user_id: user.id, product_id: p.id, quantity: 1 }));
      const toUpdate = inStock.filter((p) => existingMap.has(p.id));

      if (toInsert.length > 0) {
        await supabase.from("cart_items").insert(toInsert);
      }
      for (const p of toUpdate) {
        await supabase
          .from("cart_items")
          .update({ quantity: (existingMap.get(p.id) as number) + 1 })
          .eq("user_id", user.id)
          .eq("product_id", p.id);
      }
      toast({ title: "تمت الإضافة", description: `أُضيف ${inStock.length} منتج إلى السلة` });
      window.dispatchEvent(new Event("cart:updated"));
    } catch (e) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally {
      setAddingAll(false);
    }
  };

  const shareList = async () => {
    const url = window.location.href;
    const text = `قائمة مفضلتي (${products.length} منتج) — ${totalValue.toLocaleString()} ل.س`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "مفضلتي", text, url });
      } else {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        toast({ title: "تم النسخ", description: "تم نسخ رابط القائمة" });
      }
    } catch {}
  };

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
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/15"><Package className="h-5 w-5 text-primary" /></div>
                  <div>
                    <p className="text-xs text-muted-foreground">عدد المنتجات</p>
                    <p className="text-xl font-bold">{products.length}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-accent/10 to-accent/5 border-accent/20">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-accent/15"><Wallet className="h-5 w-5 text-accent" /></div>
                  <div>
                    <p className="text-xs text-muted-foreground">إجمالي قيمة المفضلة</p>
                    <p className="text-xl font-bold">{totalValue.toLocaleString()} ل.س</p>
                  </div>
                </CardContent>
              </Card>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button onClick={addAllToCart} disabled={addingAll} className="flex-1">
                  {addingAll ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <ShoppingCart className="h-4 w-4 ml-2" />}
                  أضف الكل للسلة
                </Button>
                <Button variant="outline" onClick={shareList} className="flex-1">
                  <Share2 className="h-4 w-4 ml-2" />
                  مشاركة
                </Button>
              </div>
            </div>

            <div className="space-y-8">
              {grouped.map(([catName, items]) => (
                <section key={catName}>
                  <div className="flex items-center gap-2 mb-3">
                    <h2 className="text-lg font-bold">{catName}</h2>
                    <span className="text-sm text-muted-foreground">({items.length})</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {items.map((product) => (
                      <ProductCard
                        key={product.id}
                        id={product.id}
                        name={product.name}
                        price={product.price}
                        originalPrice={product.original_price || undefined}
                        image={product.image_url}
                        rating={4}
                        reviews={0}
                        stockQuantity={product.stock_quantity}
                        discount={product.original_price ? Math.round(((product.original_price - product.price) / product.original_price) * 100) : undefined}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Favorites;
