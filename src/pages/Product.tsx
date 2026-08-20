import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import ProductOriginBadge from "@/components/product/ProductOriginBadge";
import SellerInfoCard from "@/components/product/SellerInfoCard";
import ReportDialog from "@/components/ReportDialog";
import ShippingReturnsInfo from "@/components/product/ShippingReturnsInfo";
import ProductSpecs from "@/components/product/ProductSpecs";
import ProductQuestions from "@/components/product/ProductQuestions";
import FrequentlyBoughtTogether from "@/components/product/FrequentlyBoughtTogether";
import ProductRecommendations from "@/components/ProductRecommendations";
import Footer from "@/components/Footer";
import { ImageGallery } from "@/components/ImageGallery";
import { ProductReviews } from "@/components/ProductReviews";
import { VendorRating } from "@/components/VendorRating";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Loader2, Minus, Plus, Star, ArrowLeftRight, Zap, Truck, ShieldCheck, RotateCcw, Store } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { FavoriteButton } from "@/components/FavoriteButton";
import AddToWishlistButton from "@/components/AddToWishlistButton";
import ChatButton from "@/components/ChatButton";
import ReturnsPolicyNote from "@/components/ReturnsPolicyNote";
import { useRecentlyViewed } from "@/hooks/useRecentlyViewed";
import SimilarProducts from "@/components/SimilarProducts";
import MarketPriceBar from "@/components/MarketPriceBar";
interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  original_price: number | null;
  stock_quantity: number;
  shipping_cost: number | null;
  image_url: string;
  images: string[] | null;
  vendor_id: string;
  category_id: string | null;
  sku?: string | null;
  barcode?: string | null;
  video_url?: string | null;
  product_type?: string | null;
  ships_within_days?: number | null;
  categories?: { name_ar: string } | null;
  brands?: { name_ar: string } | null;
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
  const [vendorStats, setVendorStats] = useState<{ avg: number; count: number }>({ avg: 0, count: 0 });

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
            reviews(rating),
            categories(name_ar),
            brands(name_ar)
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

          // Seller rating summary for the seller information card
          const { data: vendorRatings } = await supabase
            .from("vendor_ratings")
            .select("rating")
            .eq("vendor_id", data.vendor_id);
          if (vendorRatings && vendorRatings.length > 0) {
            setVendorStats({
              avg: vendorRatings.reduce((s, r) => s + r.rating, 0) / vendorRatings.length,
              count: vendorRatings.length,
            });
          }
        } else {
          setProduct(null);
        }
      } catch (error) {
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
    // Only re-fetch when the product changes. `toast` / `trackProductView` are
    // intentionally omitted — including them re-ran this effect on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

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
    } catch (error) {
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

  const inStock = product.stock_quantity > 0;
  const lowStock = inStock && product.stock_quantity <= 5;

  const buyNow = async () => {
    await addToCart();
    navigate("/cart");
  };

  return (
    <div className="min-h-screen flex flex-col pb-20 md:pb-0">
      <Navbar />
      <main className="flex-1 container max-w-6xl px-4 py-6 md:py-8">
        <div className="grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] gap-6 lg:gap-10 animate-fade-in">
          {/* Image Gallery */}
          <div className="relative">
            {discount > 0 && (
              <Badge className="absolute top-3 right-3 z-10 bg-sale text-sale-foreground rounded-full px-3 py-1 text-xs font-bold shadow">
                خصم {discount}%
              </Badge>
            )}
            <div className="lg:sticky lg:top-24">
              <ImageGallery
                images={productImages}
                productName={product.name}
                videoUrl={product.video_url}
              />
            </div>
          </div>

          {/* Details */}
          <div className="space-y-5">
            {/* Title + seller */}
            <div className="space-y-1.5">
              <button
                onClick={() => navigate(`/vendor/${product.vendor_id}/ratings`)}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                <Store className="h-3.5 w-3.5" />
                <span>البائع: {product.vendor.full_name}</span>
              </button>
              <h1 className="text-xl md:text-2xl font-semibold leading-snug tracking-tight">
                {product.name}
              </h1>

              <ProductOriginBadge
                productType={product.product_type}
                shipsWithinDays={product.ships_within_days}
                className="pt-1"
              />

              {/* Rating summary */}
              <div className="flex items-center gap-2 pt-1">
                <div className="flex items-center gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`h-3.5 w-3.5 ${
                        i < Math.round(averageRating)
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-muted-foreground/40"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-xs text-muted-foreground">
                  ({averageRating.toFixed(1)}) · {product.reviews?.length || 0} تقييم
                </span>
              </div>
            </div>

            <Separator />

            {/* Price */}
            <div className="space-y-1.5">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-3xl font-bold text-primary">
                  {product.price.toLocaleString()}
                </span>
                <span className="text-sm text-foreground/70">ل.س</span>
                {product.original_price && (
                  <span className="text-sm text-muted-foreground line-through">
                    {product.original_price.toLocaleString()} ل.س
                  </span>
                )}
                {discount > 0 && (
                  <span className="text-xs font-semibold text-sale-foreground bg-sale/10 px-2 py-0.5 rounded-full">
                    وفّر {discount}%
                  </span>
                )}
              </div>
              <MarketPriceBar
                productId={product.id}
                price={product.price}
                categoryId={product.category_id}
              />
            </div>

            {/* Availability + shipping */}
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span
                className={`inline-flex items-center gap-1.5 font-medium ${
                  inStock ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                }`}
              >
                <span
                  className={`inline-block h-2 w-2 rounded-full ${
                    inStock ? "bg-emerald-500 animate-pulse" : "bg-destructive"
                  }`}
                />
                {inStock ? "متوفر الآن" : "غير متوفر"}
              </span>
              {inStock && (
                <span className="text-muted-foreground">· {product.stock_quantity} قطعة</span>
              )}
              {lowStock && (
                <span className="text-amber-600 dark:text-amber-400 font-medium">
                  · الكمية محدودة
                </span>
              )}
              <span className="text-muted-foreground">·</span>
              <span className="inline-flex items-center gap-1.5 font-medium">
                <Truck className="h-3.5 w-3.5 text-primary" />
                {product.shipping_cost === 0 || product.shipping_cost === null
                  ? "شحن مجاني"
                  : `الشحن: ${Number(product.shipping_cost).toLocaleString()} ل.س`}
              </span>
            </div>

            {/* Quantity + primary actions */}
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-muted-foreground">الكمية</span>
                <div className="flex items-center rounded-full border bg-background overflow-hidden">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 rounded-none"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    aria-label="إنقاص الكمية"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-10 text-center text-sm font-semibold">{quantity}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 rounded-none"
                    onClick={() =>
                      setQuantity(Math.min(product.stock_quantity, quantity + 1))
                    }
                    disabled={quantity >= product.stock_quantity}
                    aria-label="زيادة الكمية"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="hidden md:flex gap-2">
                <Button
                  size="lg"
                  variant="outline"
                  className="flex-1 rounded-full"
                  onClick={addToCart}
                  disabled={addingToCart || !inStock}
                >
                  {addingToCart ? (
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ShoppingCart className="ml-2 h-4 w-4" />
                  )}
                  أضف إلى السلة
                </Button>
                <Button
                  size="lg"
                  className="flex-1 rounded-full"
                  onClick={buyNow}
                  disabled={addingToCart || !inStock}
                >
                  <Zap className="ml-2 h-4 w-4" />
                  اشترِ الآن
                </Button>
                <FavoriteButton productId={id!} variant="outline" size="lg" />
              </div>

              <div className="hidden md:grid grid-cols-3 gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full"
                  onClick={addToCompare}
                >
                  <ArrowLeftRight className="ml-2 h-4 w-4" />
                  مقارنة
                </Button>
                <AddToWishlistButton productId={id!} variant="ghost" />
                <ChatButton vendorId={product.vendor_id} productId={id} />
              </div>
            </div>

            {/* Trust badges */}
            <div className="grid grid-cols-3 gap-2 pt-2">
              <div className="flex flex-col items-center text-center gap-1 rounded-xl border bg-muted/30 p-3">
                <Truck className="h-4 w-4 text-primary" />
                <span className="text-[11px] text-muted-foreground leading-tight">
                  {(product as any).ships_within_days
                    ? `يشحن خلال ${(product as any).ships_within_days} أيام`
                    : "شحن لجميع المحافظات"}
                </span>
              </div>
              <div className="flex flex-col items-center text-center gap-1 rounded-xl border bg-muted/30 p-3">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span className="text-[11px] text-muted-foreground leading-tight">
                  دفع آمن عند الاستلام
                </span>
              </div>
              <div className="flex flex-col items-center text-center gap-1 rounded-xl border bg-muted/30 p-3">
                <RotateCcw className="h-4 w-4 text-primary" />
                <span className="text-[11px] text-muted-foreground leading-tight">
                  إرجاع خلال 7 أيام
                </span>
              </div>
            </div>

            <SellerInfoCard
              vendorId={product.vendor_id}
              vendorName={product.vendor.full_name}
              productId={id}
              isPlatform={product.product_type === "platform"}
              rating={vendorStats.avg}
              ratingCount={vendorStats.count}
            />

            <ReturnsPolicyNote className="mt-2" />

            <div className="flex justify-end">
              <ReportDialog
                kind="product"
                targetId={id!}
                targetName={product.name}
                label="الإبلاغ عن هذا المنتج"
                className="text-muted-foreground"
              />
            </div>
          </div>
        </div>

        {/* Tabbed sections */}
        <section className="mt-10">
          <Tabs defaultValue="description" className="w-full">
            <TabsList className="w-full justify-start overflow-x-auto scrollbar-hide bg-transparent border-b rounded-none h-auto p-0 gap-1">
              <TabsTrigger
                value="description"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5"
              >
                الوصف
              </TabsTrigger>
              <TabsTrigger
                value="specs"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5"
              >
                المواصفات
              </TabsTrigger>
              <TabsTrigger
                value="reviews"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5"
              >
                التقييمات ({product.reviews?.length || 0})
              </TabsTrigger>
              <TabsTrigger
                value="shipping"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5"
              >
                الشحن والإرجاع
              </TabsTrigger>
              <TabsTrigger
                value="qa"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5"
              >
                أسئلة وأجوبة
              </TabsTrigger>
            </TabsList>

            <TabsContent value="description" className="pt-6 animate-fade-in">
              <div className="max-w-3xl">
                <p className="text-sm md:text-base text-foreground/85 leading-relaxed whitespace-pre-wrap">
                  {product.description || "لا يوجد وصف مفصل لهذا المنتج."}
                </p>
              </div>
            </TabsContent>

            <TabsContent value="specs" className="pt-6 animate-fade-in">
              <div className="max-w-3xl space-y-4">
                <ProductSpecs
                  product={product as unknown as Record<string, any>}
                  vendorName={product.vendor.full_name}
                  categoryName={product.categories?.name_ar}
                  brandName={product.brands?.name_ar}
                />
                {(product.sku || product.barcode) && (
                  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                    {product.sku && <span>رمز المنتج (SKU): {product.sku}</span>}
                    {product.barcode && <span>الباركود: {product.barcode}</span>}
                  </div>
                )}
                <div className="rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
                  يشمل هذا المنتج ضمان استبدال أو استرجاع وفق سياسة الشحن والإرجاع الخاصة بالمتجر، يرجى مراجعة تبويب "الشحن والإرجاع" لمزيد من التفاصيل.
                </div>
              </div>
            </TabsContent>

            <TabsContent value="reviews" className="pt-6 animate-fade-in">
              <ProductReviews productId={id!} vendorId={product.vendor_id} />
            </TabsContent>

            <TabsContent value="shipping" className="pt-6 animate-fade-in">
              <ShippingReturnsInfo
                shippingCost={product.shipping_cost}
                shipsWithinDays={product.ships_within_days}
                isPlatform={product.product_type === "platform"}
              />
            </TabsContent>

            <TabsContent value="qa" className="pt-6 animate-fade-in">
              <ProductQuestions productId={id!} vendorId={product.vendor_id} />
              <div className="mt-6 max-w-3xl flex justify-center">
                <ChatButton vendorId={product.vendor_id} productId={id} />
              </div>
            </TabsContent>
          </Tabs>
        </section>

        {/* Vendor Rating Section */}
        <div className="mt-10">
          <VendorRating 
            vendorId={product.vendor_id} 
            vendorName={product.vendor.full_name} 
          />
        </div>

        {/* Frequently bought together */}
        <FrequentlyBoughtTogether
          product={{
            id: product.id,
            name: product.name,
            price: product.price,
            image_url: product.image_url,
            stock_quantity: product.stock_quantity,
          }}
          categoryId={product.category_id}
          vendorId={product.vendor_id}
        />

        {/* Similar Products Section */}
        <SimilarProducts 
          productId={id!} 
          categoryId={product.category_id} 
          vendorId={product.vendor_id} 
        />

        {/* Recommended for you */}
        <ProductRecommendations />

      </main>

      {/* Sticky mobile action bar */}
      <div className="md:hidden fixed bottom-16 inset-x-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-lg animate-fade-in">
        <div className="container px-3 py-2 flex items-center gap-2">
          <FavoriteButton productId={id!} variant="outline" size="icon" />
          <Button
            variant="outline"
            className="flex-1 rounded-full"
            onClick={addToCart}
            disabled={addingToCart || !inStock}
          >
            {addingToCart ? (
              <Loader2 className="ml-1 h-4 w-4 animate-spin" />
            ) : (
              <ShoppingCart className="ml-1 h-4 w-4" />
            )}
            <span className="text-xs">السلة</span>
          </Button>
          <Button
            className="flex-1 rounded-full"
            onClick={buyNow}
            disabled={addingToCart || !inStock}
          >
            <Zap className="ml-1 h-4 w-4" />
            <span className="text-xs">اشترِ الآن</span>
          </Button>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default Product;
