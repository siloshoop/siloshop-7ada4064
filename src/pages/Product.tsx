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
import SeoHead from "@/components/SeoHead";
import ProductVariantPicker from "@/components/product/ProductVariantPicker";
import type { Database } from "@/integrations/supabase/types";

type ProductVariant = Database["public"]["Tables"]["product_variants"]["Row"];
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
  name_en?: string | null;
  short_description?: string | null;
  gtin?: string | null;
  min_order_quantity?: number | null;
  max_order_quantity?: number | null;
  length_cm?: number | null;
  width_cm?: number | null;
  height_cm?: number | null;
  shipping_weight?: number | null;
  shipping_class?: string | null;
  warranty?: string | null;
  return_policy?: string | null;
  country_of_origin?: string | null;
  tags?: string[] | null;
  slug?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  seo_keywords?: string | null;
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
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const viewTrackedRef = useState(() => ({ current: "" }))[0];

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
          setQuantity((data as any).min_order_quantity && (data as any).min_order_quantity > 1 ? (data as any).min_order_quantity : 1);

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

          // Fetch active variants
          const { data: variantData } = await supabase
            .from("product_variants")
            .select("*")
            .eq("product_id", data.id)
            .eq("is_active", true);
          setVariants(variantData || []);

          // Track product view once per product
          if (viewTrackedRef.current !== data.id) {
            viewTrackedRef.current = data.id;
            supabase.rpc("track_product_metric", { _product_id: data.id, _metric: "view" });
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
          .insert({ user_id: user.id, product_id: id, quantity: Math.max(quantity, minQty) }));
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

  // Prepare images array for gallery
  const hasVariants = variants.length > 0;
  const effectivePrice = selectedVariant?.discount_price ?? selectedVariant?.price ?? product.price;
  const effectiveOriginalPrice = selectedVariant ? (selectedVariant.discount_price ? selectedVariant.price : null) : product.original_price;
  const effectiveStock = hasVariants ? (selectedVariant?.stock_quantity ?? 0) : product.stock_quantity;
  const discount = effectiveOriginalPrice
    ? Math.round(((effectiveOriginalPrice - effectivePrice) / effectiveOriginalPrice) * 100)
    : 0;

  const productImages = selectedVariant?.image_url
    ? [selectedVariant.image_url, ...(product.images || [])]
    : product.images && product.images.length > 0
    ? product.images
    : product.image_url
    ? [product.image_url]
    : [];

  // Calculate average rating
  const averageRating = product.reviews && product.reviews.length > 0
    ? product.reviews.reduce((sum, r) => sum + r.rating, 0) / product.reviews.length
    : 0;

  const inStock = effectiveStock > 0;
  const lowStock = inStock && effectiveStock <= 5;
  const minQty = product.min_order_quantity && product.min_order_quantity > 0 ? product.min_order_quantity : 1;
  const maxQty = Math.min(
    product.max_order_quantity && product.max_order_quantity > 0 ? product.max_order_quantity : Infinity,
    effectiveStock || Infinity
  );
  const canAddToCart = inStock && (!hasVariants || !!selectedVariant);

  const buyNow = async () => {
    await addToCart();
    navigate("/cart");
  };

  const canonicalUrl = typeof window !== "undefined" ? window.location.href : undefined;
  const seoTitleRaw = product.seo_title || `${product.name} | Silo Shop`;
  const seoTitle = seoTitleRaw.length > 60 ? seoTitleRaw.slice(0, 57) + "..." : seoTitleRaw;
  const seoDescRaw = product.seo_description || product.short_description || product.description || "";
  const seoDescription = seoDescRaw.length > 160 ? seoDescRaw.slice(0, 157) + "..." : seoDescRaw;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    image: productImages,
    description: seoDescription || undefined,
    sku: selectedVariant?.sku || product.sku || undefined,
    brand: product.brands?.name_ar ? { "@type": "Brand", name: product.brands.name_ar } : undefined,
    ...(product.reviews && product.reviews.length > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: averageRating.toFixed(1),
            reviewCount: product.reviews.length,
          },
        }
      : {}),
    offers: {
      "@type": "Offer",
      price: effectivePrice,
      priceCurrency: "SYP",
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  };

  return (
    <div className="min-h-screen flex flex-col pb-20 md:pb-0">
      <SeoHead
        title={seoTitle}
        description={seoDescription}
        keywords={product.seo_keywords}
        canonicalUrl={canonicalUrl}
        ogImage={productImages[0] || undefined}
        ogType="product"
        jsonLd={jsonLd}
      />
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

              {product.short_description && (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {product.short_description}
                </p>
              )}

              {product.tags && product.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {product.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="rounded-full text-[11px] font-normal">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

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
                  {effectivePrice.toLocaleString()}
                </span>
                <span className="text-sm text-foreground/70">ل.س</span>
                {effectiveOriginalPrice && (
                  <span className="text-sm text-muted-foreground line-through">
                    {effectiveOriginalPrice.toLocaleString()} ل.س
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
                price={effectivePrice}
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
                <span className="text-muted-foreground">· {effectiveStock} قطعة</span>
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

            {/* Variant picker */}
            {hasVariants && (
              <div className="rounded-xl border bg-muted/20 p-4">
                <ProductVariantPicker variants={variants} onSelect={setSelectedVariant} />
                {!selectedVariant && (
                  <p className="text-xs text-muted-foreground pt-2">يرجى اختيار كافة الخيارات لعرض السعر والتوفر</p>
                )}
              </div>
            )}

            {/* Quantity + primary actions */}
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-muted-foreground">الكمية</span>
                <div className="flex items-center rounded-full border bg-background overflow-hidden">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 rounded-none"
                    onClick={() => setQuantity(Math.max(minQty, quantity - 1))}
                    disabled={quantity <= minQty}
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
                      setQuantity(Math.min(maxQty, quantity + 1))
                    }
                    disabled={quantity >= maxQty}
                    aria-label="زيادة الكمية"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {(product.min_order_quantity || product.max_order_quantity) && (
                  <span className="text-xs text-muted-foreground">
                    {product.min_order_quantity ? `الحد الأدنى: ${product.min_order_quantity}` : ""}
                    {product.min_order_quantity && product.max_order_quantity ? " · " : ""}
                    {product.max_order_quantity ? `الحد الأقصى: ${product.max_order_quantity}` : ""}
                  </span>
                )}
              </div>

              <div className="hidden md:flex gap-2">
                <Button
                  size="lg"
                  variant="outline"
                  className="flex-1 rounded-full"
                  onClick={addToCart}
                  disabled={addingToCart || !canAddToCart}
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
                  disabled={addingToCart || !canAddToCart}
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
                    {product.sku && <span>رمز المنتج (SKU): {selectedVariant?.sku || product.sku}</span>}
                    {product.barcode && <span>الباركود: {product.barcode}</span>}
                  </div>
                )}
                {(product.warranty || product.return_policy || product.country_of_origin || product.gtin || product.shipping_weight || product.length_cm || product.width_cm || product.height_cm) && (
                  <div className="rounded-xl border divide-y text-sm">
                    {product.warranty && (
                      <div className="flex justify-between px-3 py-2"><span className="text-muted-foreground">الضمان</span><span>{product.warranty}</span></div>
                    )}
                    {product.return_policy && (
                      <div className="flex justify-between px-3 py-2"><span className="text-muted-foreground">سياسة الإرجاع</span><span>{product.return_policy}</span></div>
                    )}
                    {product.country_of_origin && (
                      <div className="flex justify-between px-3 py-2"><span className="text-muted-foreground">بلد المنشأ</span><span>{product.country_of_origin}</span></div>
                    )}
                    {product.shipping_weight && (
                      <div className="flex justify-between px-3 py-2"><span className="text-muted-foreground">الوزن</span><span>{product.shipping_weight} كغ</span></div>
                    )}
                    {(product.length_cm || product.width_cm || product.height_cm) && (
                      <div className="flex justify-between px-3 py-2"><span className="text-muted-foreground">الأبعاد (طول×عرض×ارتفاع)</span><span>{[product.length_cm, product.width_cm, product.height_cm].filter(Boolean).join(" × ")} سم</span></div>
                    )}
                    {product.gtin && (
                      <div className="flex justify-between px-3 py-2"><span className="text-muted-foreground">GTIN</span><span>{product.gtin}</span></div>
                    )}
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
            disabled={addingToCart || !canAddToCart}
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
            disabled={addingToCart || !canAddToCart}
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
