import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ImageGallery } from "@/components/ImageGallery";
import { ProductReviews } from "@/components/ProductReviews";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, ShoppingCart, Heart, Loader2, Minus, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  original_price: number | null;
  stock_quantity: number;
  image_url: string;
  images: string[] | null;
  vendor: {
    full_name: string;
  };
  reviews: {
    rating: number;
  }[];
}

const Product = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [addingToCart, setAddingToCart] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const { data, error } = await supabase
          .from("products")
          .select(`
            *,
            vendor:profiles(full_name),
            reviews(rating)
          `)
          .eq("id", id)
          .maybeSingle();

        if (error) throw error;
        setProduct(data as any);
      } catch (error: any) {
        toast({
          title: "خطأ",
          description: "فشل في جلب المنتج",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchProduct();
    }
  }, [id, toast]);

  const addToCart = async () => {
    if (!user) {
      navigate("/auth");
      return;
    }

    setAddingToCart(true);
    try {
      const { error } = await supabase
        .from("cart_items")
        .upsert({
          user_id: user.id,
          product_id: id,
          quantity,
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
      setAddingToCart(false);
    }
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

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">المنتج غير موجود</h2>
            <Button onClick={() => navigate("/")}>العودة للرئيسية</Button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const discount = product.original_price
    ? Math.round(((product.original_price - product.price) / product.original_price) * 100)
    : 0;

  // Prepare images array for gallery
  const productImages = product.images && product.images.length > 0 
    ? product.images 
    : product.image_url 
    ? [product.image_url] 
    : [];

  // Calculate average rating
  const averageRating = product.reviews && product.reviews.length > 0
    ? product.reviews.reduce((sum, r) => sum + r.rating, 0) / product.reviews.length
    : 0;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container px-4 py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Image Gallery Section */}
          <div className="relative">
            {discount > 0 && (
              <Badge className="absolute top-4 left-4 z-10 bg-sale text-sale-foreground text-lg px-4 py-2">
                خصم {discount}%
              </Badge>
            )}
            <ImageGallery images={productImages} productName={product.name} />
          </div>

          {/* Details Section */}
          <div className="space-y-6">
            <div>
              <h1 className="text-4xl font-bold mb-2">{product.name}</h1>
              <p className="text-muted-foreground">
                البائع: {product.vendor.full_name}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`h-5 w-5 ${
                    i < Math.round(averageRating)
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-gray-300"
                  }`}
                />
              ))}
              <span className="text-sm text-muted-foreground">
                ({averageRating.toFixed(1)}) - {product.reviews?.length || 0} تقييم
              </span>
            </div>

            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-bold text-primary">{product.price}</span>
              <span className="text-lg text-foreground/70">ريال</span>
              {product.original_price && (
                <span className="text-xl text-muted-foreground line-through">
                  {product.original_price} ريال
                </span>
              )}
            </div>

            <Card className="p-6 bg-muted/30">
              <p className="text-foreground leading-relaxed">{product.description}</p>
            </Card>

            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <span className="font-semibold">الكمية:</span>
                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-16 text-center font-bold text-lg">{quantity}</span>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => setQuantity(Math.min(product.stock_quantity, quantity + 1))}
                    disabled={quantity >= product.stock_quantity}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <span className="text-sm text-muted-foreground">
                  ({product.stock_quantity} متوفر)
                </span>
              </div>

              <div className="flex gap-4">
                <Button
                  size="lg"
                  className="flex-1"
                  onClick={addToCart}
                  disabled={addingToCart || product.stock_quantity === 0}
                >
                  {addingToCart ? (
                    <>
                      <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                      جاري الإضافة...
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="ml-2 h-5 w-5" />
                      أضف إلى السلة
                    </>
                  )}
                </Button>
                <Button size="lg" variant="outline">
                  <Heart className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Reviews Section */}
        <div className="mt-12">
          <ProductReviews productId={id!} />
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Product;