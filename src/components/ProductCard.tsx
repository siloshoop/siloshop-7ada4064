import { Heart, Star, Scale, Eye, Store, TrendingUp, Award } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FavoriteButton } from "@/components/FavoriteButton";
import ProductOriginBadge from "@/components/product/ProductOriginBadge";
import { useToast } from "@/hooks/use-toast";
import { useCompareProducts } from "@/hooks/useCompareProducts";
import { supabase } from "@/integrations/supabase/client";
import React, { useState, useEffect, memo } from "react";
import { formatPrice } from "@/lib/currency";
import { OUT_OF_STOCK_LABEL } from "@/lib/stockAvailability";
import { loadProductCardMeta } from "@/lib/productCardMeta";
import { shippingCardLabel, isFreeShipping } from "@/lib/shippingDisplay";
import { useVendorNames } from "@/hooks/useVendorNames";

interface ProductCardProps {
  id?: string;
  name: string;
  price: number;
  /** Currency code stored with the product ("SYP" | "USD"). No conversion. */
  currency?: string | null;
  originalPrice?: number;
  image: string;
  rating: number;
  reviews: number;
  discount?: number;
  shippingCost?: number;
  /** How shipping is charged: "free" | "fixed" | "variable" (set by the shipping company). */
  shippingMode?: string | null;
  stockQuantity?: number | null;
  /** Store (seller) display name */
  storeName?: string | null;
  /** "seller" (local) or "platform" (imported) */
  productType?: string | null;
  /** Preparation/shipping window in days */
  shipsWithinDays?: number | null;
  /** Units sold (aggregated) */
  soldCount?: number | null;
}

