import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ImageGallery } from "@/components/ImageGallery";
import { ProductReviews } from "@/components/ProductReviews";
import { VendorRating } from "@/components/VendorRating";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Heart, ShoppingCart, Loader2, Minus, Plus, Star, ArrowLeftRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { FavoriteButton } from "@/components/FavoriteButton";
import AddToWishlistButton from "@/components/AddToWishlistButton";
import ChatButton from "@/components/ChatButton";
import { useRecentlyViewed } from "@/hooks/useRecentlyViewed";
import SimilarProducts from "@/components/SimilarProducts";
import MarketPriceBar from "@/components/MarketPriceBar";
import AdPlaceholder from "@/components/AdPlaceholder";
import StickyMobileAd from "@/components/StickyMobileAd";


interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  original_price: number | null;
  stock_quantity: number;
  image_url: string;
  images: string[] | null;
  vendor_id: string;
  category_id: string | null;
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
  const [searchParams] = useSearchParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [addingToCart, setAddingToCart] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { trackProductView } = useRecentlyViewed();

  const addToCompare = () => {
    const currentCompare = searchParams.get("compare")?.split(",") || [];
    
    if (!id) return;
    
    if (currentCompare.includes(id)) {
      toast({
        title: "تنبيه",
        description: "المنتج موجود بالفعل في قائمة المقارنة",
      });
      return;
    }

    if (currentCompare.length >= 4) {
      toast({
        title: "تنبيه",
        description: "يمكنك مقارنة حتى 4 منتجات فقط",
        variant: "destructive",
      });
      return;
    }

    const newCompare = [...currentCompare, id];
    navigate(`/compare?products=${newCompare.join(",")}`);
    
    toast({
      title: "تمت الإضافة",
      description: "تم إضافة المنتج إلى قائمة المقارنة",
    });
  };

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        // Fetch product data
        const { data, error } = await supabase
          .from("products")
          .select(`
            *,
            reviews(rating)
          `)
          .eq("id", id)
          .maybeSingle();

        if (error) throw error;
        
        if (data) {
          // Fetch vendor info using secure function (excludes phone number)
          const { data: vendorInfo } = await supabase
            .rpc("get_vendor_public_info", { vendor_id: data.vendor_id });
          
          const vendorName = vendorInfo?.[0]?.full_name || null;
          setProduct({ ...data, vendor: { full_name: vendorName } } as any);
        } else {
          setProduct(null);
        }
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
      // Track product view for recently viewed feature
      trackProductView(id);
    }
  }, [id, toast, trackProductView]);

  const addToCart = async () => {
    if (!user) {
      navigate("/auth");
      return;
    }

    setAddingToCart(true);
    try {
      // Check if item already exists in cart
      const { data: existingItem } = await supabase
        .from("cart_items")
        .select("id, quantity")
        .eq("user_id", user.id)
        .eq("product_id", id!)
        .maybeSingle();

      let error;
      if (existingItem) {
        ({ error } = await supabase
          .from("cart_items")
          .update({ quantity: existingItem.quantity + quantity })
          .eq("id", existingItem.id));
      } else {
        ({ error } = await supabase
          .from("cart_items")
          .insert({ user_id: user.id, product_id: id, quantity }));
      }

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
              <span className="text-lg text-foreground/70">ل.س</span>
              {product.original_price && (
                <span className="text-xl text-muted-foreground line-through">
                  {product.original_price} ل.س
                </span>
              )}
            </div>

            <Card className="p-6 bg-muted/30">
              <p className="text-foreground leading-relaxed">{product.description}</p>
            </Card>

            <MarketPriceBar
              productId={product.id}
              price={product.price}
              categoryId={product.category_id}
            />

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
                <FavoriteButton productId={id!} variant="outline" size="lg" />
              </div>
              
              <Button
                size="lg"
                variant="outline"
                className="w-full"
                onClick={addToCompare}
              >
                <ArrowLeftRight className="ml-2 h-5 w-5" />
                إضافة للمقارنة
              </Button>
              <AddToWishlistButton productId={id!} variant="outline" />
              <div className="mt-4">
                <ChatButton vendorId={product.vendor_id} productId={id} />
              </div>
            </div>
          </div>
        </div>

        {/* Ad: Leaderboard after product info — high-intent placement */}
        <div className="mt-8">
          <AdPlaceholder size="leaderboard" slot="product-top-leaderboard" />
        </div>

        {/* Vendor Rating Section */}
        <div className="mt-8">
          <VendorRating 
            vendorId={product.vendor_id} 
            vendorName={product.vendor.full_name} 
          />
        </div>

        {/* Reviews Section */}
        <div className="mt-8">
          <ProductReviews productId={id!} vendorId={product.vendor_id} />
        </div>

        {/* Ad: Rectangle between reviews and similar products */}
        <div className="mt-8 flex justify-center">
          <AdPlaceholder size="rectangle" slot="product-mid-rectangle" />
        </div>

        {/* Similar Products Section */}
        <SimilarProducts 
          productId={id!} 
          categoryId={product.category_id} 
          vendorId={product.vendor_id} 
        />

        {/* Ad: Banner after similar products */}
        <div className="mt-6">
          <AdPlaceholder size="banner" slot="product-bottom-banner" />
        </div>
      </main>
      <StickyMobileAd />
      <Footer />
    </div>
  );
};

export default Product;
