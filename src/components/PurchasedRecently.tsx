import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Package, ShoppingCart, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PurchasedProduct {
  id: string;
  name: string;
  price: number;
  image_url: string;
  quantity: number;
  order_date: string;
}

const PurchasedRecently = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [products, setProducts] = useState<PurchasedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [reordering, setReordering] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchPurchasedProducts();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchPurchasedProducts = async () => {
    try {
      const { data: orders } = await supabase
        .from("orders")
        .select(`
          id,
          created_at,
          order_items (
            quantity,
            product_id,
            products (
              id,
              name,
              price,
              image_url
            )
          )
        `)
        .eq("customer_id", user?.id)
        .eq("status", "delivered")
        .order("created_at", { ascending: false })
        .limit(10);

      if (orders) {
        const purchasedProducts: PurchasedProduct[] = [];
        const seenProductIds = new Set<string>();

        orders.forEach((order: any) => {
          order.order_items?.forEach((item: any) => {
            if (item.products && !seenProductIds.has(item.products.id)) {
              seenProductIds.add(item.products.id);
              purchasedProducts.push({
                id: item.products.id,
                name: item.products.name,
                price: item.products.price,
                image_url: item.products.image_url,
                quantity: item.quantity,
                order_date: order.created_at,
              });
            }
          });
        });

        setProducts(purchasedProducts.slice(0, 8));
      }
    } catch (error) {
      console.error("Error fetching purchased products:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleReorder = async (product: PurchasedProduct) => {
    if (!user) {
      navigate("/auth");
      return;
    }

    setReordering(product.id);
    try {
      // Check if already in cart
      const { data: existingItem } = await supabase
        .from("cart_items")
        .select("id, quantity")
        .eq("user_id", user.id)
        .eq("product_id", product.id)
        .single();

      if (existingItem) {
        // Update quantity
        await supabase
          .from("cart_items")
          .update({ quantity: existingItem.quantity + 1 })
          .eq("id", existingItem.id);
      } else {
        // Add new item
        await supabase.from("cart_items").insert({
          user_id: user.id,
          product_id: product.id,
          quantity: 1,
        });
      }

      toast({
        title: "تمت الإضافة",
        description: "تم إضافة المنتج إلى السلة",
      });
    } catch (error) {
      console.error("Error reordering:", error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء إضافة المنتج",
        variant: "destructive",
      });
    } finally {
      setReordering(null);
    }
  };

  if (!user || loading) {
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
    return null;
  }

  if (products.length === 0) {
    return null;
  }

  return (
    <section className="py-12 bg-gradient-to-b from-muted/30 to-background">
      <div className="container px-4">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Package className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">اشتريته مؤخراً</h2>
              <p className="text-muted-foreground text-sm">اطلب مرة أخرى بنقرة واحدة</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => navigate("/orders")}>
            عرض جميع الطلبات
          </Button>
        </div>

        <div className="relative">
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory">
            {products.map((product) => (
              <Card
                key={product.id}
                className="flex-shrink-0 w-[200px] snap-start overflow-hidden group hover:shadow-lg transition-all duration-300"
              >
                <div 
                  className="relative aspect-square cursor-pointer overflow-hidden"
                  onClick={() => navigate(`/product/${product.id}`)}
                >
                  <img
                    src={product.image_url || "/placeholder.svg"}
                    alt={product.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                </div>
                
                <div className="p-3 space-y-2">
                  <h3 
                    className="font-medium text-sm line-clamp-2 cursor-pointer hover:text-primary transition-colors"
                    onClick={() => navigate(`/product/${product.id}`)}
                  >
                    {product.name}
                  </h3>
                  
                  <p className="text-primary font-bold text-lg">
                    {product.price.toLocaleString()} ل.س
                  </p>
                  
                  <Button
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => handleReorder(product)}
                    disabled={reordering === product.id}
                  >
                    {reordering === product.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4" />
                        اطلب مرة أخرى
                      </>
                    )}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default PurchasedRecently;