const ProductCard = memo(({
  id,
  name,
  price,
  currency,
  originalPrice,
  image,
  rating,
  reviews,
  discount,
  shippingCost,
  shippingMode,
  stockQuantity,
  storeName,
  productType,
  shipsWithinDays,
  soldCount,

}: ProductCardProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { addProduct } = useCompareProducts();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [liveStock, setLiveStock] = useState(stockQuantity);
  const [details, setDetails] = useState<{
    vendor_id?: string;
    is_featured?: boolean;
    is_trending?: boolean;
    reviews?: { rating: number }[];
  } | null>(null);
  const vendorNames = useVendorNames([details?.vendor_id]);
  const sellerName = storeName || (details?.vendor_id ? vendorNames[details.vendor_id] : undefined);
  const reviewCount = details?.reviews?.length ?? reviews;
  const averageRating = details?.reviews
    ? (reviewCount > 0 ? details.reviews.reduce((sum, review) => sum + review.rating, 0) / reviewCount : 0)
    : rating;
  useEffect(() => { setLiveStock(stockQuantity); }, [stockQuantity]);
  useEffect(() => {
    if (!id) return;
    setDetails(null);
    let active = true;
    const refresh = async () => {
      const data = await loadProductCardMeta(id);
      if (active && data) {
        setLiveStock(data.stock_quantity);
        setDetails(data);
      }
    };
    // Saved aggregate stock is authoritative even when a listing/RPC is stale.
    void refresh();
    window.addEventListener("stock-updated", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.removeEventListener("stock-updated", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [id, stockQuantity]);

  const productId = id;

  const goToProduct = () => {
    if (!productId) return;
    navigate(`/product/${productId}`);
  };

  const handleCompare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!id) return;

    const result = await addProduct(id);

    if (result.message === "auth") {
      toast({
        title: "تسجيل الدخول مطلوب",
        description: "سجّل الدخول لحفظ قائمة المقارنة في حسابك",
        variant: "destructive",
      });
      return;
    }

    if (result.message === "exists") {
      toast({
        title: "موجود بالفعل",
        description: "هذا المنتج موجود في قائمة المقارنة",
      });
      return;
    }

    if (result.message === "max") {
      toast({
        title: "الحد الأقصى",
        description: "يمكنك مقارنة 4 منتجات كحد أقصى",
        variant: "destructive",
      });
      return;
    }

    if (!result.success) {
      toast({
        title: "تعذر الإضافة",
        description: "حدث خطأ أثناء إضافة المنتج للمقارنة",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "تمت الإضافة",
      description: "تم إضافة المنتج لقائمة المقارنة",
    });
  };


  const isOutOfStock = typeof liveStock === "number" && liveStock <= 0;
  const isLowStock = typeof liveStock === "number" && liveStock > 0 && liveStock <= 5;

  const hasDiscount = typeof originalPrice === "number" && originalPrice > price && originalPrice > 0;
  const discountPercent = hasDiscount ? Math.round((originalPrice - price) / originalPrice * 100) : (discount && discount > 0 ? discount : 0);
  // Free / fixed price / set by the shipping company — never free when a price exists.
  const shippingLine = shippingCardLabel(shippingMode, shippingCost, currency);

  return (
    <a
      href={productId ? `/product/${productId}` : undefined}
      className="group relative flex h-full min-w-0 cursor-pointer flex-col overflow-hidden rounded-lg border border-border bg-card shadow-card transition-all duration-300 motion-reduce:transition-none hover:border-primary/40 hover:shadow-elegant"
      data-product-card
      onClick={(e) => {
        // Let the browser handle ctrl/cmd/middle-click so the product can be
        // opened in a new tab, and keep SPA navigation for plain clicks.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        goToProduct();
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >

      <div className="relative aspect-[4/5] overflow-hidden bg-muted/30">
        {discountPercent > 0 && (
          <div className="absolute end-2 top-2 z-10 max-w-[calc(100%-3.5rem)]">
            <Badge className="bg-sale text-sale-foreground font-bold text-[11px] px-2 py-1 rounded-md border-0">
              خصم {discountPercent}%
            </Badge>
          </div>
        )}

        {isOutOfStock && (
          <div className="absolute bottom-2 end-2 z-10 max-w-[calc(100%-1rem)]">
            <Badge className="bg-destructive text-destructive-foreground font-bold text-[11px] px-2 py-0.5 rounded-md shadow-lg border-0 animate-pop-in">
              {OUT_OF_STOCK_LABEL}
            </Badge>
          </div>
        )}
        {!isOutOfStock && isLowStock && (
          <div className="absolute bottom-2 start-2 z-10">
            <Badge className="bg-warning text-warning-foreground font-semibold text-[10px] px-1.5 py-0.5 rounded-md shadow-md border-0 animate-pulse">
              متبقي {liveStock}
            </Badge>
          </div>
        )}

        <div className="absolute top-2 start-2 z-10 flex flex-col gap-1">
          {id ? (
            <FavoriteButton productId={id} variant="ghost" size="icon" className="h-8 w-8 rounded-full" />
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="إضافة إلى المفضلة"
               className="h-8 w-8 rounded-full bg-background/95 shadow-sm backdrop-blur-md hover:bg-primary hover:text-primary-foreground"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <Heart className="h-3.5 w-3.5" />
            </Button>
          )}
          {id && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full bg-background/95 opacity-100 shadow-sm backdrop-blur-md hover:bg-primary hover:text-primary-foreground sm:translate-x-2 sm:opacity-0 sm:group-hover:translate-x-0 sm:group-hover:opacity-100"
              onClick={handleCompare}
              title="أضف للمقارنة"
            >
              <Scale className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        <img
          src={image || "/placeholder.svg"}
          alt={name}
          loading="lazy"
          decoding="async"
          onLoad={() => setImageLoaded(true)}
          onError={(event) => {
            event.currentTarget.src = "/placeholder.svg";
            setImageLoaded(true);
          }}
          className={`object-contain w-full h-full transition-all duration-500 ease-out motion-reduce:transition-none ${
            imageLoaded ? "opacity-100" : "opacity-0"
          } ${isHovered ? "scale-105 motion-reduce:scale-100" : "scale-100"}`}
        />

        <div className="absolute inset-0 bg-gradient-to-t from-foreground/50 via-foreground/10 to-transparent opacity-0 transition-all duration-500 group-hover:opacity-100" />

        <div className="absolute inset-x-0 bottom-0 hidden translate-y-full p-2 transition-transform duration-300 ease-out group-hover:translate-y-0 sm:block">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="w-full bg-background/90 text-xs font-semibold shadow-lg backdrop-blur-md hover:bg-primary hover:text-primary-foreground"
            onClick={(e) => {
              e.stopPropagation();
              goToProduct();
            }}
          >
            <Eye className="h-3.5 w-3.5" />
            عرض سريع
          </Button>
        </div>
      </div>

      {(details?.is_trending || details?.is_featured) && (
        <div className="flex min-w-0 items-center gap-1.5 bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">
          {details.is_trending ? <TrendingUp className="h-3.5 w-3.5 shrink-0" /> : <Award className="h-3.5 w-3.5 shrink-0" />}
          <span className="truncate">{details.is_trending ? "رائج الآن" : "منتج مميز"}</span>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-1 p-2">
        <h3 className="line-clamp-2 min-h-[2rem] break-words text-xs font-medium leading-4 text-foreground transition-colors duration-300 group-hover:text-primary">
          {name}
        </h3>

        {/* Store name */}
        {sellerName && (
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground truncate">
            <Store className="h-3 w-3 shrink-0" />
            <span className="truncate">{sellerName}</span>
          </p>
        )}

        {/* Local seller / imported-from-Turkey badge */}
        <ProductOriginBadge productType={productType} compact />

        <div className="flex min-w-0 flex-wrap items-center gap-1">
          <div className="flex shrink-0 text-warning" role="img" aria-label={`التقييم ${averageRating.toFixed(1)} من 5`}>
            {[...Array(5)].map((_, i) => (
              <span key={i} className="relative h-3 w-3">
                <Star className="h-3 w-3 text-muted-foreground/40" />
                {averageRating >= i + 1 && <Star className="absolute inset-0 h-3 w-3 fill-current" />}
                {averageRating > i && averageRating < i + 1 && <span className="absolute inset-y-0 left-0 w-1/2 overflow-hidden"><Star className="h-3 w-3 max-w-none fill-current" /></span>}
              </span>
            ))}
          </div>
          <span className="min-w-0 text-[11px] text-muted-foreground">
            {averageRating > 0 ? averageRating.toFixed(1) : "—"} ({reviewCount})
          </span>
          {typeof soldCount === "number" && soldCount > 0 && (
            <span className="min-w-0 truncate text-[10px] text-muted-foreground">
              · تم بيع {soldCount.toLocaleString()}
            </span>
          )}

        </div>

        <div className="mt-auto flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-1">
          <span className="break-words text-sm font-bold leading-snug text-primary">
            {formatPrice(price, currency)}
          </span>
          {originalPrice && originalPrice > price && (
            <span className="text-[10px] text-muted-foreground line-through">
              {formatPrice(originalPrice, currency)}
            </span>
          )}
        </div>

        {shippingLine && (
          <div className="flex min-w-0 items-center gap-1 text-[10px]">
            <span
              className={
                isFreeShipping(shippingMode, shippingCost)
                  ? "text-success font-medium"
                  : "line-clamp-2 text-muted-foreground"
              }
            >
              🚚 {shippingLine}
            </span>
          </div>
        )}

        <p className="hidden text-[10px] text-muted-foreground sm:block">
          {shipsWithinDays && shipsWithinDays > 0
            ? `التوصيل خلال ${shipsWithinDays} أيام`
            : productType === "platform"
            ? "التوصيل خلال 7-14 يوم"
            : "التوصيل خلال 1-3 أيام"}
        </p>

      </div>
    </a>

  );
});

ProductCard.displayName = "ProductCard";

export default ProductCard;
