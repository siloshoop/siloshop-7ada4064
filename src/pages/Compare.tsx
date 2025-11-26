import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, X, Star, Package, DollarSign, Tag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Product {
  id: string;
  name: string;
  price: number;
  original_price: number | null;
  image_url: string;
  description: string | null;
  stock_quantity: number | null;
  categories: {
    name_ar: string;
  } | null;
}

const Compare = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchProducts();
  }, [searchParams]);

  const fetchProducts = async () => {
    const productIds = searchParams.get("products")?.split(",") || [];
    
    if (productIds.length === 0) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("products")
        .select(`
          *,
          categories(name_ar)
        `)
        .in("id", productIds)
        .eq("is_active", true);

      if (error) throw error;
      setProducts(data as any || []);
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل في تحميل المنتجات",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const removeProduct = (productId: string) => {
    const currentIds = searchParams.get("products")?.split(",") || [];
    const newIds = currentIds.filter(id => id !== productId);
    
    if (newIds.length === 0) {
      navigate("/");
    } else {
      setSearchParams({ products: newIds.join(",") });
    }
  };

  const calculateDiscount = (original: number | null, current: number) => {
    if (!original) return null;
    return Math.round(((original - current) / original) * 100);
  };

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

  if (products.length === 0) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <Package className="h-16 w-16 mx-auto text-muted-foreground" />
            <h2 className="text-2xl font-bold">لا توجد منتجات للمقارنة</h2>
            <Button onClick={() => navigate("/")}>العودة للرئيسية</Button>
          </div>
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
          <h1 className="text-3xl font-bold mb-2">مقارنة المنتجات</h1>
          <p className="text-muted-foreground">
            قارن بين {products.length} منتجات
          </p>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-max">
            <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(${products.length}, minmax(300px, 1fr))` }}>
              {products.map((product) => (
                <Card key={product.id} className="relative">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute top-2 left-2 z-10"
                    onClick={() => removeProduct(product.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  
                  <div className="relative aspect-square overflow-hidden rounded-t-lg">
                    {product.original_price && (
                      <Badge className="absolute top-2 right-2 z-10 bg-red-500">
                        خصم {calculateDiscount(product.original_price, product.price)}%
                      </Badge>
                    )}
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <CardContent className="p-6 space-y-4">
                    <h3 className="font-bold text-lg">{product.name}</h3>

                    <div className="space-y-3">
                      {/* السعر */}
                      <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                        <DollarSign className="h-5 w-5 text-primary" />
                        <div className="flex-1">
                          <p className="text-sm text-muted-foreground">السعر</p>
                          <div className="flex items-baseline gap-2">
                            <p className="text-xl font-bold text-primary">
                              {product.price} ل.س
                            </p>
                            {product.original_price && (
                              <p className="text-sm text-muted-foreground line-through">
                                {product.original_price} ل.س
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* الفئة */}
                      <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                        <Tag className="h-5 w-5 text-primary" />
                        <div>
                          <p className="text-sm text-muted-foreground">الفئة</p>
                          <p className="font-medium">
                            {product.categories?.name_ar || "غير محدد"}
                          </p>
                        </div>
                      </div>

                      {/* الكمية المتوفرة */}
                      <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                        <Package className="h-5 w-5 text-primary" />
                        <div>
                          <p className="text-sm text-muted-foreground">الكمية المتوفرة</p>
                          <p className="font-medium">
                            {product.stock_quantity || 0} قطعة
                          </p>
                        </div>
                      </div>

                      {/* الوصف */}
                      {product.description && (
                        <div className="p-3 bg-muted/50 rounded-lg">
                          <p className="text-sm text-muted-foreground mb-1">الوصف</p>
                          <p className="text-sm line-clamp-3">{product.description}</p>
                        </div>
                      )}
                    </div>

                    <Button 
                      className="w-full"
                      onClick={() => navigate(`/product/${product.id}`)}
                    >
                      عرض التفاصيل
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Compare;
