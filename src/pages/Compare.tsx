import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Loader2, X, Star, Package, DollarSign, Tag, ShoppingCart, 
  User, Check, Minus, TrendingDown, Scale, Heart 
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { FavoriteButton } from "@/components/FavoriteButton";

interface Product {
  id: string;
  name: string;
  price: number;
  original_price: number | null;
  image_url: string;
  description: string | null;
  stock_quantity: number | null;
  vendor_id: string;
  categories: {
    name_ar: string;
  } | null;
  subcategories: {
    name_ar: string;
  } | null;
  reviews: {
    rating: number;
  }[];
  vendor: {
    full_name: string;
  } | null;
}

interface ComparisonRow {
  label: string;
  icon: React.ReactNode;
  getValue: (product: Product) => React.ReactNode;
  highlight?: "lowest" | "highest";
}

const Compare = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingToCart, setAddingToCart] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

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
          categories(name_ar),
          subcategories(name_ar),
          reviews(rating)
        `)
        .in("id", productIds)
        .eq("is_active", true);

      if (error) throw error;

      // Fetch vendor info for each product
      const productsWithVendors = await Promise.all(
        (data || []).map(async (product) => {
          const { data: vendorInfo } = await supabase
            .rpc("get_vendor_public_info", { vendor_id: product.vendor_id });
          return {
            ...product,
            vendor: vendorInfo?.[0] || null,
          };
        })
      );

      setProducts(productsWithVendors as Product[]);
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

  const addToCart = async (productId: string) => {
    if (!user) {
      navigate("/auth");
      return;
    }

    setAddingToCart(productId);
    try {
      const { error } = await supabase
        .from("cart_items")
        .upsert({
          user_id: user.id,
          product_id: productId,
          quantity: 1,
        });

      if (error) throw error;

      toast({
        title: "تمت الإضافة",
        description: "تم إضافة المنتج إلى السلة",
      });
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setAddingToCart(null);
    }
  };

  const calculateDiscount = (original: number | null, current: number) => {
    if (!original) return null;
    return Math.round(((original - current) / original) * 100);
  };

  const getAverageRating = (reviews: { rating: number }[]) => {
    if (!reviews || reviews.length === 0) return 0;
    return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  };

  const getLowestPrice = () => Math.min(...products.map(p => p.price));
  const getHighestRating = () => Math.max(...products.map(p => getAverageRating(p.reviews)));
  const getHighestStock = () => Math.max(...products.map(p => p.stock_quantity || 0));
  const getHighestDiscount = () => Math.max(...products.map(p => calculateDiscount(p.original_price, p.price) || 0));

  const comparisonRows: ComparisonRow[] = [
    {
      label: "السعر",
      icon: <DollarSign className="h-5 w-5" />,
      getValue: (product) => (
        <div className="text-center">
          <p className={`text-xl font-bold ${product.price === getLowestPrice() ? "text-green-600" : "text-foreground"}`}>
            {product.price} ل.س
          </p>
          {product.original_price && (
            <p className="text-sm text-muted-foreground line-through">
              {product.original_price} ل.س
            </p>
          )}
          {product.price === getLowestPrice() && products.length > 1 && (
            <Badge className="mt-1 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
              <TrendingDown className="h-3 w-3 ml-1" />
              الأقل سعراً
            </Badge>
          )}
        </div>
      ),
      highlight: "lowest",
    },
    {
      label: "الخصم",
      icon: <Tag className="h-5 w-5" />,
      getValue: (product) => {
        const discount = calculateDiscount(product.original_price, product.price);
        const isHighest = discount === getHighestDiscount() && discount !== null && discount > 0;
        return (
          <div className="text-center">
            {discount ? (
              <>
                <Badge className={`${isHighest ? "bg-red-500" : "bg-muted text-muted-foreground"}`}>
                  {discount}% خصم
                </Badge>
                {isHighest && products.length > 1 && (
                  <p className="text-xs text-red-500 mt-1">أعلى خصم</p>
                )}
              </>
            ) : (
              <span className="text-muted-foreground">لا يوجد</span>
            )}
          </div>
        );
      },
    },
    {
      label: "التقييم",
      icon: <Star className="h-5 w-5" />,
      getValue: (product) => {
        const rating = getAverageRating(product.reviews);
        const isHighest = rating === getHighestRating() && rating > 0;
        return (
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`h-4 w-4 ${
                    i < Math.round(rating)
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-gray-300"
                  }`}
                />
              ))}
            </div>
            <p className="text-sm mt-1">
              {rating.toFixed(1)} ({product.reviews?.length || 0} تقييم)
            </p>
            {isHighest && products.length > 1 && (
              <Badge className="mt-1 bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
                الأعلى تقييماً
              </Badge>
            )}
          </div>
        );
      },
      highlight: "highest",
    },
    {
      label: "الفئة",
      icon: <Tag className="h-5 w-5" />,
      getValue: (product) => (
        <p className="text-center">{product.categories?.name_ar || "غير محدد"}</p>
      ),
    },
    {
      label: "الفئة الفرعية",
      icon: <Tag className="h-5 w-5" />,
      getValue: (product) => (
        <p className="text-center">{product.subcategories?.name_ar || "غير محدد"}</p>
      ),
    },
    {
      label: "البائع",
      icon: <User className="h-5 w-5" />,
      getValue: (product) => (
        <p className="text-center">{product.vendor?.full_name || "غير محدد"}</p>
      ),
    },
    {
      label: "المخزون",
      icon: <Package className="h-5 w-5" />,
      getValue: (product) => {
        const stock = product.stock_quantity || 0;
        const isHighest = stock === getHighestStock() && stock > 0;
        return (
          <div className="text-center">
            <p className={`font-medium ${stock === 0 ? "text-red-500" : stock < 5 ? "text-orange-500" : "text-green-600"}`}>
              {stock === 0 ? "نفد المخزون" : `${stock} قطعة`}
            </p>
            {isHighest && products.length > 1 && stock > 0 && (
              <Badge className="mt-1 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                الأعلى توفراً
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      label: "التوفر",
      icon: <Check className="h-5 w-5" />,
      getValue: (product) => (
        <div className="flex justify-center">
          {(product.stock_quantity || 0) > 0 ? (
            <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
              <Check className="h-3 w-3 ml-1" />
              متوفر
            </Badge>
          ) : (
            <Badge variant="destructive">
              <X className="h-3 w-3 ml-1" />
              غير متوفر
            </Badge>
          )}
        </div>
      ),
    },
  ];

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
            <Scale className="h-16 w-16 mx-auto text-muted-foreground" />
            <h2 className="text-2xl font-bold">لا توجد منتجات للمقارنة</h2>
            <p className="text-muted-foreground">أضف منتجات من صفحات المنتجات لمقارنتها</p>
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
        <div className="mb-8 flex items-center gap-3">
          <Scale className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">مقارنة المنتجات</h1>
            <p className="text-muted-foreground">
              قارن بين {products.length} منتجات جنباً إلى جنب
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-max">
            {/* Product Images and Names Header */}
            <div 
              className="grid gap-4 mb-6" 
              style={{ gridTemplateColumns: `200px repeat(${products.length}, minmax(250px, 1fr))` }}
            >
              <div></div>
              {products.map((product) => (
                <Card key={product.id} className="relative overflow-hidden">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute top-2 left-2 z-10 bg-background/80 hover:bg-background"
                    onClick={() => removeProduct(product.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  
                  <div className="relative aspect-square overflow-hidden">
                    {product.original_price && (
                      <Badge className="absolute top-2 right-2 z-10 bg-red-500">
                        خصم {calculateDiscount(product.original_price, product.price)}%
                      </Badge>
                    )}
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                      onClick={() => navigate(`/product/${product.id}`)}
                    />
                  </div>

                  <CardContent className="p-4 space-y-3">
                    <h3 
                      className="font-bold text-lg line-clamp-2 cursor-pointer hover:text-primary transition-colors"
                      onClick={() => navigate(`/product/${product.id}`)}
                    >
                      {product.name}
                    </h3>
                    
                    <div className="flex gap-2">
                      <Button 
                        className="flex-1"
                        size="sm"
                        onClick={() => addToCart(product.id)}
                        disabled={addingToCart === product.id || (product.stock_quantity || 0) === 0}
                      >
                        {addingToCart === product.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <ShoppingCart className="h-4 w-4 ml-1" />
                            أضف للسلة
                          </>
                        )}
                      </Button>
                      <FavoriteButton productId={product.id} variant="outline" size="sm" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Comparison Table */}
            <Card>
              <CardContent className="p-0">
                {comparisonRows.map((row, index) => (
                  <div key={row.label}>
                    <div 
                      className={`grid gap-4 p-4 items-center ${index % 2 === 0 ? "bg-muted/30" : ""}`}
                      style={{ gridTemplateColumns: `200px repeat(${products.length}, minmax(250px, 1fr))` }}
                    >
                      <div className="flex items-center gap-2 font-medium text-muted-foreground">
                        {row.icon}
                        <span>{row.label}</span>
                      </div>
                      {products.map((product) => (
                        <div key={product.id}>
                          {row.getValue(product)}
                        </div>
                      ))}
                    </div>
                    {index < comparisonRows.length - 1 && <Separator />}
                  </div>
                ))}

                {/* Description Row */}
                <Separator />
                <div 
                  className="grid gap-4 p-4"
                  style={{ gridTemplateColumns: `200px repeat(${products.length}, minmax(250px, 1fr))` }}
                >
                  <div className="flex items-start gap-2 font-medium text-muted-foreground pt-1">
                    <Minus className="h-5 w-5" />
                    <span>الوصف</span>
                  </div>
                  {products.map((product) => (
                    <p key={product.id} className="text-sm text-muted-foreground line-clamp-4">
                      {product.description || "لا يوجد وصف"}
                    </p>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Compare;
